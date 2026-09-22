import { createHmac, timingSafeEqual } from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { classifyRevQrIntent } from './automation';

export function verifyWhatsAppSignature(rawBody: string, signature: string | null) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !signature?.startsWith('sha256=')) return false;
  const expected = Buffer.from(createHmac('sha256', secret).update(rawBody).digest('hex'));
  const received = Buffer.from(signature.slice(7));
  return expected.length === received.length && timingSafeEqual(expected, received);
}

type WebhookPayload = { entry?: Array<{ changes?: Array<{ value?: { metadata?: { phone_number_id?: string }; contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>; messages?: Array<{ id?: string; from?: string; timestamp?: string; type?: string; text?: { body?: string }; image?: { id?: string; mime_type?: string } }>; statuses?: Array<{ id?: string; status?: string; timestamp?: string }> } }> }> };

function googleReviewUrl(body: string) {
  const urls = body.match(/https:\/\/[^\s]+/gi) || [];
  return urls.find((candidate) => { try { const host = new URL(candidate).hostname.toLowerCase(); return host === 'g.page' || host.endsWith('google.com') || host.endsWith('goo.gl'); } catch { return false; } }) || null;
}

export async function ingestWhatsAppWebhook(payload: WebhookPayload) {
  let inbound = 0;
  let statusUpdates = 0;
  for (const entry of payload.entry || []) for (const change of entry.changes || []) {
    const value = change.value;
    const phoneNumberId = value?.metadata?.phone_number_id;
    if (!phoneNumberId) continue;
    const { data: campaign } = await supabaseAdmin.from('revqr_campaigns').select('*').eq('phone_number_id', phoneNumberId).maybeSingle();
    if (!campaign) continue;

    for (const status of value?.statuses || []) {
      if (!status.id || !['sent', 'delivered', 'read', 'failed'].includes(status.status || '')) continue;
      await supabaseAdmin.from('revqr_messages').update({ status: status.status, provider_payload: status }).eq('organization_id', campaign.organization_id).eq('provider_message_id', status.id);
      statusUpdates += 1;
    }

    for (const message of value?.messages || []) {
      if (!message.id || !message.from) continue;
      const body = message.text?.body?.trim() || '';
      const intent = classifyRevQrIntent(body);
      const contactName = value?.contacts?.find((contact) => contact.wa_id === message.from)?.profile?.name || null;
      const now = message.timestamp ? new Date(Number(message.timestamp) * 1000) : new Date();
      const windowExpires = new Date(now.getTime() + 24 * 3_600_000).toISOString();

      const { data: existing } = await supabaseAdmin.from('revqr_prospects').select('id,business_name').eq('organization_id', campaign.organization_id).eq('phone_e164', message.from).maybeSingle();
      const prospectPayload = { organization_id: campaign.organization_id, phone_e164: message.from, business_name: existing?.business_name || contactName, consent_status: intent === 'stop' ? 'revoked' : 'inbound', consent_source: 'Inbound WhatsApp message', consent_recorded_at: now.toISOString(), status: intent === 'stop' ? 'do_not_contact' : 'replied' };
      const { data: prospect, error: prospectError } = await supabaseAdmin.from('revqr_prospects').upsert(prospectPayload, { onConflict: 'organization_id,phone_e164' }).select('id,business_name').single();
      if (prospectError || !prospect) throw prospectError || new Error('Unable to persist RevQR prospect');
      const { data: conversation, error: conversationError } = await supabaseAdmin.from('revqr_conversations').upsert({ organization_id: campaign.organization_id, campaign_id: campaign.id, prospect_id: prospect.id, status: intent === 'stop' ? 'opted_out' : 'open', last_inbound_at: now.toISOString(), service_window_expires_at: windowExpires }, { onConflict: 'campaign_id,prospect_id' }).select('id').single();
      if (conversationError || !conversation) throw conversationError || new Error('Unable to persist RevQR conversation');
      const supportedType = ['text', 'image', 'video', 'document', 'interactive'].includes(message.type || '') ? message.type : 'text';
      const { error: messageError } = await supabaseAdmin.from('revqr_messages').insert({ organization_id: campaign.organization_id, campaign_id: campaign.id, conversation_id: conversation.id, prospect_id: prospect.id, direction: 'inbound', message_type: supportedType, intent, body, provider_message_id: message.id, status: 'received', provider_payload: message });
      if (messageError?.code === '23505') continue;
      if (messageError) throw messageError;

      const reviewUrl = googleReviewUrl(body);
      const logoMediaId = message.type === 'image' ? message.image?.id || null : null;
      let onboardingReady = false;
      if (reviewUrl || logoMediaId) {
        const { data: currentOnboarding } = await supabaseAdmin.from('revqr_onboarding').select('id,logo_media_id,google_review_url,status').eq('campaign_id', campaign.id).eq('prospect_id', prospect.id).maybeSingle();
        const onboardingPayload = { organization_id: campaign.organization_id, campaign_id: campaign.id, conversation_id: conversation.id, prospect_id: prospect.id, logo_media_id: logoMediaId || currentOnboarding?.logo_media_id || null, google_review_url: reviewUrl || currentOnboarding?.google_review_url || null };
        const { data: onboarding, error: onboardingError } = await supabaseAdmin.from('revqr_onboarding').upsert(onboardingPayload, { onConflict: 'campaign_id,prospect_id' }).select('*').single();
        if (onboardingError) throw onboardingError;
        if (onboarding.logo_media_id && onboarding.google_review_url && onboarding.status !== 'completed') {
          onboardingReady = true;
          await supabaseAdmin.from('revqr_onboarding').update({ status: 'pending' }).eq('id', onboarding.id);
          const { data: existingJob } = await supabaseAdmin.from('revqr_jobs').select('id').eq('conversation_id', conversation.id).eq('job_type', 'onboarding').in('status', ['paused', 'pending', 'locked', 'completed']).limit(1).maybeSingle();
          if (!existingJob) await supabaseAdmin.from('revqr_jobs').insert({ organization_id: campaign.organization_id, campaign_id: campaign.id, conversation_id: conversation.id, prospect_id: prospect.id, job_type: 'onboarding', payload: {}, status: campaign.status === 'active' ? 'pending' : 'paused', scheduled_for: new Date().toISOString() });
        }
      }

      if (intent === 'stop') {
        await supabaseAdmin.from('revqr_jobs').update({ status: 'cancelled', error_message: 'Recipient opted out' }).eq('prospect_id', prospect.id).in('status', ['paused', 'pending']);
        await supabaseAdmin.from('revqr_events').insert({ organization_id: campaign.organization_id, campaign_id: campaign.id, prospect_id: prospect.id, conversation_id: conversation.id, event_type: 'opted_out' });
      } else if (!onboardingReady) {
        await supabaseAdmin.from('revqr_jobs').update({ status: 'cancelled', error_message: 'Replaced after a newer inbound reply' }).eq('conversation_id', conversation.id).eq('job_type', 'follow_up').in('status', ['paused', 'pending']);
        await supabaseAdmin.from('revqr_jobs').insert({ organization_id: campaign.organization_id, campaign_id: campaign.id, conversation_id: conversation.id, prospect_id: prospect.id, job_type: 'auto_reply', payload: { intent }, status: campaign.status === 'active' ? 'pending' : 'paused', scheduled_for: new Date().toISOString() });
      }
      inbound += 1;
    }
  }
  return { inbound, statusUpdates };
}
