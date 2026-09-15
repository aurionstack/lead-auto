import ToolShell from '@/components/shared/ToolShell';
import { getAutomationTool } from '@/lib/tools/registry';

const tool = getAutomationTool('youtube-outreach');
const base = tool.route;

export default function YouTubeOutreachLayout({ children }: { children: React.ReactNode }) {
  return <ToolShell title={tool.name} description="Creator qualification, Shorts opportunity scoring, and outreach operations." icon={tool.icon} status="Paused · foundation" navigation={[
    { label: 'Overview', href: base }, { label: 'Creators', href: `${base}/creators` },
    { label: 'Campaigns', href: `${base}/campaigns` }, { label: 'Replies', href: `${base}/replies` },
    { label: 'Daily Automation', href: `${base}/automation` }, { label: 'Settings', href: `${base}/settings` },
  ]}>{children}</ToolShell>;
}
