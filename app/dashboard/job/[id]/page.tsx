// ============================================================
// app/dashboard/job/[id]/page.tsx
// ============================================================
// Shows the leads inside a specific Scrape Job (batch)
// ============================================================

import { Suspense } from 'react';
import { supabaseAdmin } from '@/lib/supabase';
import type { Lead } from '@/lib/types';
import DashboardClient from '@/components/dashboard/DashboardClient';
import { Loader2 } from 'lucide-react';
import { notFound } from 'next/navigation';

async function fetchLeadsForJob(jobId: string): Promise<Lead[]> {
  const { data, error } = await supabaseAdmin
    .from('leads')
    .select('*')
    .eq('scrape_job_id', jobId)
    .neq('status', 'rejected')
    .order('opportunity_score', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[job-view] Supabase fetch error:', error.message);
    return [];
  }

  return (data ?? []) as Lead[];
}

export default async function JobPage({ params }: { params: { id: string } }) {
  const { id } = await params;
  
  if (!id) return notFound();

  const leads = await fetchLeadsForJob(id);

  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
      </div>
    }>
      <DashboardClient initialLeads={leads} isMockData={false} />
    </Suspense>
  );
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
