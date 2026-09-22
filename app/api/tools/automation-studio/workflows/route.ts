import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { getCurrentOrganizationId } from '@/lib/tenancy';
import { calculateNextRun, isKnownAutomationAction } from '@/lib/tools/automation-studio/engine';
import { getAutomationAction, validateActionConfig } from '@/lib/tools/automation-studio/catalog';

type StepInput = { name?: unknown; action_type?: unknown; action_config?: unknown; retry_limit?: unknown; continue_on_error?: unknown };

function validateTrigger(type: string, config: Record<string, unknown>) {
  if (type === 'manual') return Object.keys(config).length === 0;
  if (type === 'interval') return Number.isInteger(config.interval_minutes) && Number(config.interval_minutes) >= 5 && Number(config.interval_minutes) <= 10_080;
  if (type === 'daily') return typeof config.time_utc === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(config.time_utc);
  return false;
}

export async function POST(request: Request) {
  const organizationId = await getCurrentOrganizationId();
  if (!organizationId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  try {
    const input = await request.json() as { id?: string; name?: unknown; description?: unknown; trigger_type?: unknown; trigger_config?: unknown; daily_run_limit?: unknown; steps?: StepInput[] };
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    const description = typeof input.description === 'string' ? input.description.trim() : '';
    const triggerType = String(input.trigger_type || 'manual');
    const triggerConfig = input.trigger_config && typeof input.trigger_config === 'object' && !Array.isArray(input.trigger_config) ? input.trigger_config as Record<string, unknown> : {};
    const dailyRunLimit = Number(input.daily_run_limit);
    if (!name || name.length > 160 || description.length > 1000 || !validateTrigger(triggerType, triggerConfig) || !Number.isInteger(dailyRunLimit) || dailyRunLimit < 1 || dailyRunLimit > 1000 || !Array.isArray(input.steps) || input.steps.length < 1 || input.steps.length > 20) return NextResponse.json({ error: 'Invalid workflow configuration.' }, { status: 400 });
    const steps = input.steps.map((step, position) => {
      const actionType = String(step.action_type || '');
      const config = step.action_config && typeof step.action_config === 'object' && !Array.isArray(step.action_config) ? step.action_config as Record<string, unknown> : {};
      const retryLimit = Number(step.retry_limit ?? 1);
      const stepName = typeof step.name === 'string' ? step.name.trim() : '';
      if (!stepName || stepName.length > 160 || !isKnownAutomationAction(actionType) || !validateActionConfig(actionType, config) || !Number.isInteger(retryLimit) || retryLimit < 0 || retryLimit > 5 || typeof step.continue_on_error !== 'boolean') throw new Error(`Step ${position + 1} is invalid.`);
      return { organization_id: organizationId, position, name: stepName, action_type: actionType, action_config: config, retry_limit: retryLimit, continue_on_error: step.continue_on_error };
    });
    const supabase = await createClient();
    let workflowId = input.id;
    if (workflowId) {
      const { data: workflow, error } = await supabase.from('automation_workflows').update({ name, description, status: 'draft', trigger_type: triggerType, trigger_config: triggerConfig, daily_run_limit: dailyRunLimit, next_run_at: null }).eq('id', workflowId).eq('organization_id', organizationId).select('id').maybeSingle();
      if (error || !workflow) return NextResponse.json({ error: 'Workflow not found or could not be updated.' }, { status: 404 });
    } else {
      const { data: workflow, error } = await supabase.from('automation_workflows').insert({ organization_id: organizationId, name, description, status: 'draft', trigger_type: triggerType, trigger_config: triggerConfig, daily_run_limit: dailyRunLimit }).select('id').single();
      if (error || !workflow) throw error || new Error('Workflow could not be created.');
      workflowId = workflow.id;
    }
    const { error: stepError } = await supabase.rpc('replace_automation_steps', { p_workflow_id: workflowId, p_steps: steps });
    if (stepError) throw stepError;
    return NextResponse.json({ id: workflowId, status: 'draft' });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Workflow save failed.' }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const organizationId = await getCurrentOrganizationId();
  if (!organizationId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  try {
    const input = await request.json() as { id?: string; action?: 'activate' | 'pause' | 'run'; confirmation?: string };
    if (!input.id || !['activate', 'pause', 'run'].includes(input.action || '')) return NextResponse.json({ error: 'Invalid workflow action.' }, { status: 400 });
    const supabase = await createClient();
    const { data: workflow } = await supabase.from('automation_workflows').select('*, automation_steps(*)').eq('id', input.id).eq('organization_id', organizationId).maybeSingle();
    if (!workflow) return NextResponse.json({ error: 'Workflow not found.' }, { status: 404 });
    if (input.action === 'activate') {
      const risk = (workflow.automation_steps || []).map((step: { action_type: string }) => getAutomationAction(step.action_type)?.risk);
      const required = risk.includes('outreach') ? 'ACTIVATE OUTREACH AUTOMATION' : 'ACTIVATE AUTOMATION';
      if (input.confirmation !== required) return NextResponse.json({ error: `Type ${required} to activate.` }, { status: 400 });
      if (!(workflow.automation_steps || []).length) return NextResponse.json({ error: 'Add at least one step.' }, { status: 409 });
      const nextRunAt = calculateNextRun(workflow.trigger_type, workflow.trigger_config || {});
      const { error } = await supabase.from('automation_workflows').update({ status: 'active', next_run_at: nextRunAt }).eq('id', workflow.id).eq('organization_id', organizationId);
      if (error) throw error;
      return NextResponse.json({ status: 'active', next_run_at: nextRunAt });
    }
    if (input.action === 'pause') {
      const { error } = await supabase.from('automation_workflows').update({ status: 'paused', next_run_at: null }).eq('id', workflow.id).eq('organization_id', organizationId);
      if (error) throw error;
      return NextResponse.json({ status: 'paused' });
    }
    const runRisks = (workflow.automation_steps || []).map((step: { action_type: string }) => getAutomationAction(step.action_type)?.risk);
    const runConfirmation = runRisks.includes('outreach') ? 'RUN OUTREACH AUTOMATION' : runRisks.some((risk: string | undefined) => risk === 'provider' || risk === 'external') ? 'RUN AUTOMATION' : null;
    if (runConfirmation && input.confirmation !== runConfirmation) return NextResponse.json({ error: `Type ${runConfirmation} to run this workflow.` }, { status: 400 });
    const { data: run, error } = await supabase.from('automation_runs').insert({ organization_id: organizationId, workflow_id: workflow.id, trigger_source: 'manual', status: 'queued', input: {} }).select('id').single();
    if (error) throw error;
    return NextResponse.json({ status: 'queued', run_id: run.id });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Workflow action failed.' }, { status: 500 });
  }
}
