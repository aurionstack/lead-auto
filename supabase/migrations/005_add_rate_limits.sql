-- ============================================================
-- Migration: 005_add_rate_limits.sql
-- Description: Creates the `rate_limits` table for tracking
--              failed login attempts.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.rate_limits (
  ip TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 1,
  first_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Deny all client access; only server-side service role can read/write
CREATE POLICY "deny_all_anon" ON public.rate_limits FOR ALL TO anon USING (false);
CREATE POLICY "deny_all_auth" ON public.rate_limits FOR ALL TO authenticated USING (false);
