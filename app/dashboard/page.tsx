// ============================================================
// app/dashboard/page.tsx — Dashboard Server Component
// ============================================================
import { Suspense } from 'react';
import { supabaseAdmin } from '@/lib/supabase';
import DashboardTabs from '@/components/dashboard/DashboardTabs';
import { Loader2 } from 'lucide-react';

async function fetchDashboardData() {
  // 1. Fetch Cron Jobs (Scrape Jobs)
  const { data: jobs } = await supabaseAdmin
    .from('scrape_jobs')
    .select('*')
    .order('created_at', { ascending: false });

  // 2. Fetch Sent Emails (Outreach History)
  const { data: outreach } = await supabaseAdmin
    .from('outreach_queue')
    .select(`
      *,
      leads (
        business_name,
        email
      )
    `)
    .eq('status', 'sent')
    .order('sent_at', { ascending: false });

  // 3. Fetch Leads Stats
  const { data: leads } = await supabaseAdmin
    .from('leads')
    .select('status, created_at');

  const leadStats = {
    total: leads?.length || 0,
    contacted: leads?.filter(l => l.status === 'contacted').length || 0,
    rejected: leads?.filter(l => l.status === 'rejected').length || 0,
    new: leads?.filter(l => l.status === 'new').length || 0,
  };

  // Generate 7-day Analytics (Emails Sent per day)
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toISOString().split('T')[0]; // YYYY-MM-DD
  }).reverse();

  const chartData = last7Days.map(dateStr => {
    const sentOnDate = outreach?.filter(o => o.sent_at?.startsWith(dateStr)).length || 0;
    return {
      date: dateStr,
      sent: sentOnDate
    };
  });

  return {
    jobs: jobs || [],
    outreach: outreach || [],
    leadStats,
    chartData
  };
}

export default async function DashboardPage() {
  const data = await fetchDashboardData();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-4xl font-bold text-white tracking-tight">System Dashboard</h1>
          <p className="text-slate-400 mt-2">Complete insights and analytics of the autonomous pipeline.</p>
        </div>
        
        <Suspense fallback={
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
          </div>
        }>
          <DashboardTabs data={data} />
        </Suspense>
      </div>
    </div>
  );
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
