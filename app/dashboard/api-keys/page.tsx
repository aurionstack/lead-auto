// ============================================================
// app/dashboard/api-keys/page.tsx
// ============================================================

import { Suspense } from 'react';
import { createClient } from '@/lib/supabase-server';
import { hasDashboardSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
// Import the client component
import ApiKeysClient from '@/components/dashboard/ApiKeysClient';
import { Loader2 } from 'lucide-react';

async function fetchApiKeys() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: members } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .limit(1)
    .single();

  if (!members) return null;

  const { data: settings } = await supabase
    .from('organization_settings')
    .select('*')
    .eq('organization_id', members.organization_id)
    .single();

  return settings || { organization_id: members.organization_id };
}

export default async function ApiKeysPage() {
  if (!(await hasDashboardSession())) redirect('/login');
  const settings = await fetchApiKeys();

  if (!settings) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <h1 className="text-white text-xl font-bold">No Organization Found</h1>
        <p className="text-slate-400">You must be part of an organization to configure API keys.</p>
      </div>
    );
  }

  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
      </div>
    }>
      <ApiKeysClient initialSettings={settings} />
    </Suspense>
  );
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
