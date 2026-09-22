import ToolShell from '@/components/shared/ToolShell';
import { getAutomationTool } from '@/lib/tools/registry';

const tool = getAutomationTool('revqr-whatsapp');

export default function RevQrLayout({ children }: { children: React.ReactNode }) {
  return <ToolShell title={tool.name} description="Opt-in WhatsApp conversations, automatic demos, conversion, and onboarding." icon={tool.icon} status="Guarded automation" navigation={[
    { label: 'Overview', href: tool.route },
    { label: 'Campaign setup', href: `${tool.route}/campaigns` },
  ]}>{children}</ToolShell>;
}
