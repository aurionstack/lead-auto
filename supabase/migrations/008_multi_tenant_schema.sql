-- ============================================================
-- Migration: 008_multi_tenant_schema.sql
-- Description: Converts the single-tenant schema to multi-tenant.
-- ============================================================

-- 1. Create Organizations and Membership tables
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.organization_members (
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL, -- Logical reference to auth.users
  role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.organization_settings (
  organization_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  gemini_api_key TEXT,
  apify_api_token TEXT,
  hunter_api_key TEXT,
  smtp_host TEXT,
  smtp_port INTEGER,
  smtp_user TEXT,
  smtp_password TEXT,
  from_email TEXT,
  from_name TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on new tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;

-- Deny all anon
DROP POLICY IF EXISTS "deny_all_anon_orgs" ON public.organizations;
CREATE POLICY "deny_all_anon_orgs" ON public.organizations FOR ALL TO anon USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "deny_all_anon_org_members" ON public.organization_members;
CREATE POLICY "deny_all_anon_org_members" ON public.organization_members FOR ALL TO anon USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "deny_all_anon_org_settings" ON public.organization_settings;
CREATE POLICY "deny_all_anon_org_settings" ON public.organization_settings FOR ALL TO anon USING (false) WITH CHECK (false);

-- Authenticated users can view their organizations
DROP POLICY IF EXISTS "user_view_orgs" ON public.organizations;
CREATE POLICY "user_view_orgs" ON public.organizations
  FOR SELECT TO authenticated
  USING (id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "user_view_org_members" ON public.organization_members;
CREATE POLICY "user_view_org_members" ON public.organization_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user_manage_org_settings" ON public.organization_settings;
CREATE POLICY "user_manage_org_settings" ON public.organization_settings
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));


-- 2. Add organization_id to all existing core tables
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.scrape_jobs ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.search_configs ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.outreach_queue ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.email_suppressions ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.email_events ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Default existing data to a default organization if needed (for backwards compatibility if any data exists).
-- Let's create a default org and assign it if data exists.
DO $$
DECLARE
    default_org_id UUID;
    lead_count INT;
BEGIN
    SELECT count(*) INTO lead_count FROM public.leads WHERE organization_id IS NULL;
    IF lead_count > 0 THEN
        INSERT INTO public.organizations (name) VALUES ('Default Organization') RETURNING id INTO default_org_id;
        INSERT INTO public.organization_settings (organization_id) VALUES (default_org_id);
        
        UPDATE public.leads SET organization_id = default_org_id WHERE organization_id IS NULL;
        UPDATE public.scrape_jobs SET organization_id = default_org_id WHERE organization_id IS NULL;
        UPDATE public.search_configs SET organization_id = default_org_id WHERE organization_id IS NULL;
        UPDATE public.outreach_queue SET organization_id = default_org_id WHERE organization_id IS NULL;
        UPDATE public.email_suppressions SET organization_id = default_org_id WHERE organization_id IS NULL;
        UPDATE public.email_events SET organization_id = default_org_id WHERE organization_id IS NULL;
    END IF;
END $$;

-- Make organization_id NOT NULL for future records
ALTER TABLE public.leads ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.search_configs ALTER COLUMN organization_id SET NOT NULL;

-- 3. Replace old "deny_all_authenticated" with Multi-tenant RLS for core tables
DROP POLICY IF EXISTS "deny_all_authenticated_select" ON public.leads;
DROP POLICY IF EXISTS "deny_all_authenticated_insert" ON public.leads;
DROP POLICY IF EXISTS "deny_all_authenticated_update" ON public.leads;
DROP POLICY IF EXISTS "deny_all_authenticated_delete" ON public.leads;
DROP POLICY IF EXISTS "tenant_isolation_leads" ON public.leads;

CREATE POLICY "tenant_isolation_leads" ON public.leads FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "deny_all_auth_scrape_jobs" ON public.scrape_jobs;
DROP POLICY IF EXISTS "tenant_isolation_jobs" ON public.scrape_jobs;
CREATE POLICY "tenant_isolation_jobs" ON public.scrape_jobs FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "deny_all_authenticated_search_configs" ON public.search_configs;
DROP POLICY IF EXISTS "tenant_isolation_configs" ON public.search_configs;
CREATE POLICY "tenant_isolation_configs" ON public.search_configs FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "deny_all_authenticated_suppressions" ON public.email_suppressions;
DROP POLICY IF EXISTS "tenant_isolation_suppressions" ON public.email_suppressions;
CREATE POLICY "tenant_isolation_suppressions" ON public.email_suppressions FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "deny_all_authenticated_outreach_queue" ON public.outreach_queue;
DROP POLICY IF EXISTS "tenant_isolation_queue" ON public.outreach_queue;
CREATE POLICY "tenant_isolation_queue" ON public.outreach_queue FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "deny_all_authenticated_email_events" ON public.email_events;
DROP POLICY IF EXISTS "tenant_isolation_events" ON public.email_events;
CREATE POLICY "tenant_isolation_events" ON public.email_events FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

-- 4. Auto-provisioning trigger for new signups
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
    new_org_id UUID;
BEGIN
    INSERT INTO public.organizations (name)
    VALUES (COALESCE(NEW.email, 'New User') || '''s Organization')
    RETURNING id INTO new_org_id;

    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (new_org_id, NEW.id, 'admin');

    INSERT INTO public.organization_settings (organization_id)
    VALUES (new_org_id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
