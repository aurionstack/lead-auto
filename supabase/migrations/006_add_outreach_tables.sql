-- ============================================================
-- Migration: 006_add_outreach_tables_v2.sql
-- Description: Creates email_suppressions, outreach_queue, and email_events
-- ============================================================

-- 1. Create email_suppressions table
CREATE TABLE IF NOT EXISTS public.email_suppressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  reason TEXT NOT NULL, -- e.g., 'bounced', 'unsubscribed', 'complained', 'manual_block', 'invalid'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create queue status enum
CREATE TYPE outreach_queue_status AS ENUM ('pending', 'locked', 'sent', 'failed');

-- 2. Create outreach_queue table with snapshotting and locking
CREATE TABLE IF NOT EXISTS public.outreach_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  campaign_id TEXT, -- Optional, if we group sends later
  
  -- Snapshot of the content
  subject TEXT NOT NULL,
  body_text TEXT NOT NULL,
  body_html TEXT NOT NULL,
  
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status outreach_queue_status NOT NULL DEFAULT 'pending',
  
  -- Locking & Retries
  attempt_count INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  locked_at TIMESTAMPTZ,
  locked_by TEXT, -- e.g., standard process ID or hostname
  
  -- Results
  sent_at TIMESTAMPTZ,
  provider TEXT,
  provider_message_id TEXT,
  error_message TEXT,
  error_code TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Create email_events table
CREATE TABLE IF NOT EXISTS public.email_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  queue_id UUID REFERENCES public.outreach_queue(id) ON DELETE SET NULL,
  provider_message_id TEXT,
  event_type TEXT NOT NULL, -- 'queued', 'sending', 'sent', 'delivered', 'deferred', 'bounced', 'complained', 'opened', 'clicked', 'replied', 'unsubscribed', 'failed'
  event_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  provider_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.email_suppressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;

-- Deny all anon access
CREATE POLICY "deny_all_anon_suppressions" ON public.email_suppressions FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "deny_all_anon_outreach_queue" ON public.outreach_queue FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "deny_all_anon_email_events" ON public.email_events FOR ALL TO anon USING (false) WITH CHECK (false);

-- Deny all authenticated access (all operations via service role)
CREATE POLICY "deny_all_authenticated_suppressions" ON public.email_suppressions FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "deny_all_authenticated_outreach_queue" ON public.outreach_queue FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "deny_all_authenticated_email_events" ON public.email_events FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- Indices for performance
CREATE INDEX idx_suppressions_email ON public.email_suppressions (email);
CREATE INDEX idx_outreach_queue_status_scheduled ON public.outreach_queue (status, scheduled_for);
CREATE INDEX idx_outreach_queue_lead_id ON public.outreach_queue (lead_id);
CREATE INDEX idx_email_events_lead_id ON public.email_events (lead_id);
CREATE INDEX idx_email_events_message_id ON public.email_events (provider_message_id);
