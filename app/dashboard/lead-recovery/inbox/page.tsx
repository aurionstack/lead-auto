import SentInbox from '@/components/dashboard/SentInbox';
import PageHeader from '@/components/shared/PageHeader';
import { getLeadRecoveryOutreach } from '@/lib/tools/lead-recovery/service';

export default async function LeadRecoveryInboxPage() {
  return <><PageHeader eyebrow="Lead Recovery" title="Sent outreach" description="Audit sent messages and delivery history. Replies continue to stop follow-up sequences server-side." /><SentInbox outreach={await getLeadRecoveryOutreach()} /></>;
}
export const dynamic = 'force-dynamic';
