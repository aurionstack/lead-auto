// ============================================================
// app/dashboard/settings/page.tsx
// ============================================================

import { Suspense } from 'react';
import { createClient } from '@/lib/supabase-server';
import { hasDashboardSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import type { SearchConfig } from '@/lib/types';
import SearchConfigsClient from '@/components/dashboard/SearchConfigsClient';
import { Loader2 } from 'lucide-react';

async function fetchConfigs(): Promise<SearchConfig[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('search_configs')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[settings] Supabase fetch error:', error.message);
    return [];
  }

  return (data ?? []) as SearchConfig[];
}

export default async function SettingsPage() {
  if (!(await hasDashboardSession())) redirect('/login');
  const configs = await fetchConfigs();

  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
      </div>
    }>
      <SearchConfigsClient configs={configs} />
    </Suspense>
  );
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
