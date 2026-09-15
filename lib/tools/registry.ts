export type AutomationToolId = 'lead-recovery' | 'youtube-outreach';

export type AutomationToolStatus = 'operational' | 'foundation' | 'paused';

export interface AutomationTool {
  id: AutomationToolId;
  name: string;
  shortName: string;
  description: string;
  route: string;
  status: AutomationToolStatus;
  statusLabel: string;
  icon: 'radar' | 'youtube';
  accent: 'indigo' | 'rose';
  mcpNamespace: 'lead_recovery' | 'youtube';
}

export const automationTools: readonly AutomationTool[] = [
  {
    id: 'lead-recovery',
    name: 'Lead Recovery',
    shortName: 'Lead Recovery',
    description: 'Find and qualify US home-service companies, then recover missed inbound opportunities.',
    route: '/dashboard/lead-recovery',
    status: 'operational',
    statusLabel: 'Operational',
    icon: 'radar',
    accent: 'indigo',
    mcpNamespace: 'lead_recovery',
  },
  {
    id: 'youtube-outreach',
    name: 'YouTube Creator Outreach',
    shortName: 'YouTube Outreach',
    description: 'Qualify established creators who underuse Shorts and manage a focused acquisition pipeline.',
    route: '/dashboard/youtube-outreach',
    status: 'foundation',
    statusLabel: 'Foundation ready',
    icon: 'youtube',
    accent: 'rose',
    mcpNamespace: 'youtube',
  },
] as const;

export function getAutomationTool(id: AutomationToolId): AutomationTool {
  const tool = automationTools.find((candidate) => candidate.id === id);
  if (!tool) throw new Error(`Unknown automation tool: ${id}`);
  return tool;
}
