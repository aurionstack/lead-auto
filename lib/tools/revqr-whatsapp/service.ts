import { createClient } from '@/lib/supabase-server';
import type { RevQrCampaign, RevQrDashboardData, RevQrProspectStatus } from './types';

const emptyMetrics: RevQrDashboardData['metrics'] = { prospects: 0, openConversations: 0, replies: 0, demoSent: 0, interested: 0, paymentSent: 0, customers: 0, pendingJobs: 0, failedJobs: 0 };

export async function getRevQrDashboardData(): Promise<RevQrDashboardData> {
  const supabase = await createClient();
  const [campaignResult, prospectsResult, conversationsResult, jobsResult] = await Promise.all([
    supabase.from('revqr_campaigns').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('revqr_prospects').select('id,business_name,phone_e164,status,updated_at').order('updated_at', { ascending: false }).limit(250),
    supabase.from('revqr_conversations').select('status'),
    supabase.from('revqr_jobs').select('status'),
  ]);
  if (campaignResult.error || prospectsResult.error || conversationsResult.error || jobsResult.error) return { databaseReady: false, active: false, campaign: null, metrics: emptyMetrics, recentProspects: [] };
  const prospects = (prospectsResult.data || []) as Array<{ id: string; business_name: string | null; phone_e164: string; status: RevQrProspectStatus; updated_at: string }>;
  const count = (...statuses: RevQrProspectStatus[]) => prospects.filter((prospect) => statuses.includes(prospect.status)).length;
  const campaign = campaignResult.data as RevQrCampaign | null;
  return {
    databaseReady: true,
    active: campaign?.status === 'active',
    campaign,
    metrics: {
      prospects: prospects.length,
      openConversations: (conversationsResult.data || []).filter((row) => row.status === 'open').length,
      replies: count('replied', 'demo_sent', 'interested', 'payment_sent', 'customer'),
      demoSent: count('demo_sent'),
      interested: count('interested'),
      paymentSent: count('payment_sent'),
      customers: count('customer'),
      pendingJobs: (jobsResult.data || []).filter((row) => row.status === 'pending').length,
      failedJobs: (jobsResult.data || []).filter((row) => row.status === 'failed').length,
    },
    recentProspects: prospects.slice(0, 8),
  };
}

export async function getRevQrHubSummary() {
  const data = await getRevQrDashboardData();
  return { prospects: data.metrics.prospects, replies: data.metrics.replies, active: data.active, databaseReady: data.databaseReady };
}
