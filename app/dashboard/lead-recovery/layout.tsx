import ToolShell from '@/components/shared/ToolShell';
import { getAutomationTool } from '@/lib/tools/registry';

const tool = getAutomationTool('lead-recovery');
const base = tool.route;

export default function LeadRecoveryLayout({ children }: { children: React.ReactNode }) {
  return <ToolShell title={tool.name} description="US home-service prospecting and missed-enquiry recovery." icon={tool.icon} status="Campaigns controlled" navigation={[
    { label: 'Overview', href: base }, { label: 'Prospects', href: `${base}/prospects` },
    { label: 'Campaigns', href: `${base}/campaigns` }, { label: 'Inbox', href: `${base}/inbox` },
    { label: 'Settings', href: `${base}/settings` },
  ]}>{children}</ToolShell>;
}
