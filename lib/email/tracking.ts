// ============================================================
// lib/email/tracking.ts
// ============================================================
import { supabaseAdmin } from '../supabase';
import { addSuppression } from './suppression';

export interface WebhookEvent {
  messageId?: string; // Some providers don't send message IDs for all events
  email: string; // Target email
  eventType: 'delivered' | 'bounced' | 'opened' | 'clicked' | 'replied' | 'complained' | 'unsubscribed' | 'failed';
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

async function logYouTubeEvent(event: WebhookEvent) {
  if (!event.messageId) return null;
  const { data: item } = await supabaseAdmin
    .from('youtube_outreach_queue')
    .select('id,creator_id,campaign_id,organization_id')
    .eq('provider_message_id', event.messageId)
    .limit(1)
    .maybeSingle();
  if (!item) return null;

  const terminal = ['delivered', 'bounced', 'complained', 'unsubscribed', 'replied', 'failed'].includes(event.eventType);
  const { data: existing } = terminal
    ? await supabaseAdmin.from('youtube_outreach_events').select('id').eq('queue_id', item.id).eq('event_type', event.eventType).limit(1).maybeSingle()
    : { data: null };
  if (!existing) {
    const { error } = await supabaseAdmin.from('youtube_outreach_events').insert({
      organization_id: item.organization_id,
      campaign_id: item.campaign_id,
      creator_id: item.creator_id,
      queue_id: item.id,
      event_type: event.eventType,
      event_timestamp: event.timestamp.toISOString(),
      provider_payload: { ...event.metadata, providerMessageId: event.messageId },
    });
    if (error) throw error;
  }
  if (['bounced', 'complained', 'unsubscribed'].includes(event.eventType)) {
    await addSuppression(event.email, event.eventType, item.organization_id);
    await supabaseAdmin.from('youtube_creators').update({ status: event.eventType === 'unsubscribed' ? 'unsubscribed' : 'rejected' }).eq('id', item.creator_id);
    await supabaseAdmin.from('youtube_outreach_queue').update({ status: 'cancelled', error_message: `Stopped after ${event.eventType}` }).eq('creator_id', item.creator_id).in('status', ['paused', 'pending', 'locked']);
  }
  if (event.eventType === 'replied') {
    await supabaseAdmin.from('youtube_creators').update({ status: 'replied' }).eq('id', item.creator_id);
    await supabaseAdmin.from('youtube_outreach_queue').update({ status: 'cancelled', error_message: 'Stopped automatically after a reply' }).eq('creator_id', item.creator_id).in('status', ['paused', 'pending', 'locked']);
  }
  if (event.eventType === 'failed') {
    await supabaseAdmin.from('youtube_outreach_queue').update({ status: 'failed', error_message: 'Rejected by email provider' }).eq('id', item.id);
  }
  return { success: true, matched: true, queueId: item.id, tool: 'youtube-outreach' as const };
}

/**
 * Handles incoming webhook events from the email provider.
 */
export async function logEmailEvent(event: WebhookEvent) {
  let leadId: string | null = null;
  let queueId: string | null = null;
  let organizationId: string | null = null;

  // 1. Try to find the associated queue_id or lead_id from the message_id
  if (event.messageId) {
    const { data: queueItem } = await supabaseAdmin
      .from('outreach_queue')
      .select('id, lead_id, organization_id')
      .eq('provider_message_id', event.messageId)
      .limit(1)
      .maybeSingle();

    if (queueItem) {
      queueId = queueItem.id;
      leadId = queueItem.lead_id;
      organizationId = queueItem.organization_id;
    } else {
      const youtubeResult = await logYouTubeEvent(event);
      if (youtubeResult) return youtubeResult;
    }
  }

  // 1b. Resolve from the tenant-owned queue snapshot when a provider omits a message ID.
  if (!leadId) {
    const { data: queueItem } = await supabaseAdmin
      .from('outreach_queue')
      .select('id, lead_id, organization_id')
      .ilike('target_email', event.email)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (queueItem) {
      queueId = queueItem.id;
      leadId = queueItem.lead_id;
      organizationId = queueItem.organization_id;
    }
  }

  // 2. Insert into email_events
  if (leadId && organizationId) {
    const terminalEvent = ['delivered', 'bounced', 'complained', 'unsubscribed', 'replied'].includes(event.eventType);
    let duplicate = false;
    if (terminalEvent && queueId) {
      const { data: existing } = await supabaseAdmin
        .from('email_events')
        .select('id')
        .eq('queue_id', queueId)
        .eq('event_type', event.eventType)
        .limit(1)
        .maybeSingle();
      duplicate = Boolean(existing);
    }

    if (!duplicate) {
      const { error } = await supabaseAdmin
        .from('email_events')
        .insert([{
          lead_id: leadId,
          queue_id: queueId,
          organization_id: organizationId,
          event_type: event.eventType,
          provider_message_id: event.messageId,
          provider_payload: event.metadata,
          event_timestamp: event.timestamp.toISOString()
        }]);
      if (error) throw error;
    }
  } else {
    console.warn(`Could not resolve lead for email event on ${event.email} (type: ${event.eventType})`);
  }

  // 3. Handle suppressions automatically
  if (leadId && organizationId && ['bounced', 'complained', 'unsubscribed'].includes(event.eventType)) {
    await addSuppression(event.email, event.eventType, organizationId);

    if (leadId) {
      // Mark lead as dead based on the event
      const statusUpdate = event.eventType === 'unsubscribed' ? 'unsubscribed' : (event.eventType === 'bounced' ? 'bounced' : 'rejected');
      await supabaseAdmin
        .from('leads')
        .update({ status: statusUpdate })
        .eq('id', leadId);
    }
  }

  // 4. Update lead status if replied
  if (event.eventType === 'replied' && leadId) {
     await supabaseAdmin
      .from('leads')
      .update({ status: 'replied' })
      .eq('id', leadId);

    // Never send a scheduled follow-up after a reply is recorded.
    await supabaseAdmin
      .from('outreach_queue')
      .update({
        status: 'failed',
        error_message: 'Stopped automatically after a reply',
        updated_at: new Date().toISOString(),
      })
      .eq('lead_id', leadId)
      .eq('status', 'pending');
  }

  if (event.eventType === 'failed' && queueId) {
    await supabaseAdmin
      .from('outreach_queue')
      .update({
        status: 'failed',
        error_message: 'Rejected by email provider',
        updated_at: new Date().toISOString(),
      })
      .eq('id', queueId);
  }

  return { success: true, matched: Boolean(leadId && organizationId), queueId };
}
