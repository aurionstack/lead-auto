import BatchListClient from '@/components/dashboard/BatchListClient';
import PageHeader from '@/components/shared/PageHeader';
import { getLeadRecoveryJobs } from '@/lib/tools/lead-recovery/service';

export default async function LeadRecoveryCampaignsPage() {
  return <><PageHeader eyebrow="Lead Recovery" title="Campaigns" description="Review discovery runs and launch a controlled US home-services search." /><BatchListClient jobs={await getLeadRecoveryJobs()} /></>;
}
export const dynamic = 'force-dynamic';
