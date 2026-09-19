import { afterEach, describe, expect, it, vi } from 'vitest';
import { isBearerAuthorized, isCronAuthorized } from '../lib/auth';
import { appendComplianceFooter, buildOutreachHtml } from '../lib/email/templates';
import { buildOneClickUnsubscribeUrl, buildUnsubscribeUrl, createUnsubscribeToken, verifyUnsubscribeToken } from '../lib/email/unsubscribe';
import { findEmailWithRegex } from '../lib/email-parser';
import { ACTIVE_CAMPAIGN, campaignSequenceId, isHomeServiceCategory, isUnitedStatesLocation, validateCampaignTarget } from '../lib/campaign';
import { automationTools, getAutomationTool } from '../lib/tools/registry';
import { DEFAULT_YOUTUBE_CAMPAIGN } from '../lib/tools/youtube-outreach/types';
import { mcpBusinessActions } from '../lib/mcp/action-registry';
import { createMcpUnauthorizedResponse, getMcpResourceUrl, validateMcpClaims } from '../lib/mcp/auth';
import { createAurionStackMcpServer } from '../lib/mcp/server';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { parseEmailProviderEvents } from '../lib/email/webhook';

afterEach(() => vi.unstubAllEnvs());

describe('authorization', () => {
  it('fails closed when cron secrets are absent or incorrect', () => {
    vi.stubEnv('CRON_SECRET', '');
    expect(isCronAuthorized(new Request('https://example.com'))).toBe(false);
    expect(isBearerAuthorized(new Request('https://example.com'), undefined)).toBe(false);

    vi.stubEnv('CRON_SECRET', 'cron-secret');
    expect(isCronAuthorized(new Request('https://example.com', { headers: { authorization: 'Bearer wrong' } }))).toBe(false);
    expect(isCronAuthorized(new Request('https://example.com', { headers: { authorization: 'Bearer cron-secret' } }))).toBe(true);
  });
});

describe('email provider webhooks', () => {
  it('parses SMTP2GO delivery payloads and their custom message ID', () => {
    const [event] = parseEmailProviderEvents({
      event: 'delivered',
      rcpt: 'owner@example.com',
      'message-id': '<outreach-queue-id@aurionstack.dev>',
      time: 1_789_000_000,
    });
    expect(event).toMatchObject({
      email: 'owner@example.com',
      eventType: 'delivered',
      messageId: '<outreach-queue-id@aurionstack.dev>',
    });
    expect(event.timestamp).toBeInstanceOf(Date);
  });

  it('maps safety events and ignores non-delivery lifecycle events', () => {
    expect(parseEmailProviderEvents({ event: 'bounce', recipients: ['bad@example.com'] })[0]?.eventType).toBe('bounced');
    expect(parseEmailProviderEvents({ event: 'spam', rcpt: 'bad@example.com' })[0]?.eventType).toBe('complained');
    expect(parseEmailProviderEvents({ event: 'resubscribed', rcpt: 'ok@example.com' })).toEqual([]);
    expect(parseEmailProviderEvents({ event: 'processed', rcpt: 'ok@example.com' })).toEqual([]);
    expect(parseEmailProviderEvents({ event: 'reject', rcpt: 'ok@example.com' })[0]?.eventType).toBe('failed');
  });
});

describe('outreach safety', () => {
  it('escapes AI-generated HTML while preserving line breaks', () => {
    const html = buildOutreachHtml({
      businessName: '<Acme>',
      body: '<script>alert(1)</script>\nHello',
      unsubscribeLink: 'https://example.com/unsubscribe?a=1&b=2',
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;<br/>Hello');
    expect(html).toContain('&lt;Acme&gt;');
    expect(html).toContain('a=1&amp;b=2');
  });

  it('creates verifiable, tamper-resistant unsubscribe links', () => {
    vi.stubEnv('UNSUBSCRIBE_SECRET', 'an-independent-unsubscribe-secret');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://leads.example.com');
    const token = createUnsubscribeToken('lead-123');
    expect(verifyUnsubscribeToken('lead-123', token)).toBe(true);
    expect(verifyUnsubscribeToken('lead-456', token)).toBe(false);
    expect(buildUnsubscribeUrl('lead-123')).toContain('https://leads.example.com/unsubscribe?');
    expect(buildOneClickUnsubscribeUrl('lead-123')).toContain('https://leads.example.com/api/unsubscribe?');
  });

  it('deduplicates scraped emails and excludes common false positives', () => {
    const emails = findEmailWithRegex('A@Example.org a@example.org hero@2x.png demo@example.com');
    expect(emails.map((entry) => entry.email)).toEqual(['a@example.org']);
  });

  it('adds sender identification and an escaped postal address', () => {
    const result = appendComplianceFooter('<html><body>Hello</body></html>', 'Hello', 'AurionStack', '10 Main St & Suite 2');
    expect(result.html).toContain('AurionStack<br/>10 Main St &amp; Suite 2');
    expect(result.text).toContain('AurionStack\n10 Main St & Suite 2');
  });
});

describe('active campaign targeting', () => {
  it('accepts the US home-services pilot targets', () => {
    expect(validateCampaignTarget('HVAC contractors', 'Dallas, Texas')).toBeNull();
    expect(validateCampaignTarget('garage door company', 'Phoenix, AZ 85001')).toBeNull();
    expect(validateCampaignTarget('roofing company', 'Austin, Texas, USA')).toBeNull();
    expect(ACTIVE_CAMPAIGN.targets).toHaveLength(2);
    expect(ACTIVE_CAMPAIGN.targets.reduce((total, target) => total + target.maxResults, 0)).toBe(100);
    expect(ACTIVE_CAMPAIGN.followUps.map((followUp) => followUp.delayDays)).toEqual([1, 3]);
    expect(campaignSequenceId(2)).toBe('us-home-services-pilot:follow-up-2');
  });

  it('rejects India, other international markets, and unrelated niches', () => {
    expect(isUnitedStatesLocation('Mumbai, India')).toBe(false);
    expect(isHomeServiceCategory('Dental implant specialist')).toBe(false);
    expect(validateCampaignTarget('HVAC contractors', 'London, UK')).toMatch(/United States/);
    expect(validateCampaignTarget('Marketing agency', 'Dallas, Texas')).toMatch(/HVAC/);
  });
});

describe('automation hub architecture', () => {
  it('registers independent Lead Recovery and YouTube tools', () => {
    expect(automationTools.map((tool) => tool.id)).toEqual(['lead-recovery', 'youtube-outreach']);
    expect(getAutomationTool('lead-recovery').route).toBe('/dashboard/lead-recovery');
    expect(getAutomationTool('youtube-outreach').mcpNamespace).toBe('youtube');
  });

  it('keeps the YouTube campaign and high-risk MCP actions disabled by default', () => {
    expect(DEFAULT_YOUTUBE_CAMPAIGN.status).toBe('paused');
    expect(DEFAULT_YOUTUBE_CAMPAIGN.sender_identity).toBe('samir@aurionstack.dev');
    const outreachActions = mcpBusinessActions.filter((action) => action.risk === 'outreach');
    expect(outreachActions.length).toBeGreaterThan(0);
    expect(outreachActions.every((action) => !action.enabled && action.requiresExplicitAuthorization)).toBe(true);
  });

  it('exposes only the Phase 2 read-only MCP actions', () => {
    const enabled = mcpBusinessActions.filter((action) => action.enabled);
    expect(enabled.map((action) => action.name)).toEqual([
      'lead_recovery.get_status',
      'lead_recovery.list_prospects',
      'lead_recovery.get_replies',
      'lead_recovery.get_stats',
      'youtube.get_status',
      'youtube.list_creators',
      'youtube.get_replies',
      'youtube.get_stats',
    ]);
    expect(enabled.every((action) => action.risk === 'read' && !action.requiresExplicitAuthorization)).toBe(true);
  });
});

describe('MCP authorization metadata', () => {
  it('fails with an OAuth discovery challenge and uses the canonical MCP resource URL', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://automation.example.com/');
    const request = new Request('https://automation.example.com/mcp');
    const response = createMcpUnauthorizedResponse(request);
    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toContain('oauth-protected-resource');
    expect(getMcpResourceUrl(request)).toBe('https://automation.example.com/mcp');
    await expect(response.json()).resolves.toMatchObject({ error: 'unauthorized' });
  });

  it('registers the eight read-only Phase 2 tools over MCP', async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createAurionStackMcpServer({
      supabase: {} as SupabaseClient,
      organizationId: 'organization-1',
      userId: 'user-1',
      clientId: 'client-1',
    });
    const client = new Client({ name: 'test-client', version: '1.0.0' });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name)).toEqual(mcpBusinessActions.filter((action) => action.enabled).map((action) => action.name));
    expect(tools.every((tool) => tool.annotations?.readOnlyHint === true && tool.annotations?.destructiveHint === false)).toBe(true);
    expect(tools.every((tool) => Array.isArray(tool._meta?.securitySchemes))).toBe(true);
    await Promise.all([client.close(), server.close()]);
  });

  it('accepts only Supabase OAuth access tokens for the MCP endpoint', () => {
    const claims = {
      sub: 'user-1',
      iss: 'https://project.supabase.co/auth/v1',
      aud: 'authenticated',
      client_id: 'oauth-client-1',
    };
    expect(validateMcpClaims(claims, 'https://project.supabase.co')).toEqual({
      userId: 'user-1',
      clientId: 'oauth-client-1',
    });
    expect(() => validateMcpClaims({ ...claims, client_id: undefined }, 'https://project.supabase.co')).toThrow(/MCP OAuth/);
    expect(() => validateMcpClaims({ ...claims, aud: 'anon' }, 'https://project.supabase.co')).toThrow(/MCP OAuth/);
    expect(() => validateMcpClaims({ ...claims, iss: 'https://attacker.example/auth/v1' }, 'https://project.supabase.co')).toThrow(/MCP OAuth/);
  });
});
