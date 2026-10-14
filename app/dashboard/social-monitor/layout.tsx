import ToolShell from '@/components/shared/ToolShell';
import { getAutomationTool } from '@/lib/tools/registry';

const tool = getAutomationTool('social-monitor');

export default function SocialMonitorLayout({ children }: { children: React.ReactNode }) {
  return <ToolShell title={tool.name} description="Public buyer-intent discovery for AurionStack services. Alerts and draft replies only; no automatic public outreach." icon={tool.icon} status="Paused by default" navigation={[
    { label: 'Overview & setup', href: tool.route },
  ]}>{children}</ToolShell>;
}
