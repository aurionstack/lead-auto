import LeadRecoveryOverview from '@/components/tools/lead-recovery/LeadRecoveryOverview';
import { getLeadRecoveryDashboardData } from '@/lib/tools/lead-recovery/service';

export default async function LeadRecoveryPage() {
  return <LeadRecoveryOverview data={await getLeadRecoveryDashboardData()} />;
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
