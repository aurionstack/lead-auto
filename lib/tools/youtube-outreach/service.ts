import { createClient } from '@/lib/supabase-server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_YOUTUBE_CAMPAIGN, type YouTubeCampaign, type YouTubeCreator, type YouTubeCreatorStatus, type YouTubeDashboardData } from './types';

function countStatus(creators: YouTubeCreator[], statuses: YouTubeCreatorStatus[]) {
  return creators.filter((creator) => statuses.includes(creator.status)).length;
}

export async function getYouTubeCreators(statuses?: YouTubeCreatorStatus[]): Promise<{ creators: YouTubeCreator[]; databaseReady: boolean }> {
  const supabase = await createClient();
  let query = supabase.from('youtube_creators').select('*').order('created_at', { ascending: false }).limit(250);
  if (statuses?.length) query = query.in('status', statuses);
  const { data, error } = await query;
  if (error) {
    console.warn('[youtube-outreach] Creator table unavailable:', error.message);
    return { creators: [], databaseReady: false };
  }
  return { creators: (data ?? []) as YouTubeCreator[], databaseReady: true };
}

export async function getYouTubeCampaign(): Promise<{ campaign: YouTubeCampaign; databaseReady: boolean }> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('youtube_campaigns').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) {
    console.warn('[youtube-outreach] Campaign table unavailable:', error.message);
    return { campaign: DEFAULT_YOUTUBE_CAMPAIGN, databaseReady: false };
  }
  return { campaign: data ? (data as YouTubeCampaign) : DEFAULT_YOUTUBE_CAMPAIGN, databaseReady: true };
}

export async function getYouTubeDashboardData(): Promise<YouTubeDashboardData> {
  const [{ creators, databaseReady: creatorsReady }, campaignResult] = await Promise.all([
    getYouTubeCreators(),
    getYouTubeCampaign(),
  ]);
  return {
    metrics: {
      discovered: creators.length,
      qualified: countStatus(creators, ['qualified']),
      contacted: countStatus(creators, ['contacted', 'replied', 'positive_reply', 'sample_requested', 'sample_sent', 'client']),
      replies: countStatus(creators, ['replied', 'positive_reply', 'sample_requested', 'sample_sent', 'client']),
      positiveReplies: countStatus(creators, ['positive_reply', 'sample_requested', 'sample_sent', 'client']),
      samplesRequested: countStatus(creators, ['sample_requested', 'sample_sent', 'client']),
      clients: countStatus(creators, ['client']),
    },
    recentCreators: creators.slice(0, 8),
    campaign: campaignResult.campaign,
    databaseReady: creatorsReady && campaignResult.databaseReady,
  };
}

export async function getYouTubeHubSummary() {
  const [{ creators, databaseReady: creatorsReady }, { campaign, databaseReady: campaignReady }] = await Promise.all([
    getYouTubeCreators(),
    getYouTubeCampaign(),
  ]);
  return {
    creators: creators.length,
    replies: countStatus(creators, ['replied', 'positive_reply', 'sample_requested', 'sample_sent', 'client']),
    active: campaignReady && campaign.status === 'active',
    databaseReady: creatorsReady && campaignReady,
  };
}

export interface YouTubeTenantReadContext {
  supabase: SupabaseClient;
  organizationId: string;
}

export async function getYouTubeStatus(context: YouTubeTenantReadContext) {
  const [creatorsResult, campaignsResult, queueResult] = await Promise.all([
    context.supabase.from('youtube_creators').select('status, updated_at').eq('organization_id', context.organizationId),
    context.supabase.from('youtube_campaigns').select('id, name, status, daily_discovery_target, daily_limit, updated_at').eq('organization_id', context.organizationId).order('created_at', { ascending: false }),
    context.supabase.from('youtube_outreach_queue').select('status, updated_at').eq('organization_id', context.organizationId),
  ]);
  const failed = [creatorsResult, campaignsResult, queueResult].find((result) => result.error);
  if (failed?.error) return { databaseReady: false, active: false, campaigns: [], creatorCounts: {}, queueCounts: {}, lastActivityAt: null };
  const countBy = (rows: { status: string }[]) => rows.reduce<Record<string, number>>((counts, row) => {
    counts[row.status] = (counts[row.status] ?? 0) + 1;
    return counts;
  }, {});
  const creators = creatorsResult.data ?? [];
  const campaigns = campaignsResult.data ?? [];
  const queue = queueResult.data ?? [];
  const activity = [...creators.map((row) => row.updated_at), ...campaigns.map((row) => row.updated_at), ...queue.map((row) => row.updated_at)].filter(Boolean).sort().at(-1) ?? null;
  return {
    databaseReady: true,
    active: campaigns.some((campaign) => campaign.status === 'active'),
    campaigns,
    creatorCounts: countBy(creators),
    queueCounts: countBy(queue),
    lastActivityAt: activity,
  };
}

export async function listYouTubeCreators(
  context: YouTubeTenantReadContext,
  input: { statuses?: YouTubeCreatorStatus[]; minScore?: number; limit: number },
) {
  let query = context.supabase
    .from('youtube_creators')
    .select('id, channel_id, handle, channel_name, channel_url, subscriber_count, country, language, business_email, email_source, long_form_score, shorts_usage_score, opportunity_score, qualification_reason, status, latest_video_title, latest_video_url, last_contacted_at, created_at, updated_at')
    .eq('organization_id', context.organizationId)
    .order('opportunity_score', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(input.limit);
  if (input.statuses?.length) query = query.in('status', input.statuses);
  if (typeof input.minScore === 'number') query = query.gte('opportunity_score', input.minScore);
  const { data, error } = await query;
  if (error) throw new Error('YouTube creators could not be loaded. Apply migration 010 if it is not installed.');
  return data ?? [];
}

export async function getYouTubeReplies(context: YouTubeTenantReadContext, limit: number) {
  const { data, error } = await context.supabase
    .from('youtube_creators')
    .select('id, channel_id, handle, channel_name, channel_url, business_email, status, last_contacted_at, updated_at')
    .eq('organization_id', context.organizationId)
    .in('status', ['replied', 'positive_reply', 'sample_requested', 'sample_sent', 'client'])
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error('YouTube replies could not be loaded. Apply migration 010 if it is not installed.');
  return data ?? [];
}

export async function getYouTubeStats(context: YouTubeTenantReadContext) {
  const { data, error } = await context.supabase
    .from('youtube_creators')
    .select('status')
    .eq('organization_id', context.organizationId);
  if (error) throw new Error('YouTube statistics could not be loaded. Apply migration 010 if it is not installed.');
  const creators = data ?? [];
  const withStatus = (...statuses: string[]) => creators.filter((creator) => statuses.includes(creator.status)).length;
  return {
    discovered: creators.length,
    qualified: withStatus('qualified'),
    contacted: withStatus('contacted', 'replied', 'positive_reply', 'sample_requested', 'sample_sent', 'client'),
    replies: withStatus('replied', 'positive_reply', 'sample_requested', 'sample_sent', 'client'),
    positiveReplies: withStatus('positive_reply', 'sample_requested', 'sample_sent', 'client'),
    samplesRequested: withStatus('sample_requested', 'sample_sent', 'client'),
    clients: withStatus('client'),
  };
}
