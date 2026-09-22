import { supabaseAdmin } from '@/lib/supabase';
import { downloadRevQrMedia, sendRevQrTemplate, sendRevQrText } from './provider';
import type { RevQrCampaign, RevQrIntent } from './types';

const STOP_WORDS = /\b(stop|unsubscribe|remove|cancel|do not contact|don't contact|not interested)\b/i;

export function classifyRevQrIntent(body: string): RevQrIntent {
  if (STOP_WORDS.test(body)) return 'stop';
  if (/\b(price|pricing|cost|charge|how much|1,?499)\b/i.test(body)) return 'pricing';
  if (/\b(pay|payment|buy|purchase|sign up|subscribe)\b/i.test(body)) return 'payment';
  if (/\b(logo|google review link|review link|onboard|setup)\b/i.test(body)) return 'onboarding';
  if (/\b(demo|video|how (does|it)|works?|show me)\b/i.test(body)) return 'demo';
  if (/\b(interested|yes|sure|okay|ok|send it|tell me more)\b/i.test(body)) return 'interested';
  return 'other';
}

function responseFor(intent: RevQrIntent, campaign: RevQrCampaign, businessName?: string | null) {
  const name = businessName?.trim() || 'there';
  if (intent === 'pricing') return { body: `${campaign.offer_text}\n\nThat includes full RevQR access, unlimited scans, review analytics, setup, and the branded stands. Demo: ${campaign.demo_url}`, status: 'interested' } as const;
  if (intent === 'payment') return { body: `Great — you can activate RevQR here: ${campaign.payment_url}\n\nAfter payment, send your logo and Google Review link here and setup will begin automatically.`, status: 'payment_sent' } as const;
  if (intent === 'onboarding') return { body: `Thanks. Please send your business logo and Google Review link in this chat. Once both are received, we'll prepare your RevQR setup and stand artwork.`, status: 'interested' } as const;
  if (intent === 'demo' || intent === 'interested') return { body: `Here is the 30-second RevQR demo: ${campaign.demo_url}\n\n${campaign.offer_text}\n\nIf you'd like to start, reply PAYMENT.`, status: 'demo_sent' } as const;
  return { body: `Hi ${name}! RevQR helps local businesses collect more genuine Google reviews using a branded tabletop QR stand. Here is the quick demo: ${campaign.demo_url}\n\nReply PRICE for the full offer or STOP at any time.`, status: 'demo_sent' } as const;
}

export async function processRevQrJobs(batchSize = 10, organizationId?: string) {
  let jobsQuery = supabaseAdmin
    .from('revqr_jobs')
    .select('*, revqr_campaigns(*), revqr_prospects(business_name,phone_e164,consent_status,status), revqr_conversations(service_window_expires_at,last_inbound_at)')
    .eq('status', 'pending')
    .lte('scheduled_for', new Date().toISOString())
    .order('scheduled_for')
    .limit(Math.max(1, Math.min(batchSize, 25)));
  if (organizationId) jobsQuery = jobsQuery.eq('organization_id', organizationId);
  const { data: jobs, error } = await jobsQuery;
  if (error) throw error;

  let sent = 0;
  let cancelled = 0;
  let failed = 0;
  for (const job of jobs || []) {
    const campaign = job.revqr_campaigns as RevQrCampaign | null;
    const prospect = Array.isArray(job.revqr_prospects) ? job.revqr_prospects[0] : job.revqr_prospects;
    const conversation = Array.isArray(job.revqr_conversations) ? job.revqr_conversations[0] : job.revqr_conversations;
    if (!campaign || campaign.status !== 'active' || !prospect || prospect.consent_status === 'revoked' || prospect.status === 'do_not_contact') {
      await supabaseAdmin.from('revqr_jobs').update({ status: 'cancelled', error_message: 'Campaign inactive or consent unavailable' }).eq('id', job.id).eq('status', 'pending');
      cancelled += 1;
      continue;
    }

    const { count: sentToday } = await supabaseAdmin.from('revqr_messages').select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id).eq('direction', 'outbound').in('status', ['sent', 'delivered', 'read'])
      .gte('created_at', new Date(new Date().setUTCHours(0, 0, 0, 0)).toISOString());
    if ((sentToday || 0) >= campaign.daily_limit) break;

    const { data: locked } = await supabaseAdmin.from('revqr_jobs').update({ status: 'locked', locked_at: new Date().toISOString(), attempt_count: job.attempt_count + 1 })
      .eq('id', job.id).eq('status', 'pending').select('id').maybeSingle();
    if (!locked) continue;

    try {
      let providerMessageId: string;
      let body: string | null = null;
      let messageType: 'text' | 'template' = 'text';
      let nextStatus: string | null = null;
      if (job.job_type === 'onboarding') {
        const webhookUrl = process.env.REVQR_ONBOARDING_WEBHOOK_URL;
        const webhookSecret = process.env.REVQR_ONBOARDING_WEBHOOK_SECRET;
        if (!webhookUrl?.startsWith('https://') || !webhookSecret) throw new Error('RevQR onboarding webhook is not configured');
        const { data: onboarding } = await supabaseAdmin.from('revqr_onboarding').select('*').eq('campaign_id', campaign.id).eq('prospect_id', job.prospect_id).single();
        if (!onboarding?.logo_media_id || !onboarding.google_review_url) throw new Error('Logo and Google Review link are required');
        await supabaseAdmin.from('revqr_onboarding').update({ status: 'processing' }).eq('id', onboarding.id);
        const media = await downloadRevQrMedia(onboarding.logo_media_id);
        const form = new FormData();
        form.set('organization_id', campaign.organization_id);
        form.set('prospect_id', job.prospect_id);
        form.set('business_name', prospect.business_name || 'RevQR customer');
        form.set('phone', prospect.phone_e164);
        form.set('google_review_url', onboarding.google_review_url);
        form.set('logo', new Blob([media.bytes], { type: media.contentType }), 'logo');
        const provisionResponse = await fetch(webhookUrl, { method: 'POST', headers: { authorization: `Bearer ${webhookSecret}` }, body: form, cache: 'no-store' });
        const provisioned = await provisionResponse.json() as { customer_url?: string; qr_asset_url?: string; standee_asset_url?: string; error?: string };
        if (!provisionResponse.ok || !provisioned.customer_url || !provisioned.qr_asset_url || !provisioned.standee_asset_url) throw new Error(provisioned.error || 'RevQR onboarding returned an incomplete result');
        await supabaseAdmin.from('revqr_onboarding').update({ status: 'completed', customer_url: provisioned.customer_url, qr_asset_url: provisioned.qr_asset_url, standee_asset_url: provisioned.standee_asset_url, provider_payload: provisioned }).eq('id', onboarding.id);
        const serviceWindowOpen = conversation?.service_window_expires_at && new Date(conversation.service_window_expires_at).getTime() > Date.now();
        if (!serviceWindowOpen) throw new Error('Onboarding completed, but confirmation requires an approved template outside the service window');
        body = `Your RevQR setup is ready: ${provisioned.customer_url}\n\nQR asset: ${provisioned.qr_asset_url}\nStand artwork: ${provisioned.standee_asset_url}`;
        nextStatus = 'customer';
        providerMessageId = await sendRevQrText(campaign.phone_number_id, prospect.phone_e164, body);
      } else if (job.job_type === 'follow_up') {
        if (!campaign.follow_up_template_name) throw new Error('An approved follow-up template is required outside the service window');
        providerMessageId = await sendRevQrTemplate(campaign.phone_number_id, prospect.phone_e164, campaign.follow_up_template_name, campaign.template_language);
        messageType = 'template';
      } else {
        const serviceWindowOpen = conversation?.service_window_expires_at && new Date(conversation.service_window_expires_at).getTime() > Date.now();
        if (!serviceWindowOpen) throw new Error('Free-form reply blocked outside the 24-hour customer service window');
        const response = responseFor((job.payload?.intent || 'other') as RevQrIntent, campaign, prospect.business_name);
        body = response.body;
        nextStatus = response.status;
        providerMessageId = await sendRevQrText(campaign.phone_number_id, prospect.phone_e164, body);
      }

      const now = new Date().toISOString();
      await supabaseAdmin.from('revqr_messages').insert({ organization_id: campaign.organization_id, campaign_id: campaign.id, conversation_id: job.conversation_id, prospect_id: job.prospect_id, direction: 'outbound', message_type: messageType, intent: job.payload?.intent || job.job_type, body, provider_message_id: providerMessageId, status: 'sent' });
      await supabaseAdmin.from('revqr_conversations').update({ last_outbound_at: now }).eq('id', job.conversation_id);
      if (nextStatus) await supabaseAdmin.from('revqr_prospects').update({ status: nextStatus, last_contacted_at: now }).eq('id', job.prospect_id);
      await supabaseAdmin.from('revqr_jobs').update({ status: 'completed', locked_at: null, error_message: null }).eq('id', job.id);
      await supabaseAdmin.from('revqr_events').insert({ organization_id: campaign.organization_id, campaign_id: campaign.id, prospect_id: job.prospect_id, conversation_id: job.conversation_id, event_type: 'message_sent', metadata: { jobType: job.job_type, providerMessageId } });

      if (job.job_type === 'auto_reply' && campaign.follow_up_template_name && !['payment', 'onboarding'].includes(String(job.payload?.intent || ''))) {
        const scheduledFor = new Date(Date.now() + campaign.follow_up_delay_hours * 3_600_000).toISOString();
        await supabaseAdmin.from('revqr_jobs').insert({ organization_id: campaign.organization_id, campaign_id: campaign.id, conversation_id: job.conversation_id, prospect_id: job.prospect_id, job_type: 'follow_up', payload: {}, status: 'pending', scheduled_for: scheduledFor });
      }
      sent += 1;
    } catch (cause) {
      const attempts = job.attempt_count + 1;
      await supabaseAdmin.from('revqr_jobs').update({ status: attempts >= 3 ? 'failed' : 'pending', locked_at: null, error_message: cause instanceof Error ? cause.message : String(cause), scheduled_for: new Date(Date.now() + 15 * 60_000).toISOString() }).eq('id', job.id);
      failed += 1;
    }
  }
  return { examined: jobs?.length || 0, sent, cancelled, failed };
}
