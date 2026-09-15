import { notFound } from 'next/navigation';
import DashboardClient from '@/components/dashboard/DashboardClient';
import PageHeader from '@/components/shared/PageHeader';
import { getLeadRecoveryProspects } from '@/lib/tools/lead-recovery/service';

export default async function LeadRecoveryJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id) notFound();
  return <><PageHeader eyebrow="Lead Recovery campaign" title="Campaign prospects" description="Prospects collected for this discovery run, sorted by opportunity score." /><DashboardClient initialLeads={await getLeadRecoveryProspects(id)} embedded /></>;
}
export const dynamic = 'force-dynamic';
