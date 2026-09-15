import AutomationHub from '@/components/hub/AutomationHub';
import { getLeadRecoveryHubSummary } from '@/lib/tools/lead-recovery/service';
import { getYouTubeHubSummary } from '@/lib/tools/youtube-outreach/service';

export default async function DashboardPage() {
  const [leadRecovery, youtube] = await Promise.all([
    getLeadRecoveryHubSummary(),
    getYouTubeHubSummary(),
  ]);

  return <AutomationHub summaries={{
    'lead-recovery': leadRecovery,
    'youtube-outreach': { prospects: youtube.creators, replies: youtube.replies, active: youtube.active, databaseReady: youtube.databaseReady },
  }} />;
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
