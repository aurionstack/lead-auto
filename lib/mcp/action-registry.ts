import type { AutomationToolId } from '@/lib/tools/registry';

export type McpActionRisk = 'read' | 'write' | 'outreach';

export interface McpBusinessAction {
  name: string;
  toolId: AutomationToolId;
  description: string;
  risk: McpActionRisk;
  requiresExplicitAuthorization: boolean;
  enabled: boolean;
  serviceBoundary: string;
}

export const mcpBusinessActions: readonly McpBusinessAction[] = [
  { name: 'lead_recovery.get_status', toolId: 'lead-recovery', description: 'Read campaign and pipeline status.', risk: 'read', requiresExplicitAuthorization: false, enabled: false, serviceBoundary: 'lib/tools/lead-recovery' },
  { name: 'lead_recovery.list_prospects', toolId: 'lead-recovery', description: 'List tenant-scoped qualified prospects.', risk: 'read', requiresExplicitAuthorization: false, enabled: false, serviceBoundary: 'lib/tools/lead-recovery' },
  { name: 'lead_recovery.preview_outreach', toolId: 'lead-recovery', description: 'Preview outreach without queueing or sending.', risk: 'read', requiresExplicitAuthorization: false, enabled: false, serviceBoundary: 'lib/tools/lead-recovery' },
  { name: 'lead_recovery.send_batch', toolId: 'lead-recovery', description: 'Queue an approved outreach batch through existing safety checks.', risk: 'outreach', requiresExplicitAuthorization: true, enabled: false, serviceBoundary: 'lib/tools/lead-recovery' },
  { name: 'youtube.get_status', toolId: 'youtube-outreach', description: 'Read creator pipeline and campaign status.', risk: 'read', requiresExplicitAuthorization: false, enabled: false, serviceBoundary: 'lib/tools/youtube-outreach' },
  { name: 'youtube.list_creators', toolId: 'youtube-outreach', description: 'List tenant-scoped creator prospects.', risk: 'read', requiresExplicitAuthorization: false, enabled: false, serviceBoundary: 'lib/tools/youtube-outreach' },
  { name: 'youtube.preview_outreach', toolId: 'youtube-outreach', description: 'Preview creator outreach without sending.', risk: 'read', requiresExplicitAuthorization: false, enabled: false, serviceBoundary: 'lib/tools/youtube-outreach' },
  { name: 'youtube.send_outreach', toolId: 'youtube-outreach', description: 'Send an explicitly approved creator outreach batch.', risk: 'outreach', requiresExplicitAuthorization: true, enabled: false, serviceBoundary: 'lib/tools/youtube-outreach' },
] as const;

export function getMcpActionsForTool(toolId: AutomationToolId) {
  return mcpBusinessActions.filter((action) => action.toolId === toolId);
}
