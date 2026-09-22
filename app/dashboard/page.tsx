import AutomationHub from '@/components/hub/AutomationHub';
import { getLeadRecoveryHubSummary } from '@/lib/tools/lead-recovery/service';
import { getYouTubeHubSummary } from '@/lib/tools/youtube-outreach/service';
import { getRevQrHubSummary } from '@/lib/tools/revqr-whatsapp/service';
import { getAutomationStudioHubSummary } from '@/lib/tools/automation-studio/service';

export default async function DashboardPage() {
  const [leadRecovery, youtube, revqr, studio] = await Promise.all([
    getLeadRecoveryHubSummary(),
    getYouTubeHubSummary(),
    getRevQrHubSummary(),
    getAutomationStudioHubSummary(),
  ]);

  return <AutomationHub summaries={{
    'lead-recovery': leadRecovery,
    'youtube-outreach': { prospects: youtube.creators, replies: youtube.replies, active: youtube.active, databaseReady: youtube.databaseReady },
    'revqr-whatsapp': revqr,
    'automation-studio': studio,
  }} />;
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
