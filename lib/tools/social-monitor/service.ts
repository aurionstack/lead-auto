import { createClient } from '@/lib/supabase-server';
import type { SocialCampaign, SocialPost } from './types';

export async function getSocialMonitorData() {
  const supabase = await createClient();
  const [campaignsResult, postsResult] = await Promise.all([
    supabase.from('social_monitor_campaigns').select('*').order('created_at', { ascending: false }).limit(20),
    supabase.from('social_monitor_posts').select('*').in('status', ['qualified', 'alerted', 'alert_failed', 'alert_unknown']).order('created_at', { ascending: false }).limit(100),
  ]);
  if (campaignsResult.error || postsResult.error) return { databaseReady: false, campaigns: [] as SocialCampaign[], posts: [] as SocialPost[] };
  return { databaseReady: true, campaigns: (campaignsResult.data || []) as SocialCampaign[], posts: (postsResult.data || []) as SocialPost[] };
}

export async function getSocialMonitorHubSummary() {
  const data = await getSocialMonitorData();
  return { prospects: data.posts.length, replies: data.posts.filter((post) => post.status === 'alerted').length,
    active: data.campaigns.some((campaign) => campaign.status === 'active'), databaseReady: data.databaseReady };
}
