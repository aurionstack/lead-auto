-- Reconcile application/schema drift and make cron workers idempotent.

ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'processing';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'suppressed';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'bounced';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'unsubscribed';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'replied';

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS alternative_emails JSONB,
  ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'email'
  CHECK (channel IN ('email', 'whatsapp', 'instantly'));

ALTER TABLE public.scrape_jobs
  ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'email'
  CHECK (channel IN ('email', 'whatsapp', 'instantly'));

ALTER TABLE public.outreach_queue
  ADD COLUMN IF NOT EXISTS target_email TEXT,
  ADD COLUMN IF NOT EXISTS unsubscribe_url TEXT;

UPDATE public.outreach_queue q
SET target_email = l.email
FROM public.leads l
WHERE q.lead_id = l.id AND q.target_email IS NULL;

-- Keep the oldest active item and safely retire accidental duplicates before
-- enforcing one active send per lead.
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY lead_id ORDER BY created_at, id) AS position
  FROM public.outreach_queue
  WHERE status IN ('pending', 'locked')
)
UPDATE public.outreach_queue q
SET status = 'failed', error_message = 'Duplicate active queue item retired by migration 007'
FROM ranked r
WHERE q.id = r.id AND r.position > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_outreach_one_active_per_lead
  ON public.outreach_queue (lead_id)
  WHERE status IN ('pending', 'locked');

-- search_configs previously had public allow-all policies despite all access
-- being intended to pass through the service-role backend.
DROP POLICY IF EXISTS "Allow all read access for search_configs" ON public.search_configs;
DROP POLICY IF EXISTS "Allow all insert access for search_configs" ON public.search_configs;
DROP POLICY IF EXISTS "Allow all update access for search_configs" ON public.search_configs;
DROP POLICY IF EXISTS "Allow all delete access for search_configs" ON public.search_configs;
CREATE POLICY "deny_all_anon_search_configs" ON public.search_configs
  FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "deny_all_authenticated_search_configs" ON public.search_configs
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.claim_leads_for_processing(batch_limit INTEGER DEFAULT 2)
RETURNS SETOF public.leads
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Recover a worker interrupted before it could finish.
  UPDATE public.leads
  SET status = 'new'
  WHERE status = 'processing'
    AND processing_started_at < NOW() - INTERVAL '30 minutes';

  RETURN QUERY
  WITH candidates AS (
    SELECT id
    FROM public.leads
    WHERE status = 'new' AND (opportunity_score IS NULL OR opportunity_score = 0)
    ORDER BY created_at DESC
    FOR UPDATE SKIP LOCKED
    LIMIT GREATEST(1, LEAST(batch_limit, 20))
  )
  UPDATE public.leads l
  SET status = 'processing', processing_started_at = NOW()
  FROM candidates c
  WHERE l.id = c.id
  RETURNING l.*;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_outreach_queue(batch_limit INTEGER DEFAULT 10, daily_limit INTEGER DEFAULT 30)
RETURNS SETOF public.outreach_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  remaining_limit INTEGER;
BEGIN
  -- Serialize queue claims so the daily cap remains exact across cron/manual runs.
  PERFORM pg_advisory_xact_lock(724631);

  -- If a worker died after reserving a provider message id, delivery is
  -- ambiguous. Quarantine it for manual review instead of risking a duplicate.
  UPDATE public.outreach_queue
  SET status = 'failed', error_message = 'Delivery state unknown after worker interruption; manual review required',
      locked_at = NULL, locked_by = NULL, updated_at = NOW()
  WHERE status = 'locked' AND locked_at < NOW() - INTERVAL '15 minutes'
    AND provider_message_id IS NOT NULL;

  UPDATE public.outreach_queue
  SET status = 'pending', locked_at = NULL, locked_by = NULL,
      error_message = 'Recovered stale worker lock', updated_at = NOW()
  WHERE status = 'locked' AND locked_at < NOW() - INTERVAL '15 minutes'
    AND provider_message_id IS NULL;

  SELECT GREATEST(0, daily_limit - COUNT(*))::INTEGER
  INTO remaining_limit
  FROM public.outreach_queue
  WHERE (status = 'sent' AND sent_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')
     OR (status = 'locked' AND last_attempt_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC');

  IF remaining_limit = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT id
    FROM public.outreach_queue
    WHERE status = 'pending' AND scheduled_for <= NOW()
    ORDER BY scheduled_for
    FOR UPDATE SKIP LOCKED
    LIMIT GREATEST(1, LEAST(batch_limit, remaining_limit, 50))
  )
  UPDATE public.outreach_queue q
  SET status = 'locked', locked_at = NOW(),
      locked_by = gen_random_uuid()::TEXT,
      attempt_count = COALESCE(q.attempt_count, 0) + 1,
      last_attempt_at = NOW(), updated_at = NOW()
  FROM candidates c
  WHERE q.id = c.id
  RETURNING q.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_leads_for_processing(INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_outreach_queue(INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_leads_for_processing(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_outreach_queue(INTEGER, INTEGER) TO service_role;

CREATE OR REPLACE FUNCTION public.record_login_failure(
  client_ip TEXT,
  max_attempts INTEGER DEFAULT 5,
  window_seconds INTEGER DEFAULT 900
)
RETURNS TABLE(current_attempts INTEGER, window_started_at TIMESTAMPTZ)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.rate_limits AS limits (ip, attempts, first_attempt_at)
  VALUES (client_ip, 1, NOW())
  ON CONFLICT (ip) DO UPDATE SET
    attempts = CASE
      WHEN limits.first_attempt_at < NOW() - make_interval(secs => window_seconds) THEN 1
      ELSE LEAST(limits.attempts + 1, max_attempts)
    END,
    first_attempt_at = CASE
      WHEN limits.first_attempt_at < NOW() - make_interval(secs => window_seconds) THEN NOW()
      ELSE limits.first_attempt_at
    END
  RETURNING attempts, first_attempt_at;
$$;

REVOKE ALL ON FUNCTION public.record_login_failure(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_login_failure(TEXT, INTEGER, INTEGER) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_search_config()
RETURNS SETOF public.search_configs
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH candidate AS (
    SELECT id
    FROM public.search_configs
    WHERE is_active = TRUE
    ORDER BY last_scraped_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  UPDATE public.search_configs c
  SET last_scraped_at = NOW()
  FROM candidate
  WHERE c.id = candidate.id
  RETURNING c.*;
$$;

REVOKE ALL ON FUNCTION public.claim_search_config() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_search_config() TO service_role;

CREATE OR REPLACE FUNCTION public.claim_instantly_leads(batch_limit INTEGER DEFAULT 30)
RETURNS SETOF public.leads
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT id
    FROM public.leads
    WHERE status = 'new' AND channel = 'instantly' AND email IS NOT NULL
      AND opportunity_score >= 85
    ORDER BY created_at
    FOR UPDATE SKIP LOCKED
    LIMIT GREATEST(1, LEAST(batch_limit, 100))
  )
  UPDATE public.leads l
  SET status = 'processing', processing_started_at = NOW()
  FROM candidates c
  WHERE l.id = c.id
  RETURNING l.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_instantly_leads(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_instantly_leads(INTEGER) TO service_role;
