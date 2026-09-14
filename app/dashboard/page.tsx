// ============================================================
// app/dashboard/page.tsx — Dashboard Server Component
// ============================================================
import { createClient } from '@/lib/supabase-server';
import DashboardTabs from '@/components/dashboard/DashboardTabs';
import { hasDashboardSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import type { DashboardData, LeadStatus, OutreachRecord, ScrapeJob } from '@/lib/types';

type LeadSummary = { status: LeadStatus; created_at: string; opportunity_score: number | null };
type QueueSummary = { status: 'pending' | 'locked' | 'sent' | 'failed'; sent_at: string | null; updated_at: string };

async function fetchDashboardData(): Promise<DashboardData> {
  const supabase = await createClient();

  const [jobsResult, sentResult, leadsResult, queueResult] = await Promise.all([
    supabase.from('scrape_jobs').select('*').order('created_at', { ascending: false }).limit(24),
    supabase
      .from('outreach_queue')
      .select('id, subject, body_text, body_html, sent_at, leads (business_name, email)')
      .eq('status', 'sent')
      .order('sent_at', { ascending: false })
      .limit(100),
    supabase.from('leads').select('status, created_at, opportunity_score'),
    supabase.from('outreach_queue').select('status, sent_at, updated_at'),
  ]);

  const failedQuery = [jobsResult, sentResult, leadsResult, queueResult].find((result) => result.error);
  if (failedQuery?.error) {
    console.error('[dashboard] Unable to load workspace:', failedQuery.error.message);
    throw new Error('The workspace data could not be loaded.');
  }

  const jobs = (jobsResult.data ?? []) as ScrapeJob[];
  const outreach = (sentResult.data ?? []) as unknown as OutreachRecord[];
  const leads = (leadsResult.data ?? []) as LeadSummary[];
  const queue = (queueResult.data ?? []) as QueueSummary[];

  const leadStats = {
    total: leads.length,
    contacted: leads.filter((lead) => lead.status === 'contacted').length,
    rejected: leads.filter((lead) => lead.status === 'rejected').length,
    new: leads.filter((lead) => ['new', 'processing'].includes(lead.status)).length,
    qualified: leads.filter((lead) => lead.status === 'approved' || (lead.opportunity_score ?? 0) >= 70).length,
    replied: leads.filter((lead) => lead.status === 'replied').length,
  };

  const today = new Date().toISOString().slice(0, 10);
  const outreachStats = {
    sent: queue.filter((item) => item.status === 'sent').length,
    sentToday: queue.filter((item) => item.status === 'sent' && item.sent_at?.startsWith(today)).length,
    pending: queue.filter((item) => item.status === 'pending' || item.status === 'locked').length,
    failed: queue.filter((item) => item.status === 'failed').length,
  };

  // Generate 7-day Analytics (Emails Sent per day)
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toISOString().split('T')[0]; // YYYY-MM-DD
  }).reverse();

  const chartData = last7Days.map(dateStr => {
    const sentOnDate = queue.filter((item) => item.status === 'sent' && item.sent_at?.startsWith(dateStr)).length;
    return {
      date: dateStr,
      sent: sentOnDate
    };
  });

  return {
    jobs,
    outreach,
    leadStats,
    outreachStats,
    pipeline: [
      { label: 'Discovered', value: leadStats.total, tone: '#818cf8' },
      { label: 'Qualified', value: leadStats.qualified, tone: '#a78bfa' },
      { label: 'Contacted', value: leadStats.contacted, tone: '#22d3ee' },
      { label: 'Replied', value: leadStats.replied, tone: '#34d399' },
    ],
    chartData,
    lastActivityAt: queue[0]?.updated_at ?? jobs[0]?.created_at ?? leads[0]?.created_at ?? null,
  };
}

export default async function DashboardPage() {
  if (!(await hasDashboardSession())) redirect('/login');
  const data = await fetchDashboardData();

  return <DashboardTabs data={data} />;
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
