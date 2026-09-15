import { getMcpResourceUrl, getSupabaseAuthorizationServer, MCP_READ_SCOPE } from '@/lib/mcp/auth';

export const dynamic = 'force-dynamic';

export function GET(request: Request): Response {
  const resource = getMcpResourceUrl(request);
  return Response.json({
    resource,
    authorization_servers: [getSupabaseAuthorizationServer()],
    scopes_supported: MCP_READ_SCOPE.split(' '),
    bearer_methods_supported: ['header'],
    resource_name: 'AurionStack Automation Hub',
    resource_documentation: `${new URL(resource).origin}/dashboard`,
  }, { headers: { 'Cache-Control': 'public, max-age=300', 'Access-Control-Allow-Origin': '*' } });
}
