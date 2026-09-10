// ============================================================
// lib/email/tracking.ts
// ============================================================
import { supabaseAdmin } from '../supabase';
import { addSuppression } from './suppression';

export interface WebhookEvent {
  messageId?: string; // Some providers don't send message IDs for all events
  email: string; // Target email
  eventType: 'delivered' | 'bounced' | 'opened' | 'clicked' | 'replied' | 'complained' | 'unsubscribed';
  timestamp: Date;
  metadata?: any;
}

/**
 * Handles incoming webhook events from the email provider.
 */
export async function logEmailEvent(event: WebhookEvent) {
  let leadId = null;
  let queueId = null;

  // 1. Try to find the associated queue_id or lead_id from the message_id
  if (event.messageId) {
    const { data: queueItem } = await supabaseAdmin
      .from('outreach_queue')
      .select('id, lead_id')
      .eq('provider_message_id', event.messageId)
      .limit(1)
      .maybeSingle();

    if (queueItem) {
      queueId = queueItem.id;
      leadId = queueItem.lead_id;
    }
  }

  // 1b. Fallback: try finding lead by email in enrichment table if no message ID matched
  if (!leadId) {
    const { data: enrichmentItems } = await supabaseAdmin
      .from('leads_enrichment')
      .select('lead_id, discovered_emails')
      .limit(10); // A naive fallback search; in production, you'd index emails directly.

    if (enrichmentItems) {
      const match = enrichmentItems.find((e: any) => 
        Array.isArray(e.discovered_emails) && 
        e.discovered_emails.some((em: any) => em.email === event.email)
      );
      if (match) leadId = match.lead_id;
    }
  }

  // 2. Insert into email_events
  if (leadId) {
    await supabaseAdmin
      .from('email_events')
      .insert([{
        lead_id: leadId,
        queue_id: queueId,
        event_type: event.eventType,
        provider_message_id: event.messageId,
        provider_payload: event.metadata,
        event_timestamp: event.timestamp.toISOString()
      }]);
  } else {
    console.warn(`Could not resolve lead for email event on ${event.email} (type: ${event.eventType})`);
  }

  // 3. Handle suppressions automatically
  if (['bounced', 'complained', 'unsubscribed'].includes(event.eventType)) {
    await addSuppression(event.email, event.eventType);

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
  }

  return { success: true };
}
