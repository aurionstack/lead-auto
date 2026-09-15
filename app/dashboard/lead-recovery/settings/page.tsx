import SearchConfigsClient from '@/components/dashboard/SearchConfigsClient';
import PageHeader from '@/components/shared/PageHeader';
import { getLeadRecoveryConfigs } from '@/lib/tools/lead-recovery/service';

export default async function LeadRecoverySettingsPage() {
  return <><PageHeader eyebrow="Lead Recovery" title="Search targets" description="Manage US home-service discovery targets. New targets remain inactive until deliberately enabled." /><SearchConfigsClient configs={await getLeadRecoveryConfigs()} embedded /></>;
}
export const dynamic = 'force-dynamic';
