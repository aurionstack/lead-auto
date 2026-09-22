export const automationActionCatalog = [
  { type: 'core.set_value', name: 'Set workflow value', description: 'Add or replace a value in the workflow context.', risk: 'safe' },
  { type: 'core.condition', name: 'Conditional gate', description: 'Continue only when a context field matches a configured value.', risk: 'safe' },
  { type: 'core.public_webhook', name: 'Send public webhook', description: 'POST the workflow context to a public HTTPS endpoint without stored credentials.', risk: 'external' },
  { type: 'lead_recovery.snapshot', name: 'Lead Recovery snapshot', description: 'Capture tenant-scoped lead and outreach counts.', risk: 'safe' },
  { type: 'youtube.discover', name: 'Discover YouTube creators', description: 'Run guarded discovery for this workspace’s active YouTube campaign.', risk: 'provider' },
  { type: 'youtube.process_outreach', name: 'Process YouTube outreach', description: 'Process eligible queued creator outreach under existing campaign safeguards.', risk: 'outreach' },
  { type: 'revqr.process_conversations', name: 'Process RevQR conversations', description: 'Process opted-in RevQR jobs under WhatsApp consent and window rules.', risk: 'outreach' },
] as const;

export type AutomationActionType = (typeof automationActionCatalog)[number]['type'];
export type AutomationActionRisk = (typeof automationActionCatalog)[number]['risk'];

export function getAutomationAction(type: string) {
  return automationActionCatalog.find((action) => action.type === type) || null;
}

export function validateActionConfig(type: AutomationActionType, config: Record<string, unknown>) {
  if (type === 'core.set_value') return typeof config.key === 'string' && /^[a-zA-Z][a-zA-Z0-9_.-]{0,79}$/.test(config.key) && ['string', 'number', 'boolean'].includes(typeof config.value);
  if (type === 'core.condition') return typeof config.field === 'string' && config.field.length > 0 && config.field.length <= 80 && ['equals', 'not_equals', 'exists'].includes(String(config.operator || ''));
  if (type === 'core.public_webhook') { try { const url = new URL(String(config.url || '')); return url.protocol === 'https:' && !config.headers; } catch { return false; } }
  return Object.keys(config).length === 0;
}
