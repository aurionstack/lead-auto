import { afterEach, describe, expect, it, vi } from 'vitest';
import { isBearerAuthorized, isCronAuthorized } from '../lib/auth';
import { appendComplianceFooter, buildOutreachHtml } from '../lib/email/templates';
import { buildOneClickUnsubscribeUrl, buildUnsubscribeUrl, createUnsubscribeToken, verifyUnsubscribeToken } from '../lib/email/unsubscribe';
import { findEmailWithRegex } from '../lib/email-parser';
import { ACTIVE_CAMPAIGN, campaignSequenceId, isHomeServiceCategory, isUnitedStatesLocation, validateCampaignTarget } from '../lib/campaign';
import { automationTools, getAutomationTool } from '../lib/tools/registry';
import { DEFAULT_YOUTUBE_CAMPAIGN } from '../lib/tools/youtube-outreach/types';
import { mcpBusinessActions } from '../lib/mcp/action-registry';

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
});
