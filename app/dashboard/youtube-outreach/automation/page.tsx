import AutomationConfig from '@/components/tools/youtube-outreach/AutomationConfig';
import PageHeader from '@/components/shared/PageHeader';
import { getYouTubeCampaign } from '@/lib/tools/youtube-outreach/service';

export default async function YouTubeAutomationPage() {
  const { campaign, databaseReady } = await getYouTubeCampaign();
  return <><PageHeader eyebrow="YouTube Outreach" title="Daily automation" description="Configure the future creator discovery and outreach cadence. Saving never activates or sends." /><AutomationConfig initialCampaign={campaign} databaseReady={databaseReady} /></>;
}
export const dynamic = 'force-dynamic';
