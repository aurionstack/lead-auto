// ============================================================
// lib/email/queue.ts
// ============================================================
import { supabaseAdmin } from '../supabase';
import { sendOutreachEmail } from './provider';
import { isSuppressed } from './suppression';

export interface QueueItem {
  leadId: string;
  subject: string;
  bodyText: string;
  bodyHtml: string;
  targetEmail: string; // The email we resolved
  unsubscribeUrl: string;
  scheduledFor?: Date;
}

/**
 * Adds an approved lead's email snapshot to the queue.
 */
export async function addToQueue(item: QueueItem) {
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

      // Just-in-time suppression check
      if (await isSuppressed(targetEmail)) {
        await markQueueFailed(item.id, item.lead_id, item.attempt_count, 'Email became suppressed before sending', false);
        continue;
      }
      
      await logEvent(item.lead_id, item.id, 'sending');

      const outboundMessageId = `<outreach-${item.id}@${(process.env.EMAIL_FROM || 'localhost').split('@').pop()}>`;
      const { error: reservationError } = await supabaseAdmin
        .from('outreach_queue')
        .update({ provider_message_id: outboundMessageId, provider: 'smtp', updated_at: new Date().toISOString() })
        .eq('id', item.id)
        .eq('status', 'locked');
      if (reservationError) {
        await markQueueFailed(item.id, item.lead_id, item.attempt_count, 'Could not reserve provider message ID');
        continue;
      }

      // Send Email using the snapshot!
      const result = await sendOutreachEmail({
        to: targetEmail,
        subject: item.subject,
        html: item.body_html,
        text: item.body_text,
        messageId: outboundMessageId,
        unsubscribeUrl: item.unsubscribe_url || undefined,
      });

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
          .eq('id', item.lead_id);

      } else {
        await markQueueFailed(item.id, item.lead_id, item.attempt_count, result.error?.toString() || 'Unknown provider error');
      }
      
    } catch (error: unknown) {
       await markQueueFailed(item.id, item.lead_id, item.attempt_count, error instanceof Error ? error.message : 'Unexpected crash');
    }
  }

  return { processed: lockedItems.length };
}

async function markQueueFailed(queueId: string, leadId: string, attemptCount: number, errorMessage: string, retry = true) {
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
    .eq('id', queueId);
    
  await logEvent(leadId, queueId, shouldRetry ? 'deferred' : 'failed', null, { error: errorMessage, attemptCount });

  if (!shouldRetry) {
    await supabaseAdmin
      .from('leads')
      .update({ status: retry ? 'rejected' : 'suppressed' })
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
