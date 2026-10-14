-- Social Lead Monitor: isolated Reddit/X opportunity alerts. No campaign is activated by this migration.
CREATE TABLE IF NOT EXISTS public.social_monitor_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 160),
  status TEXT NOT NULL DEFAULT 'paused' CHECK (status IN ('paused', 'active')),
  reddit_enabled BOOLEAN NOT NULL DEFAULT true,
  x_enabled BOOLEAN NOT NULL DEFAULT false,
  subreddits TEXT[] NOT NULL DEFAULT ARRAY['forhire','freelance_forhire','Jobbit','VideoEditingRequests','reactjs','nextjs']::TEXT[],
  x_query TEXT,
  score_threshold INTEGER NOT NULL DEFAULT 70 CHECK (score_threshold BETWEEN 50 AND 100),
  daily_alert_limit INTEGER NOT NULL DEFAULT 10 CHECK (daily_alert_limit BETWEEN 1 AND 50),
  telegram_chat_id TEXT NOT NULL DEFAULT '',
  reddit_polled_at TIMESTAMPTZ,
  x_polled_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (reddit_enabled OR x_enabled)
);

CREATE TABLE IF NOT EXISTS public.social_monitor_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.social_monitor_campaigns(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('reddit','x')),
  source_id TEXT NOT NULL,
  source_name TEXT,
  author_name TEXT,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  post_url TEXT NOT NULL,
  source_created_at TIMESTAMPTZ NOT NULL,
  category TEXT,
  matched_keyword TEXT,
  score INTEGER CHECK (score IS NULL OR score BETWEEN 0 AND 100),
  budget TEXT,
  matched_reasons TEXT[] NOT NULL DEFAULT '{}',
  draft_reply TEXT,
  status TEXT NOT NULL DEFAULT 'candidate' CHECK (status IN ('candidate','classifying','rejected','qualified','notifying','alerted','alert_failed','alert_unknown')),
  alert_attempts INTEGER NOT NULL DEFAULT 0,
  alerted_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, platform, source_id, campaign_id)
);

CREATE INDEX IF NOT EXISTS social_monitor_campaigns_active_idx ON public.social_monitor_campaigns (status, organization_id);
CREATE INDEX IF NOT EXISTS social_monitor_posts_campaign_status_idx ON public.social_monitor_posts (campaign_id, status, created_at DESC);

ALTER TABLE public.social_monitor_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_monitor_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS social_monitor_campaigns_tenant ON public.social_monitor_campaigns;
CREATE POLICY social_monitor_campaigns_tenant ON public.social_monitor_campaigns FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS social_monitor_posts_tenant ON public.social_monitor_posts;
CREATE POLICY social_monitor_posts_tenant ON public.social_monitor_posts FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.touch_social_monitor_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS touch_social_monitor_campaigns ON public.social_monitor_campaigns;
CREATE TRIGGER touch_social_monitor_campaigns BEFORE UPDATE ON public.social_monitor_campaigns FOR EACH ROW EXECUTE FUNCTION public.touch_social_monitor_updated_at();
DROP TRIGGER IF EXISTS touch_social_monitor_posts ON public.social_monitor_posts;
CREATE TRIGGER touch_social_monitor_posts BEFORE UPDATE ON public.social_monitor_posts FOR EACH ROW EXECUTE FUNCTION public.touch_social_monitor_updated_at();

-- Locks one alert for delivery across overlapping scheduler invocations.
CREATE OR REPLACE FUNCTION public.claim_social_monitor_alerts(campaign UUID, claim_limit INTEGER DEFAULT 5, daily_limit INTEGER DEFAULT 10)
RETURNS SETOF public.social_monitor_posts LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE allowed INTEGER;
BEGIN
  -- Lock the campaign row so overlapping workers cannot exceed the alert cap.
  PERFORM 1 FROM public.social_monitor_campaigns c WHERE c.id = campaign AND c.status = 'active' FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT GREATEST(0, LEAST(daily_limit, 50) - count(*)::INTEGER) INTO allowed
  FROM public.social_monitor_posts p WHERE p.campaign_id = campaign
    AND p.status IN ('alerted','notifying') AND p.updated_at >= date_trunc('day', now());
  IF allowed < 1 THEN RETURN; END IF;
  RETURN QUERY
  WITH selected AS (
    SELECT p.id FROM public.social_monitor_posts p
    JOIN public.social_monitor_campaigns c ON c.id = p.campaign_id
    WHERE p.campaign_id = campaign AND c.status = 'active'
      AND p.status IN ('qualified','alert_failed') AND p.alert_attempts < 3
    ORDER BY p.created_at FOR UPDATE OF p SKIP LOCKED
    LIMIT LEAST(GREATEST(1, LEAST(claim_limit, 10)), allowed)
  )
  UPDATE public.social_monitor_posts p SET status = 'notifying', alert_attempts = alert_attempts + 1
  FROM selected WHERE p.id = selected.id RETURNING p.*;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_social_monitor_alerts(UUID, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_social_monitor_alerts(UUID, INTEGER, INTEGER) TO service_role;
