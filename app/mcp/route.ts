import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { enforceMcpRateLimit } from '@/lib/mcp/audit';
import { authenticateMcpRequest, createMcpUnauthorizedResponse, getMcpResourceUrl, McpAuthError } from '@/lib/mcp/auth';
import { createAurionStackMcpServer } from '@/lib/mcp/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, MCP-Protocol-Version, MCP-Session-Id, Last-Event-ID',
  'Access-Control-Expose-Headers': 'MCP-Protocol-Version, MCP-Session-Id, WWW-Authenticate',
};

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders)) headers.set(key, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function handler(request: Request): Promise<Response> {
  try {
    const context = await authenticateMcpRequest(request);
    await enforceMcpRateLimit(context);
    const server = createAurionStackMcpServer(context);
    const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
    await server.connect(transport);
    const token = request.headers.get('authorization')?.slice(7).trim() || '';
    const response = await transport.handleRequest(request, {
      authInfo: {
        token,
        clientId: context.clientId,
        scopes: ['openid', 'profile', 'email'],
        resource: new URL(getMcpResourceUrl(request)),
        extra: { organizationId: context.organizationId, userId: context.userId },
      },
    });
    return withCors(response);
  } catch (error) {
    if (error instanceof McpAuthError) {
      if (error.status === 401) return withCors(createMcpUnauthorizedResponse(request, error.message));
      return withCors(Response.json({ error: 'forbidden', error_description: error.message }, { status: error.status }));
    }
    console.error('[mcp] Request failed:', error);
    return withCors(Response.json({ error: 'service_unavailable', error_description: error instanceof Error ? error.message : 'MCP request failed.' }, { status: 503 }));
  }
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export const GET = handler;
export const POST = handler;
export const DELETE = handler;
