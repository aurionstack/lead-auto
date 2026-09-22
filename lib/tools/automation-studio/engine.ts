import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';
import { supabaseAdmin } from '@/lib/supabase';
import { runYouTubeDiscovery, processYouTubeOutreach } from '@/lib/tools/youtube-outreach/automation';
import { processRevQrJobs } from '@/lib/tools/revqr-whatsapp/automation';
import { getAutomationAction, type AutomationActionType } from './catalog';

type JsonObject = Record<string, unknown>;
type StoredStep = { id: string; position: number; action_type: AutomationActionType; action_config: JsonObject; retry_limit: number; continue_on_error: boolean };

function getPath(context: JsonObject, path: string) {
  return path.split('.').reduce<unknown>((value, key) => value && typeof value === 'object' ? (value as JsonObject)[key] : undefined, context);
}

function isPrivateAddress(address: string) {
  if (address === '::1' || address.startsWith('fc') || address.startsWith('fd') || address.startsWith('fe80:')) return true;
  const parts = address.split('.').map(Number);
  if (parts.length !== 4) return false;
  return parts[0] === 10 || parts[0] === 127 || (parts[0] === 169 && parts[1] === 254) || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168) || parts[0] === 0;
}

async function assertPublicHttps(rawUrl: string) {
  const url = new URL(rawUrl);
  if (url.protocol !== 'https:' || url.username || url.password || url.port) throw new Error('Webhook must use standard public HTTPS');
  if (url.hostname === 'localhost' || url.hostname.endsWith('.local') || isIP(url.hostname) && isPrivateAddress(url.hostname)) throw new Error('Private webhook destinations are blocked');
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) throw new Error('Webhook resolved to a private address');
  return url;
}

async function leadRecoverySnapshot(organizationId: string) {
  const [leads, queue] = await Promise.all([
    supabaseAdmin.from('leads').select('status').eq('organization_id', organizationId),
    supabaseAdmin.from('outreach_queue').select('status').eq('organization_id', organizationId),
  ]);
  if (leads.error || queue.error) throw leads.error || queue.error;
  const countBy = (rows: Array<{ status: string }>) => rows.reduce<Record<string, number>>((acc, row) => ({ ...acc, [row.status]: (acc[row.status] || 0) + 1 }), {});
  return { leads: countBy(leads.data || []), outreach: countBy(queue.data || []) };
}

async function executeAction(type: AutomationActionType, config: JsonObject, context: JsonObject, organizationId: string) {
  if (type === 'core.set_value') return { context: { ...context, [String(config.key)]: config.value } };
  if (type === 'core.condition') {
    const actual = getPath(context, String(config.field));
    const operator = String(config.operator);
    const passed = operator === 'exists' ? actual !== undefined && actual !== null : operator === 'equals' ? actual === config.value : actual !== config.value;
    return { context, halt: !passed, passed };
  }
  if (type === 'core.public_webhook') {
    const url = await assertPublicHttps(String(config.url));
    const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': 'AurionStack-Automation-Studio/1.0' }, body: JSON.stringify({ context }), redirect: 'error', signal: AbortSignal.timeout(15_000), cache: 'no-store' });
    if (!response.ok) throw new Error(`Webhook returned ${response.status}`);
    return { context, webhookStatus: response.status };
  }
  if (type === 'lead_recovery.snapshot') return { context: { ...context, leadRecovery: await leadRecoverySnapshot(organizationId) } };
  if (type === 'youtube.discover') return { context: { ...context, youtubeDiscovery: await runYouTubeDiscovery(organizationId) } };
  if (type === 'youtube.process_outreach') return { context: { ...context, youtubeOutreach: await processYouTubeOutreach(organizationId) } };
  if (type === 'revqr.process_conversations') return { context: { ...context, revqr: await processRevQrJobs(10, organizationId) } };
  throw new Error(`Unsupported action: ${type}`);
}

export async function processAutomationRuns(limit = 5) {
  const { data: runs, error } = await supabaseAdmin.from('automation_runs').select('*').eq('status', 'queued').order('created_at').limit(Math.max(1, Math.min(limit, 20)));
  if (error) throw error;
  let succeeded = 0;
  let failed = 0;
  for (const run of runs || []) {
    const { data: lock } = await supabaseAdmin.from('automation_runs').update({ status: 'running', started_at: new Date().toISOString() }).eq('id', run.id).eq('status', 'queued').select('id').maybeSingle();
    if (!lock) continue;
    let context = (run.input || {}) as JsonObject;
    try {
      const { data: workflow } = await supabaseAdmin.from('automation_workflows').select('*').eq('id', run.workflow_id).eq('organization_id', run.organization_id).single();
      if (!workflow || (run.trigger_source === 'schedule' && workflow.status !== 'active')) throw new Error('Workflow is not active');
      const { data: steps, error: stepsError } = await supabaseAdmin.from('automation_steps').select('*').eq('workflow_id', workflow.id).eq('organization_id', run.organization_id).order('position');
      if (stepsError) throw stepsError;
      let halted = false;
      for (const step of (steps || []) as StoredStep[]) {
        if (halted) {
          await supabaseAdmin.from('automation_run_steps').insert({ organization_id: run.organization_id, run_id: run.id, step_id: step.id, position: step.position, action_type: step.action_type, status: 'skipped', completed_at: new Date().toISOString() });
          continue;
        }
        const { data: runStep, error: runStepError } = await supabaseAdmin.from('automation_run_steps').insert({ organization_id: run.organization_id, run_id: run.id, step_id: step.id, position: step.position, action_type: step.action_type, status: 'running', attempt_count: 0 }).select('id').single();
        if (runStepError || !runStep) throw runStepError || new Error('Unable to create step audit record');
        let lastError: unknown;
        for (let attempt = 1; attempt <= step.retry_limit + 1; attempt += 1) {
          try {
            const result = await executeAction(step.action_type, step.action_config || {}, context, run.organization_id);
            context = result.context;
            halted = Boolean(result.halt);
            await supabaseAdmin.from('automation_run_steps').update({ status: 'succeeded', attempt_count: attempt, output: result, completed_at: new Date().toISOString() }).eq('id', runStep.id);
            lastError = null;
            break;
          } catch (cause) { lastError = cause; }
        }
        if (lastError) {
          const message = lastError instanceof Error ? lastError.message : String(lastError);
          await supabaseAdmin.from('automation_run_steps').update({ status: 'failed', attempt_count: step.retry_limit + 1, error_message: message, completed_at: new Date().toISOString() }).eq('id', runStep.id);
          if (!step.continue_on_error) throw new Error(`Step ${step.position + 1} failed: ${message}`);
        }
      }
      await supabaseAdmin.from('automation_runs').update({ status: 'succeeded', output: context, completed_at: new Date().toISOString() }).eq('id', run.id);
      await supabaseAdmin.from('automation_workflows').update({ last_run_at: new Date().toISOString() }).eq('id', run.workflow_id).eq('organization_id', run.organization_id);
      succeeded += 1;
    } catch (cause) {
      await supabaseAdmin.from('automation_runs').update({ status: 'failed', error_message: cause instanceof Error ? cause.message : String(cause), output: context, completed_at: new Date().toISOString() }).eq('id', run.id);
      failed += 1;
    }
  }
  return { examined: runs?.length || 0, succeeded, failed };
}

function nextRun(triggerType: string, config: JsonObject, from = new Date()) {
  if (triggerType === 'interval') return new Date(from.getTime() + Number(config.interval_minutes) * 60_000).toISOString();
  if (triggerType === 'daily') {
    const [hour, minute] = String(config.time_utc).split(':').map(Number);
    const date = new Date(from); date.setUTCHours(hour, minute, 0, 0); if (date <= from) date.setUTCDate(date.getUTCDate() + 1); return date.toISOString();
  }
  return null;
}

export async function enqueueDueAutomationRuns() {
  const now = new Date();
  const { data: workflows, error } = await supabaseAdmin.from('automation_workflows').select('*').eq('status', 'active').neq('trigger_type', 'manual').lte('next_run_at', now.toISOString()).limit(25);
  if (error) throw error;
  let queued = 0;
  for (const workflow of workflows || []) {
    const upcoming = nextRun(workflow.trigger_type, workflow.trigger_config || {}, now);
    const { data: claimed } = await supabaseAdmin.from('automation_workflows').update({ next_run_at: upcoming }).eq('id', workflow.id).eq('organization_id', workflow.organization_id).eq('status', 'active').lte('next_run_at', now.toISOString()).select('id').maybeSingle();
    if (!claimed) continue;
    const today = new Date(now); today.setUTCHours(0, 0, 0, 0);
    const { count } = await supabaseAdmin.from('automation_runs').select('*', { count: 'exact', head: true }).eq('workflow_id', workflow.id).gte('created_at', today.toISOString());
    if ((count || 0) >= workflow.daily_run_limit) continue;
    const { error: insertError } = await supabaseAdmin.from('automation_runs').insert({ organization_id: workflow.organization_id, workflow_id: workflow.id, trigger_source: 'schedule', status: 'queued', input: {} });
    if (!insertError) queued += 1;
  }
  return { due: workflows?.length || 0, queued };
}

export function calculateNextRun(triggerType: string, triggerConfig: JsonObject) { return nextRun(triggerType, triggerConfig); }
export function isKnownAutomationAction(type: string): type is AutomationActionType { return Boolean(getAutomationAction(type)); }
