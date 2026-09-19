// ============================================================
// src/lib/types.ts
// Shared TypeScript types for the Lead Automation System.
// This file is imported by both server and client code,
// so it must contain ONLY serializable data types —
// no Supabase client instances, no server-only imports.
// ============================================================

export type LeadStatus = 'new' | 'processing' | 'approved' | 'contacted' | 'rejected' | 'suppressed' | 'bounced' | 'unsubscribed' | 'replied';
export type ScrapeStatus = 'scraping' | 'completed' | 'failed';

export interface DiscoveredEmail {
  email: string;
  source: string;
  confidence?: string;
  name?: string;
  title?: string;
  sourceUrl?: string;
  verificationStatus?: 'valid' | 'invalid' | 'accept_all' | 'webmail' | 'disposable' | 'unknown' | 'blocked' | 'unverified';
  verifiedAt?: string;
  selected?: boolean;
}

export interface ScrapeJob {
  id: string;
  location: string;
  category: string;
  channel?: 'email' | 'whatsapp' | 'instantly';
  status: ScrapeStatus;
  results_count: number;
  created_at: string;
}

export interface Lead {
  id: string;
  business_name: string | null;
  phone: string | null;
  google_maps_url: string | null;
  category: string | null;
  rating: number | null;
  review_count: number | null;
  address: string | null;
  opportunity_score: number | null;
  ai_reasoning: string | null;
  drafted_pitch: string | null;
  drafted_email_pitch: string | null;
  website: string | null;
  email: string | null;
  alternative_emails: DiscoveredEmail[] | null;
  channel: 'email' | 'whatsapp' | 'instantly';
  status: LeadStatus;
  scrape_job_id: string | null;
  created_at: string;
  organization_id: string;
}

// Shape of the AI response we enforce via JSON parsing
export interface AIResult {
  score: number;
  reasoning: string;
  pitch_whatsapp: string;
  pitch_email: string;
  selected_email: string | null;
}

// Payload shape for the Apify dataset item
export interface ApifyLeadItem {
  title?: string;
  phone?: string | null;
  url?: string;           // Google Maps URL
  categoryName?: string;
  totalScore?: number;    // rating
  reviewsCount?: number;
  address?: string;
  website?: string | null;
}

// Rate limit tracking entry
export interface RateLimitEntry {
  attempts: number;
  firstAttemptAt: number;
}

export interface SearchConfig {
  id: string;
  search_query: string;
  location: string;
  channel: string;
  is_active: boolean;
  last_scraped_at: string;
  created_at: string;
  organization_id: string;
}

export interface OrganizationSettings {
  organization_id: string;
  gemini_api_key?: string | null;
  apify_api_token?: string | null;
  hunter_api_key?: string | null;
  smtp_host?: string | null;
  smtp_port?: number | string | null;
  smtp_user?: string | null;
  smtp_password?: string | null;
  from_email?: string | null;
  from_name?: string | null;
  postal_address?: string | null;
}

export interface OutreachRecord {
  id: string;
  subject: string;
  body_text: string;
  body_html: string;
  sent_at: string | null;
  leads: { business_name: string | null; email: string | null } | null;
}

export interface DashboardData {
  jobs: ScrapeJob[];
  outreach: OutreachRecord[];
  leadStats: {
    total: number;
    contacted: number;
    rejected: number;
    new: number;
    qualified: number;
    replied: number;
  };
  outreachStats: {
    sent: number;
    sentToday: number;
    pending: number;
    failed: number;
  };
  pipeline: { label: string; value: number; tone: string }[];
  chartData: { date: string; sent: number }[];
  lastActivityAt: string | null;
}
