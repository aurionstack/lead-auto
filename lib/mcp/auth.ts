import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const MCP_READ_SCOPE = 'openid profile email';

export interface McpRequestContext {
  supabase: SupabaseClient;
  organizationId: string;
  userId: string;
  clientId: string;
}

export class McpAuthError extends Error {
  constructor(message: string, public readonly status = 401) {
    super(message);
  }
}

export function getMcpResourceUrl(request?: Request): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL;
  const origin = configured || (request ? new URL(request.url).origin : 'http://localhost:3000');
  return `${origin.replace(/\/$/, '')}/mcp`;
}

export function getSupabaseAuthorizationServer(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured.');
  return `${url.replace(/\/$/, '')}/auth/v1`;
}

export function getProtectedResourceMetadataUrl(request?: Request): string {
  const resource = new URL(getMcpResourceUrl(request));
  return `${resource.origin}/.well-known/oauth-protected-resource`;
}

export function createMcpUnauthorizedResponse(request: Request, message = 'Authentication required.'): Response {
  return Response.json(
    { error: 'unauthorized', error_description: message },
    {
      status: 401,
      headers: {
        'Cache-Control': 'no-store',
        'WWW-Authenticate': `Bearer resource_metadata="${getProtectedResourceMetadataUrl(request)}", scope="${MCP_READ_SCOPE}"`,
      },
    },
  );
}

function hasExpectedAudience(audience: unknown): boolean {
  return audience === 'authenticated' || (Array.isArray(audience) && audience.includes('authenticated'));
}

export function validateMcpClaims(claims: Record<string, unknown> | undefined, supabaseUrl: string) {
  const expectedIssuer = `${supabaseUrl.replace(/\/$/, '')}/auth/v1`;
  const userId = typeof claims?.sub === 'string' ? claims.sub : '';
  const clientId = typeof claims?.client_id === 'string' ? claims.client_id : '';

  if (!userId || claims?.iss !== expectedIssuer || !hasExpectedAudience(claims?.aud) || !clientId) {
    throw new McpAuthError('The bearer access token is invalid, expired, or was not issued for MCP OAuth access.');
  }

  return { userId, clientId };
}

export async function authenticateMcpRequest(request: Request): Promise<McpRequestContext> {
  const authorization = request.headers.get('authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) throw new McpAuthError('A bearer access token is required.');

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new McpAuthError('MCP authentication is not configured.', 503);

  const supabase = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
  const claims = claimsData?.claims as Record<string, unknown> | undefined;
  if (claimsError) throw new McpAuthError('The bearer access token is invalid or expired.');
  const { userId, clientId } = validateMcpClaims(claims, url);

  const { data: membership, error: membershipError } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (membershipError) throw new McpAuthError('Organization access could not be verified.', 503);
  if (!membership?.organization_id) throw new McpAuthError('The authenticated user has no AurionStack workspace.', 403);

  return {
    supabase,
    organizationId: membership.organization_id,
    userId,
    clientId,
  };
}
