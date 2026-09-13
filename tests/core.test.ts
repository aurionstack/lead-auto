import { afterEach, describe, expect, it, vi } from 'vitest';
import { SignJWT } from 'jose';
import { isBearerAuthorized, isCronAuthorized } from '../lib/auth';
import { buildOutreachHtml } from '../lib/email/templates';
import { buildOneClickUnsubscribeUrl, buildUnsubscribeUrl, createUnsubscribeToken, verifyUnsubscribeToken } from '../lib/email/unsubscribe';
import { findEmailWithRegex } from '../lib/email-parser';

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
});
