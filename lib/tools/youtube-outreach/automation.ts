import { supabaseAdmin } from '@/lib/supabase';
import { getHunterApiKey, verifyEmailWithHunter } from '@/lib/hunter';
import { isSuppressed } from '@/lib/email/suppression';
import { sendOutreachEmail } from '@/lib/email/provider';
import { buildOutreachHtml, buildOutreachText } from '@/lib/email/templates';
import { discoverYouTubeCreators } from './youtube';
import { buildYouTubeUnsubscribeUrl } from './unsubscribe';
import type { YouTubeCampaign } from './types';

type StoredCampaign = YouTubeCampaign & { id: string; organization_id: string };

function selectedNiche(campaign: StoredCampaign) {
  const niches = campaign.niches.length ? campaign.niches : ['creator'];
  const day = Math.floor(Date.now() / 86_400_000);
  return niches[day % niches.length];
}

const DISCOVERY_POOL_MULTIPLIER = 2;

function qualificationFailures(candidate: {
  subscriberCount: number | null;
  country: string | null;
  language: string | null;
  longFormScore: number;
  opportunityScore: number;
}, campaign: StoredCampaign, hasVerifiedEmail: boolean) {
  const failures: string[] = [];
  if (candidate.subscriberCount === null || candidate.subscriberCount < campaign.subscriber_min || candidate.subscriberCount > campaign.subscriber_max) failures.push('subscriber range');
  if (candidate.country && !campaign.countries.some((country) => country.toLowerCase() === candidate.country?.toLowerCase())) failures.push('country');
  if (candidate.language && !campaign.languages.some((language) => language.toLowerCase() === candidate.language?.toLowerCase())) failures.push('language');
  if (campaign.require_long_form && candidate.longFormScore < 60) failures.push('long-form activity');
  if (candidate.opportunityScore < 70) failures.push('opportunity score');
  if (!hasVerifiedEmail) failures.push('verified public email');
  return failures;
}

export async function runYouTubeDiscovery(organizationId?: string) {
  let campaignQuery = supabaseAdmin
    .from('youtube_campaigns')
    .select('*')
    .eq('status', 'active');
  if (organizationId) campaignQuery = campaignQuery.eq('organization_id', organizationId);
  const { data: campaigns, error } = await campaignQuery;
  if (error) throw error;
  if (!campaigns?.length) return { activeCampaigns: 0, discovered: 0, qualified: 0, queued: 0, rejectedByGate: {} };

  let discovered = 0;
  let qualified = 0;
  let queued = 0;
  const rejectedByGate: Record<string, number> = {};
  for (const campaign of campaigns as StoredCampaign[]) {
    const niche = selectedNiche(campaign);
    // Search a wider pool because public business-email availability is sparse.
    // The YouTube API caps one channel search at 50 results.
    const poolSize = Math.min(50, Math.max(campaign.daily_discovery_target, campaign.daily_discovery_target * DISCOVERY_POOL_MULTIPLIER));
    const candidates = await discoverYouTubeCreators(niche, poolSize);
    const { data: settings } = await supabaseAdmin
      .from('organization_settings')
      .select('hunter_api_key')
      .eq('organization_id', campaign.organization_id)
      .maybeSingle();
    const hunterKey = getHunterApiKey(settings?.hunter_api_key);

    for (const candidate of candidates) {
      discovered += 1;
      const { data: existingCreator } = await supabaseAdmin
        .from('youtube_creators')
        .select('id,status,business_email,email_source')
        .eq('organization_id', campaign.organization_id)
        .eq('channel_id', candidate.channelId)
        .maybeSingle();
      let verifiedEmail: string | null = null;
      let emailSource = candidate.emailSource;
      if (candidate.businessEmail && hunterKey) {
        const verification = await verifyEmailWithHunter(candidate.businessEmail, hunterKey);
        if (verification.status === 'valid') {
          verifiedEmail = candidate.businessEmail;
          emailSource = `${candidate.emailSource}; Hunter verified ${verification.verifiedAt}`;
        }
      }
      const failures = qualificationFailures(candidate, campaign, Boolean(verifiedEmail));
      const isQualified = failures.length === 0;
      if (isQualified) qualified += 1;
      else for (const failure of failures) rejectedByGate[failure] = (rejectedByGate[failure] || 0) + 1;
      const advancedStatuses = ['contacted', 'replied', 'positive_reply', 'sample_requested', 'sample_sent', 'client', 'unsubscribed'];
      const preservedStatuses = ['qualified', ...advancedStatuses];
      const lifecycleStatus = existingCreator && preservedStatuses.includes(existingCreator.status)
        ? existingCreator.status
        : isQualified ? 'qualified' : 'rejected';
      const selectedEmail = verifiedEmail || existingCreator?.business_email || null;
      const selectedSource = verifiedEmail ? emailSource : existingCreator?.email_source || null;

      const { data: creator, error: creatorError } = await supabaseAdmin
        .from('youtube_creators')
        .upsert({
          organization_id: campaign.organization_id,
          channel_id: candidate.channelId,
          handle: candidate.handle,
          channel_name: candidate.channelName,
          channel_url: candidate.channelUrl,
          subscriber_count: candidate.subscriberCount,
          country: candidate.country,
          language: candidate.language,
          business_email: selectedEmail,
          email_source: selectedSource,
          long_form_score: candidate.longFormScore,
          shorts_usage_score: candidate.shortsUsageScore,
          opportunity_score: candidate.opportunityScore,
          qualification_reason: isQualified
            ? `${candidate.qualificationReason} All campaign gates passed.`
            : `${candidate.qualificationReason} Failed gates: ${failures.join(', ')}.`,
          status: lifecycleStatus,
          latest_video_title: candidate.latestVideoTitle,
          latest_video_url: candidate.latestVideoUrl,
        }, { onConflict: 'organization_id,channel_id' })
        .select('id, status')
        .single();
      if (creatorError || !creator) throw creatorError || new Error('Creator upsert failed');
      if (!isQualified || !verifiedEmail || advancedStatuses.includes(lifecycleStatus) || await isSuppressed(verifiedEmail)) continue;
      const { data: existingQueue } = await supabaseAdmin
        .from('youtube_outreach_queue')
        .select('id')
        .eq('creator_id', creator.id)
        .eq('campaign_id', campaign.id)
        .limit(1)
        .maybeSingle();
      if (existingQueue) continue;

      const unsubscribeUrl = buildYouTubeUnsubscribeUrl(creator.id);
      const reference = candidate.latestVideoTitle ? `your recent video “${candidate.latestVideoTitle}”` : 'your long-form YouTube content';
      const body = `Hi ${candidate.channelName},\n\nI came across ${reference}. You already have the long-form authority; the opportunity I noticed is turning more of those ideas into consistent Shorts without adding another production workload.\n\nAurionStack helps established creators build that repurposing workflow. Would you be open to a short, specific sample concept based on one of your recent videos?\n\nBest,\nSamir`;
      const { error: queueError } = await supabaseAdmin.from('youtube_outreach_queue').insert({
        organization_id: campaign.organization_id,
        campaign_id: campaign.id,
        creator_id: creator.id,
        recipient_email: verifiedEmail.toLowerCase(),
        subject: `A Shorts idea for ${candidate.channelName}`,
        body_text: buildOutreachText({ businessName: candidate.channelName, body, unsubscribeLink: unsubscribeUrl }),
        body_html: buildOutreachHtml({ businessName: candidate.channelName, body, unsubscribeLink: unsubscribeUrl }),
        status: campaign.status === 'active' ? 'pending' : 'paused',
        scheduled_for: new Date().toISOString(),
      });
      if (queueError && queueError.code !== '23505') throw queueError;
      if (!queueError) {
        queued += 1;
        await supabaseAdmin.from('youtube_outreach_events').insert({
          organization_id: campaign.organization_id, campaign_id: campaign.id, creator_id: creator.id, event_type: 'queued',
        });
      }
    }
  }
  return { activeCampaigns: campaigns.length, discovered, qualified, queued, rejectedByGate };
}

export async function processYouTubeOutreach(organizationId?: string) {
  let campaignQuery = supabaseAdmin.from('youtube_campaigns').select('*').eq('status', 'active');
  if (organizationId) campaignQuery = campaignQuery.eq('organization_id', organizationId);
  const { data: campaigns, error } = await campaignQuery;
  if (error) throw error;
  let processed = 0;
  for (const campaign of (campaigns || []) as StoredCampaign[]) {
    const today = new Date().toISOString().slice(0, 10);
    const { count: sentToday } = await supabaseAdmin
      .from('youtube_outreach_queue')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id)
      .eq('status', 'sent')
      .gte('sent_at', `${today}T00:00:00.000Z`);
    const remaining = Math.max(0, campaign.daily_limit - (sentToday || 0));
    if (!remaining) continue;
    const { data: items } = await supabaseAdmin
      .from('youtube_outreach_queue')
      .select('*, youtube_creators(channel_name,status)')
      .eq('campaign_id', campaign.id)
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .order('scheduled_for')
      .limit(Math.min(remaining, 10));

    const { data: settings } = await supabaseAdmin
      .from('organization_settings')
      .select('smtp_host,smtp_port,smtp_user,smtp_password,from_email,from_name,postal_address')
      .eq('organization_id', campaign.organization_id)
      .maybeSingle();
    if (!settings?.smtp_host || !settings.smtp_user || !settings.smtp_password || !settings.from_email || !settings.postal_address?.trim()) continue;
    if (settings.from_email.toLowerCase() !== campaign.sender_identity.toLowerCase()) continue;

    for (const item of items || []) {
      const creator = Array.isArray(item.youtube_creators) ? item.youtube_creators[0] : item.youtube_creators;
      if (!creator || ['replied', 'positive_reply', 'sample_requested', 'sample_sent', 'client', 'unsubscribed'].includes(creator.status) || await isSuppressed(item.recipient_email)) {
        await supabaseAdmin.from('youtube_outreach_queue').update({ status: 'cancelled', error_message: 'Creator is no longer eligible for outreach' }).eq('id', item.id).eq('status', 'pending');
        continue;
      }
      const { data: locked } = await supabaseAdmin
        .from('youtube_outreach_queue')
        .update({ status: 'locked', locked_at: new Date().toISOString(), locked_by: 'youtube-outreach-cron', attempt_count: item.attempt_count + 1 })
        .eq('id', item.id).eq('status', 'pending').select('id').maybeSingle();
      if (!locked) continue;
      const messageId = `<youtube-${item.id}@aurionstack.dev>`;
      const result = await sendOutreachEmail({
        to: item.recipient_email, subject: item.subject, text: item.body_text, html: item.body_html,
        messageId, unsubscribeUrl: buildYouTubeUnsubscribeUrl(item.creator_id),
      }, {
        host: settings.smtp_host, port: settings.smtp_port || 465, user: settings.smtp_user, pass: settings.smtp_password,
        fromEmail: settings.from_email, fromName: settings.from_name, replyTo: process.env.EMAIL_REPLY_TO || settings.from_email,
        postalAddress: settings.postal_address,
      });
      if (result.success) {
        const sentAt = new Date().toISOString();
        await supabaseAdmin.from('youtube_outreach_queue').update({ status: 'sent', sent_at: sentAt, provider: 'smtp', provider_message_id: result.messageId, locked_at: null, locked_by: null }).eq('id', item.id);
        await supabaseAdmin.from('youtube_creators').update({ status: 'contacted', last_contacted_at: sentAt }).eq('id', item.creator_id).eq('status', 'qualified');
        await supabaseAdmin.from('youtube_outreach_events').insert({ organization_id: campaign.organization_id, campaign_id: campaign.id, creator_id: item.creator_id, queue_id: item.id, event_type: 'sent', provider_payload: { messageId: result.messageId } });
      } else {
        await supabaseAdmin.from('youtube_outreach_queue').update({ status: item.attempt_count + 1 < 3 ? 'pending' : 'failed', error_message: result.error instanceof Error ? result.error.message : String(result.error), locked_at: null, locked_by: null, scheduled_for: new Date(Date.now() + 15 * 60_000).toISOString() }).eq('id', item.id);
      }
      processed += 1;
    }
  }
  return { processed };
}
