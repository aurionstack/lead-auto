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
        status: 'pending',
        scheduled_for: item.scheduledFor ? item.scheduledFor.toISOString() : new Date().toISOString(),
      },
    ])
    .select()
    .single();

  if (error) {
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
  // 1. Fetch IDs of pending items
  const { data: candidates, error: fetchError } = await supabaseAdmin
    .from('outreach_queue')
    .select('id')
    .eq('status', 'pending')
    .lte('scheduled_for', new Date().toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(batchSize);

  if (fetchError) {
    console.error('Failed to fetch outreach queue candidates:', fetchError);
    return;
  }

  if (!candidates || candidates.length === 0) {
    return { processed: 0 };
  }

  const candidateIds = candidates.map(c => c.id);

  // 2. Atomically lock these specific IDs (only if they are STILL pending)
  const lockedBy = `worker-${Math.random().toString(36).substring(7)}`;
  const { data: lockedItems, error: lockError } = await supabaseAdmin
    .from('outreach_queue')
    .update({ 
      status: 'locked', 
      locked_at: new Date().toISOString(),
      locked_by: lockedBy
    })
    .in('id', candidateIds)
    .eq('status', 'pending')
    .select('id, lead_id, subject, body_text, body_html, attempt_count');

  if (lockError || !lockedItems || lockedItems.length === 0) {
    console.log('Failed to lock or items were claimed by another worker.');
    return { processed: 0 };
  }

  // 3. Process the successfully locked items
  for (const item of lockedItems) {
    try {
      // Re-fetch email from the leads table
      const { data: leadData } = await supabaseAdmin
        .from('leads')
        .select('email')
        .eq('id', item.lead_id)
        .single();

      let targetEmail = leadData?.email || null;

      if (!targetEmail) {
        await markQueueFailed(item.id, item.lead_id, 'No email found for lead');
        continue;
      }

      // Just-in-time suppression check
      if (await isSuppressed(targetEmail)) {
        await markQueueFailed(item.id, item.lead_id, 'Email became suppressed before sending');
        continue;
      }
      
      await logEvent(item.lead_id, item.id, 'sending');

      // Send Email using the snapshot!
      const result = await sendOutreachEmail({
        to: targetEmail,
        subject: item.subject,
        html: item.body_html,
        text: item.body_text
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
        await markQueueFailed(item.id, item.lead_id, result.error?.toString() || 'Unknown provider error');
      }
      
    } catch (err: any) {
       await markQueueFailed(item.id, item.lead_id, err.message || 'Unexpected crash');
    }
  }

  return { processed: lockedItems.length };
}

async function markQueueFailed(queueId: string, leadId: string, errorMessage: string) {
  await supabaseAdmin
    .from('outreach_queue')
    .update({ 
      status: 'failed', 
      error_message: errorMessage,
      updated_at: new Date().toISOString() 
    })
    .eq('id', queueId);
    
  await logEvent(leadId, queueId, 'failed', null, { error: errorMessage });
}

export async function logEvent(leadId: string, queueId: string | null, eventType: string, providerMsgId?: string | null, metadata?: any) {
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
