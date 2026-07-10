// ============================================================
// src/lib/types.ts
// Shared TypeScript types for the Lead Automation System.
// This file is imported by both server and client code,
// so it must contain ONLY serializable data types —
// no Supabase client instances, no server-only imports.
// ============================================================

export type LeadStatus = 'new' | 'approved' | 'contacted' | 'rejected';

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
  status: LeadStatus;
  created_at: string;
}

// Shape of the AI response we enforce via JSON parsing
export interface AIResult {
  score: number;
  reasoning: string;
  pitch: string;
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
