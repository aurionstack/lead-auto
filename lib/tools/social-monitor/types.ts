export type SocialPlatform = 'reddit' | 'x';
export type SocialCategory = 'Web Dev' | 'AI Automation' | 'Video Editing';

export interface SocialCampaign {
  id: string;
  organization_id: string;
  name: string;
  status: 'paused' | 'active';
  reddit_enabled: boolean;
  x_enabled: boolean;
  subreddits: string[];
  x_query: string | null;
  score_threshold: number;
  daily_alert_limit: number;
  telegram_chat_id: string;
  reddit_polled_at: string | null;
  x_polled_at: string | null;
  last_error: string | null;
  created_at: string;
}

export interface SocialPost {
  id: string;
  campaign_id: string;
  platform: SocialPlatform;
  source_id: string;
  source_name: string | null;
  author_name: string | null;
  title: string;
  body: string;
  post_url: string;
  source_created_at: string;
  category: SocialCategory | null;
  matched_keyword: string | null;
  score: number | null;
  budget: string | null;
  matched_reasons: string[];
  draft_reply: string | null;
  status: 'candidate' | 'classifying' | 'rejected' | 'qualified' | 'notifying' | 'alerted' | 'alert_failed' | 'alert_unknown';
  alert_attempts: number;
  alerted_at: string | null;
  last_error: string | null;
  created_at: string;
}

export interface SourcePost {
  platform: SocialPlatform;
  sourceId: string;
  sourceName: string;
  authorName: string | null;
  title: string;
  body: string;
  url: string;
  createdAt: string;
}
