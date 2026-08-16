-- ============================================================
-- Migration: 002_add_enrichment_fields.sql
-- Description: Adds website, email, and drafted_email_pitch to leads
-- ============================================================

ALTER TABLE public.leads
  ADD COLUMN website TEXT,
  ADD COLUMN email TEXT,
  ADD COLUMN drafted_email_pitch TEXT;
