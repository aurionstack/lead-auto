-- ============================================================
-- Migration: 001_leads_schema.sql
-- Description: Creates the `leads` table with RLS enabled.
--
-- SECURITY MODEL:
--   - RLS is ON for this table.
--   - The anon/authenticated roles have ZERO access by default.
--   - All reads/writes MUST go through the backend using the
--     SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS by design.
--   - Never expose SUPABASE_SERVICE_ROLE_KEY to the client.
-- ============================================================

-- Create the status enum type
CREATE TYPE lead_status AS ENUM ('new', 'approved', 'contacted', 'rejected');

-- Create the leads table
CREATE TABLE IF NOT EXISTS public.leads (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name     TEXT,
  phone             TEXT,
  google_maps_url   TEXT UNIQUE,          -- Unique for upsert deduplication
  category          TEXT,
  rating            NUMERIC(3, 1),
  review_count      INTEGER,
  address           TEXT,
  opportunity_score INTEGER DEFAULT 0,    -- 0 = not yet scored by AI
  ai_reasoning      TEXT,
  drafted_pitch     TEXT,
  status            lead_status NOT NULL DEFAULT 'new',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- STEP 1: Enable Row Level Security (RLS) on the table.
-- This is the master switch — without this, the policies below
-- would have no effect and everything would be publicly readable.
-- ============================================================
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 2: Explicit DENY-ALL policy for the anon role.
--
-- By default, enabling RLS already denies all access when no
-- policies exist. This explicit policy makes the intent
-- crystal clear and survives future Supabase UI changes.
--
-- The anon key (NEXT_PUBLIC_SUPABASE_URL + anon key) used in
-- client-side code will NEVER be able to read or write leads.
-- ============================================================
CREATE POLICY "deny_all_anon_select"
  ON public.leads
  FOR SELECT
  TO anon
  USING (false);

CREATE POLICY "deny_all_anon_insert"
  ON public.leads
  FOR INSERT
  TO anon
  WITH CHECK (false);

CREATE POLICY "deny_all_anon_update"
  ON public.leads
  FOR UPDATE
  TO anon
  USING (false)
  WITH CHECK (false);

CREATE POLICY "deny_all_anon_delete"
  ON public.leads
  FOR DELETE
  TO anon
  USING (false);

-- ============================================================
-- STEP 3: Explicit DENY-ALL policy for authenticated users.
--
-- This dashboard does not use Supabase Auth for end users.
-- Authenticated users should also have zero direct DB access —
-- all operations go through the service role in API routes.
-- ============================================================
CREATE POLICY "deny_all_authenticated_select"
  ON public.leads
  FOR SELECT
  TO authenticated
  USING (false);

CREATE POLICY "deny_all_authenticated_insert"
  ON public.leads
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY "deny_all_authenticated_update"
  ON public.leads
  FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "deny_all_authenticated_delete"
  ON public.leads
  FOR DELETE
  TO authenticated
  USING (false);

-- ============================================================
-- Performance index: sort by score descending in the dashboard
-- ============================================================
CREATE INDEX idx_leads_opportunity_score ON public.leads (opportunity_score DESC);
CREATE INDEX idx_leads_status ON public.leads (status);
CREATE INDEX idx_leads_created_at ON public.leads (created_at DESC);

-- ============================================================
-- Verify setup (run this manually to confirm after migration)
-- ============================================================
-- SELECT schemaname, tablename, rowsecurity FROM pg_tables
--   WHERE tablename = 'leads';
-- Expected: rowsecurity = true
