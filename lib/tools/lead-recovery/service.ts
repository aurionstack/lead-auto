import { createClient } from '@/lib/supabase-server';
import type { DashboardData, Lead, LeadStatus, OutreachRecord, ScrapeJob, SearchConfig } from '@/lib/types';

type LeadSummary = { status: LeadStatus; created_at: string; opportunity_score: number | null };
type QueueSummary = { status: 'pending' | 'locked' | 'sent' | 'failed'; sent_at: string | null; updated_at: string };

export async function getLeadRecoveryDashboardData(): Promise<DashboardData> {
  const supabase = await createClient();
  const [jobsResult, sentResult, leadsResult, queueResult] = await Promise.all([
    supabase.from('scrape_jobs').select('*').order('created_at', { ascending: false }).limit(24),
    supabase.from('outreach_queue').select('id, subject, body_text, body_html, sent_at, leads (business_name, email)').eq('status', 'sent').order('sent_at', { ascending: false }).limit(100),
    supabase.from('leads').select('status, created_at, opportunity_score'),
    supabase.from('outreach_queue').select('status, sent_at, updated_at'),
  ]);

  const failedQuery = [jobsResult, sentResult, leadsResult, queueResult].find((result) => result.error);
  if (failedQuery?.error) {
    console.error('[lead-recovery] Unable to load workspace:', failedQuery.error.message);
    throw new Error('The Lead Recovery workspace could not be loaded.');
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
  const last7Days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - index);
    return date.toISOString().slice(0, 10);
  }).reverse();

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
    chartData: last7Days.map((date) => ({
      date,
      sent: queue.filter((item) => item.status === 'sent' && item.sent_at?.startsWith(date)).length,
    })),
    lastActivityAt: queue[0]?.updated_at ?? jobs[0]?.created_at ?? leads[0]?.created_at ?? null,
  };
}

export async function getLeadRecoveryJobs(): Promise<ScrapeJob[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('scrape_jobs').select('*').order('created_at', { ascending: false }).limit(100);
  if (error) throw new Error('Lead Recovery campaigns could not be loaded.');
  return (data ?? []) as ScrapeJob[];
}

export async function getLeadRecoveryProspects(jobId?: string): Promise<Lead[]> {
  const supabase = await createClient();
  let query = supabase.from('leads').select('*').in('status', ['new', 'processing', 'approved']).order('opportunity_score', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).limit(250);
  if (jobId) query = query.eq('scrape_job_id', jobId);
  const { data, error } = await query;
  if (error) throw new Error('Lead Recovery prospects could not be loaded.');
  return (data ?? []) as Lead[];
}

export async function getLeadRecoveryConfigs(): Promise<SearchConfig[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('search_configs').select('*').order('created_at', { ascending: false });
  if (error) throw new Error('Lead Recovery search targets could not be loaded.');
  return (data ?? []) as SearchConfig[];
}

export async function getLeadRecoveryOutreach(): Promise<OutreachRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('outreach_queue').select('id, subject, body_text, body_html, sent_at, leads (business_name, email)').eq('status', 'sent').order('sent_at', { ascending: false }).limit(100);
  if (error) throw new Error('Lead Recovery outreach could not be loaded.');
  return (data ?? []) as unknown as OutreachRecord[];
}

export async function getLeadRecoveryHubSummary() {
  const supabase = await createClient();
  const [prospects, replies, activeTargets] = await Promise.all([
    supabase.from('leads').select('*', { count: 'exact', head: true }),
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'replied'),
    supabase.from('search_configs').select('*', { count: 'exact', head: true }).eq('is_active', true),
  ]);
  return { prospects: prospects.count ?? 0, replies: replies.count ?? 0, active: (activeTargets.count ?? 0) > 0 };
}
