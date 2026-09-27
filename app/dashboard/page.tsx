import AutomationHub from '@/components/hub/AutomationHub';
import { getLeadRecoveryHubSummary } from '@/lib/tools/lead-recovery/service';
import { getYouTubeHubSummary } from '@/lib/tools/youtube-outreach/service';
import { getRevQrHubSummary } from '@/lib/tools/revqr-whatsapp/service';
import { getAutomationStudioData } from '@/lib/tools/automation-studio/service';

export default async function DashboardPage() {
  const [leadRecovery, youtube, revqr, studio] = await Promise.all([
    getLeadRecoveryHubSummary(),
    getYouTubeHubSummary(),
    getRevQrHubSummary(),
    getAutomationStudioData(),
  ]);

  return <AutomationHub summaries={{
    'lead-recovery': leadRecovery,
    'youtube-outreach': { prospects: youtube.creators, replies: youtube.replies, active: youtube.active, databaseReady: youtube.databaseReady },
    'revqr-whatsapp': revqr,
    'automation-studio': { prospects: studio.workflows.length, replies: 0, active: studio.workflows.some((workflow) => workflow.status === 'active'), databaseReady: studio.databaseReady },
  }} workflows={studio.workflows} />;
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
