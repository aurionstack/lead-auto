import DashboardClient from '@/components/dashboard/DashboardClient';
import PageHeader from '@/components/shared/PageHeader';
import { getLeadRecoveryProspects } from '@/lib/tools/lead-recovery/service';

export default async function LeadRecoveryProspectsPage() {
  return <><PageHeader eyebrow="Lead Recovery" title="Prospects" description="Review qualification evidence, refine outreach, and approve eligible companies." /><DashboardClient initialLeads={await getLeadRecoveryProspects()} embedded /></>;
}
export const dynamic = 'force-dynamic';
