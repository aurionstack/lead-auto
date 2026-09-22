import ToolShell from '@/components/shared/ToolShell';
import { getAutomationTool } from '@/lib/tools/registry';

const tool = getAutomationTool('automation-studio');
export default function AutomationStudioLayout({ children }: { children: React.ReactNode }) {
  return <ToolShell title={tool.name} description="Build reusable workflows from safe triggers and typed actions." icon={tool.icon} status="Workflow engine" navigation={[{ label: 'Workflow builder', href: tool.route }]}>{children}</ToolShell>;
}
