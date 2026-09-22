-- RevQR WhatsApp Sales Engine. Additive, tenant-isolated, and paused by default.
-- Applying this migration does not send messages or activate a campaign.

CREATE TABLE IF NOT EXISTS public.revqr_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'RevQR WhatsApp Sales Engine',
  status TEXT NOT NULL DEFAULT 'paused' CHECK (status IN ('paused', 'active', 'completed')),
  phone_number_id TEXT NOT NULL,
  daily_limit INTEGER NOT NULL DEFAULT 20 CHECK (daily_limit BETWEEN 1 AND 100),
  follow_up_delay_hours INTEGER NOT NULL DEFAULT 72 CHECK (follow_up_delay_hours BETWEEN 24 AND 336),
  demo_url TEXT NOT NULL,
  payment_url TEXT NOT NULL,
  website_url TEXT NOT NULL DEFAULT 'https://revqr.tech',
  offer_text TEXT NOT NULL DEFAULT '₹1,499/year including setup and 1–2 branded QR stands.',
  follow_up_template_name TEXT,
  template_language TEXT NOT NULL DEFAULT 'en',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (phone_number_id)
);

CREATE TABLE IF NOT EXISTS public.revqr_prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  business_name TEXT,
  niche TEXT,
  location TEXT,
  phone_e164 TEXT NOT NULL,
  google_maps_url TEXT,
  website_url TEXT,
  instagram_url TEXT,
  google_rating NUMERIC(2,1),
  google_review_count INTEGER CHECK (google_review_count IS NULL OR google_review_count >= 0),
  qualification_score INTEGER CHECK (qualification_score IS NULL OR qualification_score BETWEEN 0 AND 100),
  qualification_reason TEXT,
  consent_status TEXT NOT NULL DEFAULT 'none' CHECK (consent_status IN ('none', 'inbound', 'explicit', 'revoked')),
  consent_source TEXT,
  consent_recorded_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN (
    'new', 'qualified', 'contacted', 'replied', 'demo_sent', 'interested',
    'payment_sent', 'customer', 'not_interested', 'no_response', 'do_not_contact'
  )),
  last_contacted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, phone_e164)
);

CREATE TABLE IF NOT EXISTS public.revqr_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.revqr_campaigns(id) ON DELETE CASCADE,
  prospect_id UUID NOT NULL REFERENCES public.revqr_prospects(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'won', 'closed', 'opted_out')),
  last_inbound_at TIMESTAMPTZ,
  last_outbound_at TIMESTAMPTZ,
  service_window_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (campaign_id, prospect_id)
);

CREATE TABLE IF NOT EXISTS public.revqr_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.revqr_campaigns(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.revqr_conversations(id) ON DELETE CASCADE,
  prospect_id UUID NOT NULL REFERENCES public.revqr_prospects(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'template', 'image', 'video', 'document', 'interactive')),
  intent TEXT,
  body TEXT,
  provider_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'queued', 'sent', 'delivered', 'read', 'failed')),
  provider_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, provider_message_id)
);

CREATE TABLE IF NOT EXISTS public.revqr_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.revqr_campaigns(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.revqr_conversations(id) ON DELETE CASCADE,
  prospect_id UUID NOT NULL REFERENCES public.revqr_prospects(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL CHECK (job_type IN ('auto_reply', 'follow_up', 'onboarding')),
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  status TEXT NOT NULL DEFAULT 'paused' CHECK (status IN ('paused', 'pending', 'locked', 'completed', 'failed', 'cancelled')),
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  locked_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.revqr_onboarding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.revqr_campaigns(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.revqr_conversations(id) ON DELETE CASCADE,
  prospect_id UUID NOT NULL REFERENCES public.revqr_prospects(id) ON DELETE CASCADE,
  logo_media_id TEXT,
  google_review_url TEXT,
  status TEXT NOT NULL DEFAULT 'awaiting_assets' CHECK (status IN ('awaiting_assets', 'pending', 'processing', 'completed', 'failed')),
  customer_url TEXT,
  qr_asset_url TEXT,
  standee_asset_url TEXT,
  provider_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (campaign_id, prospect_id)
);

CREATE TABLE IF NOT EXISTS public.revqr_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.revqr_campaigns(id) ON DELETE SET NULL,
  prospect_id UUID REFERENCES public.revqr_prospects(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES public.revqr_conversations(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS revqr_prospects_org_status_idx ON public.revqr_prospects (organization_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS revqr_conversations_org_status_idx ON public.revqr_conversations (organization_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS revqr_messages_conversation_time_idx ON public.revqr_messages (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS revqr_jobs_ready_idx ON public.revqr_jobs (status, scheduled_for);
CREATE UNIQUE INDEX IF NOT EXISTS revqr_one_open_followup_per_conversation
  ON public.revqr_jobs (conversation_id, job_type)
  WHERE job_type = 'follow_up' AND status IN ('paused', 'pending', 'locked');
CREATE INDEX IF NOT EXISTS revqr_events_org_time_idx ON public.revqr_events (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS revqr_onboarding_org_status_idx ON public.revqr_onboarding (organization_id, status, updated_at DESC);

ALTER TABLE public.revqr_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revqr_prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revqr_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revqr_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revqr_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revqr_onboarding ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revqr_events ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['revqr_campaigns','revqr_prospects','revqr_conversations','revqr_messages','revqr_jobs','revqr_onboarding','revqr_events'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_%I ON public.%I', table_name, table_name);
    EXECUTE format(
      'CREATE POLICY tenant_isolation_%I ON public.%I FOR ALL TO authenticated USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())) WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()))',
      table_name, table_name
    );
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.set_revqr_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['revqr_campaigns','revqr_prospects','revqr_conversations','revqr_jobs','revqr_onboarding'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_%I_updated_at ON public.%I', table_name, table_name);
    EXECUTE format('CREATE TRIGGER set_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_revqr_updated_at()', table_name, table_name);
  END LOOP;
END $$;

COMMENT ON TABLE public.revqr_prospects IS 'RevQR prospects with explicit consent provenance. A phone number alone is never consent.';
COMMENT ON TABLE public.revqr_jobs IS 'Guarded WhatsApp work queue. Campaigns and jobs are paused by default.';
