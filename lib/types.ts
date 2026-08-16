// ============================================================
// src/lib/types.ts
// Shared TypeScript types for the Lead Automation System.
// This file is imported by both server and client code,
// so it must contain ONLY serializable data types —
// no Supabase client instances, no server-only imports.
// ============================================================

export type LeadStatus = 'new' | 'approved' | 'contacted' | 'rejected';
export type ScrapeStatus = 'scraping' | 'completed' | 'failed';

export interface ScrapeJob {
  id: string;
  location: string;
  category: string;
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
  status: LeadStatus;
  scrape_job_id: string | null;
  created_at: string;
}

// Shape of the AI response we enforce via JSON parsing
export interface AIResult {
  score: number;
  reasoning: string;
  pitch_whatsapp: string;
  pitch_email: string;
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
}
