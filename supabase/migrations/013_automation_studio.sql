-- Tenant-safe workflow builder and execution history. Workflows default to draft.

CREATE TABLE IF NOT EXISTS public.automation_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (CHAR_LENGTH(name) BETWEEN 1 AND 160),
  description TEXT NOT NULL DEFAULT '' CHECK (CHAR_LENGTH(description) <= 1000),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  trigger_type TEXT NOT NULL DEFAULT 'manual' CHECK (trigger_type IN ('manual', 'interval', 'daily')),
  trigger_config JSONB NOT NULL DEFAULT '{}'::JSONB,
  daily_run_limit INTEGER NOT NULL DEFAULT 24 CHECK (daily_run_limit BETWEEN 1 AND 1000),
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.automation_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  workflow_id UUID NOT NULL REFERENCES public.automation_workflows(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position BETWEEN 0 AND 99),
  name TEXT NOT NULL CHECK (CHAR_LENGTH(name) BETWEEN 1 AND 160),
  action_type TEXT NOT NULL,
  action_config JSONB NOT NULL DEFAULT '{}'::JSONB,
  retry_limit INTEGER NOT NULL DEFAULT 1 CHECK (retry_limit BETWEEN 0 AND 5),
  continue_on_error BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workflow_id, position)
);

CREATE TABLE IF NOT EXISTS public.automation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  workflow_id UUID NOT NULL REFERENCES public.automation_workflows(id) ON DELETE CASCADE,
  trigger_source TEXT NOT NULL CHECK (trigger_source IN ('manual', 'schedule', 'test')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  input JSONB NOT NULL DEFAULT '{}'::JSONB,
  output JSONB,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.automation_run_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  run_id UUID NOT NULL REFERENCES public.automation_runs(id) ON DELETE CASCADE,
  step_id UUID REFERENCES public.automation_steps(id) ON DELETE SET NULL,
  position INTEGER NOT NULL,
  action_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed', 'skipped')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  output JSONB,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS automation_workflows_due_idx ON public.automation_workflows (status, next_run_at);
CREATE INDEX IF NOT EXISTS automation_steps_workflow_position_idx ON public.automation_steps (workflow_id, position);
CREATE INDEX IF NOT EXISTS automation_runs_workflow_time_idx ON public.automation_runs (workflow_id, created_at DESC);
CREATE INDEX IF NOT EXISTS automation_run_steps_run_position_idx ON public.automation_run_steps (run_id, position);

ALTER TABLE public.automation_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_run_steps ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['automation_workflows','automation_steps','automation_runs','automation_run_steps'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_%I ON public.%I', table_name, table_name);
    EXECUTE format(
      'CREATE POLICY tenant_isolation_%I ON public.%I FOR ALL TO authenticated USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())) WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()))',
      table_name, table_name
    );
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.set_automation_studio_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_automation_workflows_updated_at ON public.automation_workflows;
CREATE TRIGGER set_automation_workflows_updated_at BEFORE UPDATE ON public.automation_workflows FOR EACH ROW EXECUTE FUNCTION public.set_automation_studio_updated_at();
DROP TRIGGER IF EXISTS set_automation_steps_updated_at ON public.automation_steps;
CREATE TRIGGER set_automation_steps_updated_at BEFORE UPDATE ON public.automation_steps FOR EACH ROW EXECUTE FUNCTION public.set_automation_studio_updated_at();

COMMENT ON TABLE public.automation_workflows IS 'User-composed workflows. Draft by default; activation is explicit and audited through runs.';

CREATE OR REPLACE FUNCTION public.replace_automation_steps(p_workflow_id UUID, p_steps JSONB)
RETURNS VOID AS $$
DECLARE workflow_org UUID;
BEGIN
  IF jsonb_typeof(p_steps) <> 'array' OR jsonb_array_length(p_steps) < 1 OR jsonb_array_length(p_steps) > 20 THEN
    RAISE EXCEPTION 'Workflow must contain between 1 and 20 steps';
  END IF;
  SELECT organization_id INTO workflow_org FROM public.automation_workflows WHERE id = p_workflow_id;
  IF workflow_org IS NULL THEN RAISE EXCEPTION 'Workflow not found'; END IF;
  DELETE FROM public.automation_steps WHERE workflow_id = p_workflow_id;
  INSERT INTO public.automation_steps (organization_id, workflow_id, position, name, action_type, action_config, retry_limit, continue_on_error)
  SELECT workflow_org, p_workflow_id, (item->>'position')::INTEGER, item->>'name', item->>'action_type', COALESCE(item->'action_config', '{}'::JSONB), (item->>'retry_limit')::INTEGER, (item->>'continue_on_error')::BOOLEAN
  FROM jsonb_array_elements(p_steps) AS item;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;
