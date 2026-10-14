import { supabaseAdmin } from '@/lib/supabase';
import { classifySocialPost } from './classifier';
import { prefilterSocialPost } from './filter';
import { fetchRedditPosts, fetchXPosts, sendTelegramLeadAlert } from './providers';
import type { SocialCampaign, SocialPost, SourcePost } from './types';

const MAX_CLASSIFICATIONS_PER_RUN = 5;

async function capturePosts(campaign: SocialCampaign, source: 'reddit' | 'x', posts: SourcePost[], cutoff: string) {
  let inserted = 0;
  for (const post of posts) {
    if (post.createdAt <= cutoff || post.createdAt > new Date().toISOString()) continue;
    const match = prefilterSocialPost(post.title, post.body);
    if (!match) continue;
    const { data, error } = await supabaseAdmin.from('social_monitor_posts').upsert({
      organization_id: campaign.organization_id, campaign_id: campaign.id, platform: source,
      source_id: post.sourceId, source_name: post.sourceName, author_name: post.authorName,
      title: post.title.slice(0, 500), body: post.body.slice(0, 4000), post_url: post.url,
      source_created_at: post.createdAt, category: match.category, matched_keyword: match.keyword,
      status: 'candidate',
    }, { onConflict: 'organization_id,platform,source_id,campaign_id', ignoreDuplicates: true }).select('id');
    if (error) throw error;
    inserted += data?.length || 0;
  }
  return inserted;
}

async function classifyCandidates(campaign: SocialCampaign, geminiKey: string) {
  const { data, error } = await supabaseAdmin.from('social_monitor_posts').select('*')
    .eq('campaign_id', campaign.id).eq('organization_id', campaign.organization_id)
    .eq('status', 'candidate').order('created_at').limit(MAX_CLASSIFICATIONS_PER_RUN);
  if (error) throw error;
  let qualified = 0;
  for (const candidate of (data || []) as SocialPost[]) {
    const { data: claimed, error: claimError } = await supabaseAdmin.from('social_monitor_posts')
      .update({ status: 'classifying' }).eq('id', candidate.id).eq('status', 'candidate').select('id').maybeSingle();
    if (claimError) throw claimError;
    if (!claimed) continue;
    try {
      const result = await classifySocialPost({ platform: candidate.platform, sourceId: candidate.source_id,
        sourceName: candidate.source_name || '', authorName: candidate.author_name, title: candidate.title,
        body: candidate.body, url: candidate.post_url, createdAt: candidate.source_created_at }, candidate.category!, geminiKey);
      const qualifies = result.is_genuine_buyer && result.score >= campaign.score_threshold;
      const { error: updateError } = await supabaseAdmin.from('social_monitor_posts').update({
        status: qualifies ? 'qualified' : 'rejected', score: result.score, budget: result.budget_detected,
        matched_reasons: result.matched_reasons, draft_reply: result.draft_reply, last_error: null,
      }).eq('id', candidate.id).eq('campaign_id', campaign.id).eq('status', 'classifying');
      if (updateError) throw updateError;
      if (qualifies) qualified++;
    } catch (error) {
      await supabaseAdmin.from('social_monitor_posts').update({ status: 'candidate', last_error: error instanceof Error ? error.message.slice(0, 300) : 'Classification failed' }).eq('id', candidate.id).eq('status', 'classifying');
      throw error;
    }
  }
  return qualified;
}

async function notifyQualified(campaign: SocialCampaign) {
  const today = new Date().toISOString().slice(0, 10);
  const { count, error: countError } = await supabaseAdmin.from('social_monitor_posts').select('id', { count: 'exact', head: true })
    .eq('campaign_id', campaign.id).eq('status', 'alerted').gte('alerted_at', `${today}T00:00:00Z`);
  if (countError) throw countError;
  const remaining = Math.max(0, campaign.daily_alert_limit - (count || 0));
  if (!remaining) return 0;
  const { data, error } = await supabaseAdmin.rpc('claim_social_monitor_alerts', { campaign: campaign.id, claim_limit: Math.min(remaining, 5), daily_limit: campaign.daily_alert_limit });
  if (error) throw error;
  let alerted = 0;
  for (const post of (data || []) as SocialPost[]) {
    try {
      const { data: current } = await supabaseAdmin.from('social_monitor_campaigns').select('status').eq('id', campaign.id).maybeSingle();
      if (current?.status !== 'active') {
        await supabaseAdmin.from('social_monitor_posts').update({ status: 'qualified' }).eq('id', post.id).eq('status', 'notifying');
        continue;
      }
      await sendTelegramLeadAlert(campaign.telegram_chat_id, post);
      const { error: updateError } = await supabaseAdmin.from('social_monitor_posts').update({ status: 'alerted', alerted_at: new Date().toISOString(), last_error: null }).eq('id', post.id).eq('status', 'notifying');
      if (updateError) throw updateError;
      alerted++;
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 300) : 'Telegram notification failed';
      await supabaseAdmin.from('social_monitor_posts').update({ status: 'alert_failed', last_error: message }).eq('id', post.id).eq('status', 'notifying');
    }
  }
  return alerted;
}

export async function runSocialMonitor(organizationId?: string) {
  let query = supabaseAdmin.from('social_monitor_campaigns').select('*').eq('status', 'active');
  if (organizationId) query = query.eq('organization_id', organizationId);
  const { data, error } = await query;
  if (error) throw error;
  const summary = { activeCampaigns: data?.length || 0, captured: 0, qualified: 0, alerted: 0, errors: [] as string[] };
  for (const campaign of (data || []) as SocialCampaign[]) {
    const staleAt = new Date(Date.now() - 30 * 60_000).toISOString();
    await supabaseAdmin.from('social_monitor_posts').update({ status: 'candidate', last_error: 'Recovered interrupted classifier' })
      .eq('campaign_id', campaign.id).eq('status', 'classifying').lt('updated_at', staleAt);
    await supabaseAdmin.from('social_monitor_posts').update({ status: 'alert_unknown', last_error: 'Notification outcome unknown after worker interruption; review manually' })
      .eq('campaign_id', campaign.id).eq('status', 'notifying').lt('updated_at', staleAt);
    const { data: settings } = await supabaseAdmin.from('organization_settings').select('gemini_api_key').eq('organization_id', campaign.organization_id).maybeSingle();
    const geminiKey = settings?.gemini_api_key || process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      summary.errors.push(`${campaign.id}: Gemini API key missing`);
      continue;
    }
    const startedAt = new Date().toISOString();
    const errors: string[] = [];
    for (const source of ['reddit', 'x'] as const) {
      if (source === 'reddit' ? !campaign.reddit_enabled : !campaign.x_enabled) continue;
      try {
        const cutoff = (source === 'reddit' ? campaign.reddit_polled_at : campaign.x_polled_at) || startedAt;
        const posts = source === 'reddit' ? await fetchRedditPosts(campaign.subreddits) : await fetchXPosts(campaign.x_query!);
        summary.captured += await capturePosts(campaign, source, posts, cutoff);
        const { error: updateError } = await supabaseAdmin.from('social_monitor_campaigns').update({ [source === 'reddit' ? 'reddit_polled_at' : 'x_polled_at']: startedAt }).eq('id', campaign.id).eq('status', 'active');
        if (updateError) throw updateError;
      } catch (cause) {
        errors.push(`${source}: ${cause instanceof Error ? cause.message : 'Source unavailable'}`);
      }
    }
    try {
      summary.qualified += await classifyCandidates(campaign, geminiKey);
      summary.alerted += await notifyQualified(campaign);
    } catch (cause) {
      errors.push(cause instanceof Error ? cause.message : 'Processing failed');
    }
    const lastError = errors.length ? errors.join('; ').slice(0, 500) : null;
    await supabaseAdmin.from('social_monitor_campaigns').update({ last_error: lastError }).eq('id', campaign.id);
    if (lastError) summary.errors.push(`${campaign.id}: ${lastError}`);
  }
  return summary;
}
