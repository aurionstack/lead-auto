import AutomationHub from '@/components/hub/AutomationHub';
import { getLeadRecoveryHubSummary } from '@/lib/tools/lead-recovery/service';
import { getYouTubeHubSummary } from '@/lib/tools/youtube-outreach/service';
import { getRevQrHubSummary } from '@/lib/tools/revqr-whatsapp/service';

export default async function DashboardPage() {
  const [leadRecovery, youtube, revqr] = await Promise.all([
    getLeadRecoveryHubSummary(),
    getYouTubeHubSummary(),
    getRevQrHubSummary(),
  ]);

  return <AutomationHub summaries={{
    'lead-recovery': leadRecovery,
    'youtube-outreach': { prospects: youtube.creators, replies: youtube.replies, active: youtube.active, databaseReady: youtube.databaseReady },
    'revqr-whatsapp': revqr,
  }} />;
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
