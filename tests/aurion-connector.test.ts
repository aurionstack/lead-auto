import { describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAurionStackMcpServer } from '../lib/mcp/server';
import type { McpRequestContext } from '../lib/mcp/auth';

const calls = vi.hoisted(() => ({
  leads: vi.fn().mockResolvedValue([{ id: 'lead-1', business_name: 'Example', status: 'suppressed' }]),
  creators: vi.fn().mockResolvedValue([{ id: 'creator-1', channel_name: 'Example' }]),
  audit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../lib/mcp/audit', () => ({ logMcpInvocation: calls.audit }));
vi.mock('../lib/tools/lead-recovery/service', async (importOriginal) => ({
  ...await importOriginal<Record<string, unknown>>(), listLeadRecoveryProspects: calls.leads,
}));
vi.mock('../lib/tools/youtube-outreach/service', async (importOriginal) => ({
  ...await importOriginal<Record<string, unknown>>(), listYouTubeCreators: calls.creators,
}));

const context: McpRequestContext = {
  supabase: {} as SupabaseClient,
  organizationId: 'authorized-org', userId: 'user-1', clientId: 'aurion-desktop',
};

describe('Aurion desktop connector contract', () => {
  it('returns server-resolved identity, pagination and read-only tools over MCP', async () => {
    const server = createAurionStackMcpServer(context);
    const client = new Client({ name: 'aurion-contract-test', version: '1.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    try {
      const tools = (await client.listTools()).tools;
      expect(tools).toHaveLength(8);
      expect(tools.every((tool) => tool.annotations?.readOnlyHint && !tool.annotations.destructiveHint)).toBe(true);
      const result = await client.callTool({
        name: 'lead_recovery.list_prospects', arguments: { statuses: ['suppressed'], limit: 100, offset: 100 },
      });
      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toMatchObject({ organizationId: context.organizationId, count: 1 });
      expect(calls.leads).toHaveBeenCalledWith(context, { statuses: ['suppressed'], limit: 100, offset: 100 });
      const youtube = await client.callTool({ name: 'youtube.list_creators', arguments: {} });
      expect(youtube.structuredContent).toMatchObject({ organizationId: context.organizationId });
      expect(calls.creators).toHaveBeenCalledWith(context, { limit: 25, offset: 0 });
      const denied = await client.callTool({ name: 'send_email', arguments: {} });
      expect(denied.isError).toBe(true);
      const invalid = await client.callTool({ name: 'lead_recovery.list_prospects', arguments: { offset: -1 } });
      expect(invalid.isError).toBe(true);
    } finally {
      await client.close();
      await server.close();
    }
  });

  it('pagination retains the tenant predicate and stable ordering in both services', async () => {
    const leadService = await vi.importActual<typeof import('../lib/tools/lead-recovery/service')>('../lib/tools/lead-recovery/service');
    const youtubeService = await vi.importActual<typeof import('../lib/tools/youtube-outreach/service')>('../lib/tools/youtube-outreach/service');
    const query = {
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(), range: vi.fn().mockReturnThis(),
      then: (resolve: (value: { data: unknown[]; error: null }) => void) => resolve({ data: [], error: null }),
    };
    const tenant = { ...context, supabase: { from: vi.fn().mockReturnValue(query) } as unknown as SupabaseClient };
    await leadService.listLeadRecoveryProspects(tenant, { limit: 100, offset: 200 });
    await youtubeService.listYouTubeCreators(tenant, { limit: 100, offset: 200 });
    expect(query.eq).toHaveBeenNthCalledWith(1, 'organization_id', context.organizationId);
    expect(query.eq).toHaveBeenNthCalledWith(2, 'organization_id', context.organizationId);
    expect(query.range).toHaveBeenCalledWith(200, 299);
    expect(query.order).toHaveBeenCalledWith('id', { ascending: true });
  });
});
