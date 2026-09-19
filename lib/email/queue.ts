// ============================================================
// lib/email/queue.ts
// ============================================================
import { supabaseAdmin } from '../supabase';
import { sendOutreachEmail } from './provider';
import { isSuppressed } from './suppression';
import { buildOutreachHtml, buildOutreachText } from './templates';
import { ACTIVE_CAMPAIGN, campaignSequenceId } from '../tools/lead-recovery/campaign';

export interface QueueItem {
  leadId: string;
  subject: string;
  bodyText: string;
  bodyHtml: string;
  targetEmail: string; // The email we resolved
  unsubscribeUrl: string;
  scheduledFor?: Date;
  campaignId?: string;
}

/**
 * Adds an approved lead's email snapshot to the queue.
 */
export async function addToQueue(item: QueueItem, organizationId: string) {
  // Final suppression check before queuing
  if (await isSuppressed(item.targetEmail)) {
    console.warn(`Attempted to queue suppressed email: ${item.targetEmail}`);
    throw new Error('Cannot queue: email is suppressed');
  }

  const { data, error } = await supabaseAdmin
    .from('outreach_queue')
    .insert([
      {
        lead_id: item.leadId,
        subject: item.subject,
        body_text: item.bodyText,
        body_html: item.bodyHtml,
        target_email: item.targetEmail.toLowerCase(),
        unsubscribe_url: item.unsubscribeUrl,
        status: 'pending',
        scheduled_for: item.scheduledFor ? item.scheduledFor.toISOString() : new Date().toISOString(),
        organization_id: organizationId,
        campaign_id: item.campaignId ?? null,
      },
    ])
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      const { data: existing } = await supabaseAdmin
        .from('outreach_queue')
        .select('*')
        .eq('lead_id', item.leadId)
        .in('status', ['pending', 'locked'])
        .maybeSingle();
      if (existing) return existing;
    }
    console.error('Failed to add to outreach queue:', error);
    throw error;
  }
  
  // Log the queued event
  await logEvent(item.leadId, data.id, 'queued', null, { target: item.targetEmail });
  
  return data;
}

/**
 * Processes pending items using an atomic-like claim to prevent duplicate sends.
 */
export async function processQueue(batchSize = 10) {
  const configuredDailyLimit = Number.parseInt(process.env.OUTREACH_DAILY_LIMIT || '30', 10);
  const dailyLimit = Number.isFinite(configuredDailyLimit) ? Math.max(1, Math.min(configuredDailyLimit, 1000)) : 30;
  const safeBatchSize = Math.max(1, Math.min(batchSize, 50));

  const { data: lockedItems, error: lockError } = await supabaseAdmin
    .rpc('claim_outreach_queue', { batch_limit: safeBatchSize, daily_limit: dailyLimit });

  if (lockError || !lockedItems || lockedItems.length === 0) {
    console.log('Failed to lock or items were claimed by another worker.');
    return { processed: 0 };
  }

  // 3. Process the successfully locked items
  for (const item of lockedItems) {
    try {
      const targetEmail = item.target_email;

      if (!targetEmail) {
        await markQueueFailed(item.id, item.lead_id, item.attempt_count, 'No target email stored for queue item');
        continue;
      }

      const { data: lead } = await supabaseAdmin
        .from('leads')
        .select('status, business_name')
        .eq('id', item.lead_id)
        .maybeSingle();

      if (!lead || ['replied', 'unsubscribed', 'bounced', 'suppressed', 'rejected'].includes(lead.status)) {
        await skipQueueItem(item.id, item.lead_id, `Lead status is ${lead?.status ?? 'missing'}; outreach stopped`);
        continue;
      }

      // Just-in-time suppression check
      if (await isSuppressed(targetEmail)) {
        await markQueueFailed(
          item.id,
          item.lead_id,
          item.attempt_count,
          'Email became suppressed before sending',
          { retry: false, terminalLeadStatus: 'suppressed' },
        );
        continue;
      }
      
      await logEvent(item.lead_id, item.id, 'sending');

      const outboundMessageId = `<outreach-${item.id}@aurionstack.dev>`;
      const { error: reservationError } = await supabaseAdmin
        .from('outreach_queue')
        .update({ provider_message_id: outboundMessageId, provider: 'smtp', updated_at: new Date().toISOString() })
        .eq('id', item.id)
        .eq('status', 'locked');
      if (reservationError) {
        await markQueueFailed(item.id, item.lead_id, item.attempt_count, 'Could not reserve provider message ID');
        continue;
      }

      // Fetch tenant SMTP config
      const { data: orgSettings } = await supabaseAdmin
        .from('organization_settings')
        .select('smtp_host, smtp_port, smtp_user, smtp_password, from_email, from_name, postal_address')
        .eq('organization_id', item.organization_id)
        .single();

      if (
        !orgSettings ||
        !orgSettings.smtp_host ||
        !orgSettings.smtp_user ||
        !orgSettings.smtp_password ||
        !orgSettings.postal_address?.trim()
      ) {
        const missing = [
          !orgSettings?.smtp_host ? 'SMTP host' : null,
          !orgSettings?.smtp_user ? 'SMTP user' : null,
          !orgSettings?.smtp_password ? 'SMTP password' : null,
          !orgSettings?.postal_address?.trim() ? 'physical postal address' : null,
        ].filter(Boolean).join(', ');
        await markQueueFailed(
          item.id,
          item.lead_id,
          item.attempt_count,
          `Organization sender configuration incomplete: ${missing}`,
          { retry: false },
        );
        continue;
      }

      const smtpConfig = {
        host: orgSettings.smtp_host,
        port: orgSettings.smtp_port || 465,
        user: orgSettings.smtp_user,
        pass: orgSettings.smtp_password,
        fromEmail: orgSettings.from_email || orgSettings.smtp_user,
        fromName: orgSettings.from_name,
        replyTo: process.env.EMAIL_REPLY_TO || orgSettings.from_email || orgSettings.smtp_user,
        postalAddress: orgSettings.postal_address,
      };

      // Send Email using the snapshot!
      const result = await sendOutreachEmail({
        to: targetEmail,
        subject: item.subject,
        html: item.body_html,
        text: item.body_text,
        messageId: outboundMessageId,
        unsubscribeUrl: item.unsubscribe_url || undefined,
      }, smtpConfig);

      if (result.success) {
        // Mark as sent
        await supabaseAdmin
          .from('outreach_queue')
          .update({ 
            status: 'sent', 
            sent_at: new Date().toISOString(),
            provider_message_id: result.messageId,
            updated_at: new Date().toISOString() 
          })
          .eq('id', item.id);

        await logEvent(item.lead_id, item.id, 'sent', result.messageId);

        // Update lead lifecycle status
        await supabaseAdmin
          .from('leads')
          .update({ status: 'contacted' })
          .eq('id', item.lead_id)
          .in('status', ['approved', 'contacted']);

        try {
          await scheduleNextCampaignFollowUp(item, lead.business_name || 'your team');
        } catch (followUpError: unknown) {
          const message = followUpError instanceof Error ? followUpError.message : 'Unknown follow-up scheduling error';
          console.error(`[outreach] Email ${item.id} sent, but its next follow-up could not be scheduled:`, message);
          await logEvent(item.lead_id, item.id, 'follow_up_scheduling_failed', result.messageId, { error: message });
        }

      } else {
        await markQueueFailed(item.id, item.lead_id, item.attempt_count, result.error?.toString() || 'Unknown provider error');
      }
      
    } catch (error: unknown) {
       await markQueueFailed(item.id, item.lead_id, item.attempt_count, error instanceof Error ? error.message : 'Unexpected crash');
    }
  }

  return { processed: lockedItems.length };
}

async function scheduleNextCampaignFollowUp(
  item: { campaign_id?: string | null; id: string; lead_id: string; subject: string; target_email: string; unsubscribe_url?: string | null; organization_id: string },
  businessName: string,
) {
  const firstId = campaignSequenceId('initial');
  const firstFollowUpId = campaignSequenceId(1);
  const currentStep = item.campaign_id === firstId ? 0 : item.campaign_id === firstFollowUpId ? 1 : null;
  if (currentStep === null) return;

  const next = ACTIVE_CAMPAIGN.followUps[currentStep];
  if (!next) return;

  const body = next.step === 1
    ? `Hi — just following up on my note about recovering enquiries that do not get booked. If missed calls or slow form responses are a problem at ${businessName}, I can show you a simple SMS and email response flow. Would a short walkthrough be useful?`
    : `Last note from me — AurionStack Lead Recovery helps turn unbooked inbound enquiries into scheduled conversations without replacing your existing tools. Should I send a one-page outline, or close the loop?`;
  const unsubscribeLink = item.unsubscribe_url || '';
  const scheduledFor = new Date(Date.now() + next.delayDays * 24 * 60 * 60 * 1000);

  await addToQueue({
    leadId: item.lead_id,
    subject: `Re: ${item.subject.replace(/^Re:\s*/i, '')}`,
    bodyText: buildOutreachText({ businessName, body, unsubscribeLink }),
    bodyHtml: buildOutreachHtml({ businessName, body, unsubscribeLink }),
    targetEmail: item.target_email,
    unsubscribeUrl: unsubscribeLink,
    scheduledFor,
    campaignId: campaignSequenceId(next.step),
  }, item.organization_id);
}

async function skipQueueItem(queueId: string, leadId: string, reason: string) {
  await supabaseAdmin
    .from('outreach_queue')
    .update({ status: 'failed', error_message: reason, locked_at: null, locked_by: null, updated_at: new Date().toISOString() })
    .eq('id', queueId)
    .eq('status', 'locked');
  await logEvent(leadId, queueId, 'skipped', null, { reason });
}

async function markQueueFailed(
  queueId: string,
  leadId: string,
  attemptCount: number,
  errorMessage: string,
  options: { retry?: boolean; terminalLeadStatus?: 'rejected' | 'suppressed' } = {},
) {
  const retry = options.retry ?? true;
  const shouldRetry = retry && attemptCount < 3;
  const retryDelayMinutes = Math.min(60, 5 * Math.pow(2, Math.max(0, attemptCount - 1)));
  await supabaseAdmin
    .from('outreach_queue')
    .update({ 
      status: shouldRetry ? 'pending' : 'failed',
      error_message: errorMessage,
      scheduled_for: shouldRetry ? new Date(Date.now() + retryDelayMinutes * 60_000).toISOString() : undefined,
      locked_at: null,
      locked_by: null,
      provider_message_id: shouldRetry ? null : undefined,
      updated_at: new Date().toISOString() 
    })
    .eq('id', queueId)
    .eq('status', 'locked');
    
  await logEvent(leadId, queueId, shouldRetry ? 'deferred' : 'failed', null, { error: errorMessage, attemptCount });

  if (!shouldRetry && options.terminalLeadStatus) {
    await supabaseAdmin
      .from('leads')
      .update({ status: options.terminalLeadStatus })
      .eq('id', leadId)
      .eq('status', 'approved');
  }
}

export async function logEvent(leadId: string, queueId: string | null, eventType: string, providerMsgId?: string | null, metadata?: Record<string, unknown>) {
  await supabaseAdmin
    .from('email_events')
    .insert([{
      lead_id: leadId,
      queue_id: queueId,
      event_type: eventType,
      provider_message_id: providerMsgId,
      provider_payload: metadata
    }]);
}
