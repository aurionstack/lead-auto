import ApiKeysClient from '@/components/dashboard/ApiKeysClient';
import PageHeader from '@/components/shared/PageHeader';
import PlatformHeader from '@/components/shared/PlatformHeader';
import { createClient } from '@/lib/supabase-server';

async function getOrganizationSettings() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: membership } = await supabase.from('organization_members').select('organization_id').eq('user_id', user.id).limit(1).maybeSingle();
  if (!membership) return null;
  const { data: settings } = await supabase.from('organization_settings').select('*').eq('organization_id', membership.organization_id).maybeSingle();
  return settings ?? { organization_id: membership.organization_id };
}

export default async function IntegrationsPage() {
  const settings = await getOrganizationSettings();
  if (!settings) return <div className="mx-auto max-w-3xl p-8 text-slate-400">No organization is available for this account.</div>;
  return <div className="min-h-screen bg-[#080a10] text-slate-100"><PlatformHeader /><div className="mx-auto max-w-5xl px-5 py-8 sm:px-8"><PageHeader eyebrow="AurionStack platform" title="Shared integrations" description="Provider credentials are organization-scoped and shared only with tools that explicitly depend on them." /><ApiKeysClient initialSettings={settings} embedded /></div></div>;
}
export const dynamic = 'force-dynamic';
