-- Additive, paused-by-default foundation for the YouTube Creator Outreach tool.
-- This migration does not create campaigns, queue messages, or send outreach.

CREATE TABLE IF NOT EXISTS public.youtube_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'paused' CHECK (status IN ('paused', 'active', 'completed')),
  daily_discovery_target INTEGER NOT NULL DEFAULT 25 CHECK (daily_discovery_target BETWEEN 0 AND 500),
  daily_limit INTEGER NOT NULL DEFAULT 10 CHECK (daily_limit BETWEEN 0 AND 100),
  subscriber_min INTEGER NOT NULL DEFAULT 20000 CHECK (subscriber_min >= 0),
  subscriber_max INTEGER NOT NULL DEFAULT 500000 CHECK (subscriber_max >= subscriber_min),
  countries TEXT[] NOT NULL DEFAULT ARRAY['United States', 'United Kingdom', 'Canada', 'Australia'],
  languages TEXT[] NOT NULL DEFAULT ARRAY['English'],
  niches TEXT[] NOT NULL DEFAULT ARRAY['Study & productivity', 'Self-improvement', 'Business', 'Technology'],
  require_long_form BOOLEAN NOT NULL DEFAULT TRUE,
  shorts_usage_rule TEXT NOT NULL DEFAULT 'Underuses or inconsistently publishes Shorts',
  sender_identity TEXT NOT NULL DEFAULT 'samir@aurionstack.dev',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.youtube_creators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL,
  handle TEXT,
  channel_name TEXT NOT NULL,
  channel_url TEXT NOT NULL,
  subscriber_count INTEGER CHECK (subscriber_count IS NULL OR subscriber_count >= 0),
  country TEXT,
  language TEXT,
  business_email TEXT,
  email_source TEXT,
  long_form_score INTEGER CHECK (long_form_score IS NULL OR long_form_score BETWEEN 0 AND 100),
  shorts_usage_score INTEGER CHECK (shorts_usage_score IS NULL OR shorts_usage_score BETWEEN 0 AND 100),
  opportunity_score INTEGER CHECK (opportunity_score IS NULL OR opportunity_score BETWEEN 0 AND 100),
  qualification_reason TEXT,
  status TEXT NOT NULL DEFAULT 'discovered' CHECK (status IN (
    'discovered', 'qualified', 'rejected', 'contacted', 'replied', 'positive_reply',
    'sample_requested', 'sample_sent', 'client', 'unsubscribed'
  )),
  latest_video_title TEXT,
  latest_video_url TEXT,
  last_contacted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, channel_id),
  CHECK (business_email IS NULL OR NULLIF(BTRIM(email_source), '') IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.youtube_outreach_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.youtube_campaigns(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES public.youtube_creators(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_text TEXT NOT NULL,
  body_html TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'paused' CHECK (status IN ('paused', 'pending', 'locked', 'sent', 'failed', 'cancelled')),
  scheduled_for TIMESTAMPTZ,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  sent_at TIMESTAMPTZ,
  provider TEXT,
  provider_message_id TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS youtube_one_open_message_per_creator_campaign
  ON public.youtube_outreach_queue (creator_id, campaign_id)
  WHERE status IN ('paused', 'pending', 'locked');

CREATE TABLE IF NOT EXISTS public.youtube_outreach_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.youtube_campaigns(id) ON DELETE SET NULL,
  creator_id UUID NOT NULL REFERENCES public.youtube_creators(id) ON DELETE CASCADE,
  queue_id UUID REFERENCES public.youtube_outreach_queue(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  provider_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.youtube_creator_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES public.youtube_creators(id) ON DELETE CASCADE,
  author_user_id UUID,
  body TEXT NOT NULL CHECK (CHAR_LENGTH(body) BETWEEN 1 AND 5000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS youtube_creators_org_status_score_idx
  ON public.youtube_creators (organization_id, status, opportunity_score DESC);
CREATE INDEX IF NOT EXISTS youtube_campaigns_org_status_idx
  ON public.youtube_campaigns (organization_id, status);
CREATE INDEX IF NOT EXISTS youtube_queue_org_status_schedule_idx
  ON public.youtube_outreach_queue (organization_id, status, scheduled_for);
CREATE INDEX IF NOT EXISTS youtube_events_creator_time_idx
  ON public.youtube_outreach_events (creator_id, event_timestamp DESC);
CREATE INDEX IF NOT EXISTS youtube_notes_creator_time_idx
  ON public.youtube_creator_notes (creator_id, created_at DESC);

ALTER TABLE public.youtube_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.youtube_creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.youtube_outreach_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.youtube_outreach_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.youtube_creator_notes ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'youtube_campaigns', 'youtube_creators', 'youtube_outreach_queue',
    'youtube_outreach_events', 'youtube_creator_notes'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_%I ON public.%I', table_name, table_name);
    EXECUTE format(
      'CREATE POLICY tenant_isolation_%I ON public.%I FOR ALL TO authenticated USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())) WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()))',
      table_name,
      table_name
    );
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.set_youtube_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_youtube_campaigns_updated_at ON public.youtube_campaigns;
CREATE TRIGGER set_youtube_campaigns_updated_at BEFORE UPDATE ON public.youtube_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_youtube_updated_at();
DROP TRIGGER IF EXISTS set_youtube_creators_updated_at ON public.youtube_creators;
CREATE TRIGGER set_youtube_creators_updated_at BEFORE UPDATE ON public.youtube_creators
  FOR EACH ROW EXECUTE FUNCTION public.set_youtube_updated_at();
DROP TRIGGER IF EXISTS set_youtube_queue_updated_at ON public.youtube_outreach_queue;
CREATE TRIGGER set_youtube_queue_updated_at BEFORE UPDATE ON public.youtube_outreach_queue
  FOR EACH ROW EXECUTE FUNCTION public.set_youtube_updated_at();
DROP TRIGGER IF EXISTS set_youtube_notes_updated_at ON public.youtube_creator_notes;
CREATE TRIGGER set_youtube_notes_updated_at BEFORE UPDATE ON public.youtube_creator_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_youtube_updated_at();

COMMENT ON TABLE public.youtube_creators IS 'Tool-specific creator prospects. Never infer or guess business_email values.';
COMMENT ON COLUMN public.youtube_creators.email_source IS 'Human-readable provenance for a publicly listed business email.';
COMMENT ON TABLE public.youtube_outreach_queue IS 'Paused-by-default queue foundation. No sender consumes this table yet.';
