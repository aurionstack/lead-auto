import { supabaseAdmin } from '@/lib/supabase';
import type { McpRequestContext } from './auth';

export async function enforceMcpRateLimit(context: McpRequestContext): Promise<void> {
  const configuredLimit = Number.parseInt(process.env.MCP_REQUESTS_PER_MINUTE || '60', 10);
  const limit = Number.isFinite(configuredLimit) ? Math.max(10, Math.min(configuredLimit, 600)) : 60;
  const subject = `${context.organizationId}:${context.userId}:${context.clientId}`;
  const { data, error } = await supabaseAdmin.rpc('consume_mcp_rate_limit', {
    subject_key: subject,
    request_limit: limit,
    window_seconds: 60,
  });
  if (error) throw new Error('MCP rate limiting is unavailable. Apply migration 011.');
  const result = Array.isArray(data) ? data[0] : data;
  if (!result?.allowed) throw new Error('MCP request limit exceeded. Try again shortly.');
}

export async function logMcpInvocation(input: {
  context: McpRequestContext;
  toolName: string;
  success: boolean;
  durationMs: number;
  errorCode?: string;
}): Promise<void> {
  const { error } = await supabaseAdmin.from('mcp_audit_logs').insert({
    organization_id: input.context.organizationId,
    user_id: input.context.userId,
    client_id: input.context.clientId,
    tool_name: input.toolName,
    success: input.success,
    duration_ms: Math.max(0, Math.round(input.durationMs)),
    error_code: input.errorCode || null,
  });
  if (error) console.error('[mcp] Audit log failed:', error.message);
}
