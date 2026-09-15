-- Require a tenant-owned postal address for compliant commercial outreach.
ALTER TABLE public.organization_settings
  ADD COLUMN IF NOT EXISTS postal_address TEXT;

COMMENT ON COLUMN public.organization_settings.postal_address IS
  'Physical postal address included in commercial email footers.';
