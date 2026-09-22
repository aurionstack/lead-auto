import { createClient } from '@/lib/supabase-server';

export interface StudioWorkflow {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'active' | 'paused' | 'archived';
  trigger_type: 'manual' | 'interval' | 'daily';
  trigger_config: Record<string, unknown>;
  daily_run_limit: number;
  next_run_at: string | null;
  last_run_at: string | null;
  created_at: string;
  automation_steps?: Array<{ id: string; position: number; name: string; action_type: string; action_config: Record<string, unknown>; retry_limit: number; continue_on_error: boolean }>;
  automation_runs?: Array<{ id: string; status: string; trigger_source: string; error_message: string | null; created_at: string; completed_at: string | null }>;
}

export async function getAutomationStudioData() {
  const supabase = await createClient();
  const { data, error } = await supabase.from('automation_workflows').select('*, automation_steps(*), automation_runs(id,status,trigger_source,error_message,created_at,completed_at)').order('created_at', { ascending: false });
  if (error) return { databaseReady: false, workflows: [] as StudioWorkflow[] };
  const workflows = (data || []).map((workflow) => ({ ...workflow, automation_steps: [...(workflow.automation_steps || [])].sort((a, b) => a.position - b.position), automation_runs: [...(workflow.automation_runs || [])].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5) })) as StudioWorkflow[];
  return { databaseReady: true, workflows };
}

export async function getAutomationStudioHubSummary() {
  const data = await getAutomationStudioData();
  return { prospects: data.workflows.length, replies: data.workflows.reduce((total, workflow) => total + (workflow.automation_runs || []).filter((run) => run.status === 'succeeded').length, 0), active: data.workflows.some((workflow) => workflow.status === 'active'), databaseReady: data.databaseReady };
}
