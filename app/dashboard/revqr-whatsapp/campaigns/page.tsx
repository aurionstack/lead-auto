import PageHeader from '@/components/shared/PageHeader';
import CampaignConfig from '@/components/tools/revqr-whatsapp/CampaignConfig';
import { getRevQrDashboardData } from '@/lib/tools/revqr-whatsapp/service';

export default async function RevQrCampaignPage() {
  const data = await getRevQrDashboardData();
  return <><PageHeader eyebrow="RevQR WhatsApp" title="Campaign setup" description="Connect the official Meta Cloud API and activate unattended handling for opted-in conversations." />{!data.databaseReady && <div className="mb-5 rounded-xl border border-amber-300/15 bg-amber-300/[0.05] px-4 py-3 text-sm text-amber-200">Apply migration 012 before saving this configuration.</div>}<CampaignConfig campaign={data.campaign} /></>;
}
export const dynamic = 'force-dynamic';
