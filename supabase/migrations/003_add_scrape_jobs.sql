-- ============================================================
-- Migration: 003_add_scrape_jobs.sql
-- Description: Creates the `scrape_jobs` table to group leads into batches.
-- ============================================================

CREATE TYPE scrape_status AS ENUM ('scraping', 'completed', 'failed');

CREATE TABLE IF NOT EXISTS public.scrape_jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location      TEXT NOT NULL,
  category      TEXT NOT NULL,
  status        scrape_status NOT NULL DEFAULT 'scraping',
  results_count INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS settings for scrape_jobs
ALTER TABLE public.scrape_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deny_all_anon_scrape_jobs" ON public.scrape_jobs FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "deny_all_auth_scrape_jobs" ON public.scrape_jobs FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- Add scrape_job_id to leads table
ALTER TABLE public.leads 
ADD COLUMN scrape_job_id UUID REFERENCES public.scrape_jobs(id) ON DELETE CASCADE;

CREATE INDEX idx_leads_scrape_job_id ON public.leads (scrape_job_id);
CREATE INDEX idx_scrape_jobs_created_at ON public.scrape_jobs (created_at DESC);
