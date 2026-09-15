export const youtubeCreatorStatuses = [
  'discovered', 'qualified', 'rejected', 'contacted', 'replied', 'positive_reply',
  'sample_requested', 'sample_sent', 'client', 'unsubscribed',
] as const;

export type YouTubeCreatorStatus = (typeof youtubeCreatorStatuses)[number];
export type YouTubeCampaignStatus = 'paused' | 'active' | 'completed';

export interface YouTubeCreator {
  id: string;
  organization_id: string;
  channel_id: string;
  handle: string | null;
  channel_name: string;
  channel_url: string;
  subscriber_count: number | null;
  country: string | null;
  language: string | null;
  business_email: string | null;
  email_source: string | null;
  long_form_score: number | null;
  shorts_usage_score: number | null;
  opportunity_score: number | null;
  qualification_reason: string | null;
  status: YouTubeCreatorStatus;
  latest_video_title: string | null;
  latest_video_url: string | null;
  last_contacted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface YouTubeCampaign {
  id?: string;
  organization_id?: string;
  name: string;
  status: YouTubeCampaignStatus;
  daily_discovery_target: number;
  daily_limit: number;
  subscriber_min: number;
  subscriber_max: number;
  countries: string[];
  languages: string[];
  niches: string[];
  require_long_form: boolean;
  shorts_usage_rule: string;
  sender_identity: string;
  created_at?: string;
  updated_at?: string;
}

export interface YouTubeDashboardData {
  metrics: Record<'discovered' | 'qualified' | 'contacted' | 'replies' | 'positiveReplies' | 'samplesRequested' | 'clients', number>;
  recentCreators: YouTubeCreator[];
  campaign: YouTubeCampaign;
  databaseReady: boolean;
}

export const DEFAULT_YOUTUBE_CAMPAIGN: YouTubeCampaign = {
  name: 'International creator outreach pilot',
  status: 'paused',
  daily_discovery_target: 25,
  daily_limit: 10,
  subscriber_min: 20_000,
  subscriber_max: 500_000,
  countries: ['United States', 'United Kingdom', 'Canada', 'Australia'],
  languages: ['English'],
  niches: ['Study & productivity', 'Self-improvement', 'Business', 'Technology'],
  require_long_form: true,
  shorts_usage_rule: 'Underuses or inconsistently publishes Shorts',
  sender_identity: 'samir@aurionstack.dev',
};
