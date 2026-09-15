-- Read-only MCP observability and distributed request limiting.
-- This migration grants no new access to business data.

CREATE TABLE IF NOT EXISTS public.mcp_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  client_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  duration_ms INTEGER NOT NULL CHECK (duration_ms >= 0),
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS mcp_audit_logs_org_time_idx
  ON public.mcp_audit_logs (organization_id, created_at DESC);

ALTER TABLE public.mcp_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deny_all_anon_mcp_audit_logs" ON public.mcp_audit_logs;
CREATE POLICY "deny_all_anon_mcp_audit_logs" ON public.mcp_audit_logs
  FOR ALL TO anon USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "tenant_read_mcp_audit_logs" ON public.mcp_audit_logs;
CREATE POLICY "tenant_read_mcp_audit_logs" ON public.mcp_audit_logs
  FOR SELECT TO authenticated
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

CREATE TABLE IF NOT EXISTS public.mcp_rate_limits (
  subject_key TEXT PRIMARY KEY,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.mcp_rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deny_all_anon_mcp_rate_limits" ON public.mcp_rate_limits;
CREATE POLICY "deny_all_anon_mcp_rate_limits" ON public.mcp_rate_limits
  FOR ALL TO anon USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "deny_all_authenticated_mcp_rate_limits" ON public.mcp_rate_limits;
CREATE POLICY "deny_all_authenticated_mcp_rate_limits" ON public.mcp_rate_limits
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.consume_mcp_rate_limit(
  subject_key TEXT,
  request_limit INTEGER DEFAULT 60,
  window_seconds INTEGER DEFAULT 60
)
RETURNS TABLE(allowed BOOLEAN, remaining INTEGER, reset_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_row public.mcp_rate_limits%ROWTYPE;
  safe_limit INTEGER := GREATEST(1, LEAST(request_limit, 1000));
  safe_window INTEGER := GREATEST(1, LEAST(window_seconds, 3600));
BEGIN
  INSERT INTO public.mcp_rate_limits AS limits (subject_key, window_started_at, request_count, updated_at)
  VALUES (consume_mcp_rate_limit.subject_key, NOW(), 1, NOW())
  ON CONFLICT ON CONSTRAINT mcp_rate_limits_pkey DO UPDATE
  SET window_started_at = CASE
        WHEN limits.window_started_at <= NOW() - make_interval(secs => safe_window) THEN NOW()
        ELSE limits.window_started_at
      END,
      request_count = CASE
        WHEN limits.window_started_at <= NOW() - make_interval(secs => safe_window) THEN 1
        ELSE limits.request_count + 1
      END,
      updated_at = NOW()
  RETURNING * INTO current_row;

  RETURN QUERY SELECT
    current_row.request_count <= safe_limit,
    GREATEST(0, safe_limit - current_row.request_count),
    current_row.window_started_at + make_interval(secs => safe_window);
END;
$$;

REVOKE ALL ON FUNCTION public.consume_mcp_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_mcp_rate_limit(TEXT, INTEGER, INTEGER) TO service_role;

COMMENT ON TABLE public.mcp_audit_logs IS 'Metadata-only audit trail for authenticated MCP tool calls; excludes tool inputs and customer records.';
COMMENT ON TABLE public.mcp_rate_limits IS 'Distributed fixed-window request counters for the AurionStack MCP endpoint.';
