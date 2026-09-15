import { createClient } from '@/lib/supabase-server';
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
