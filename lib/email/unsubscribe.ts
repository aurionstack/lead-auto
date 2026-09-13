import crypto from 'crypto';

function unsubscribeSecret(): string {
  const secret = process.env.UNSUBSCRIBE_SECRET || process.env.CRON_SECRET;
  if (!secret) throw new Error('UNSUBSCRIBE_SECRET is not configured');
  return secret;
}

export function createUnsubscribeToken(leadId: string): string {
  return crypto.createHmac('sha256', unsubscribeSecret()).update(leadId).digest('base64url');
}

export function verifyUnsubscribeToken(leadId: string, token: string): boolean {
  try {
    const expected = Buffer.from(createUnsubscribeToken(leadId));
    const received = Buffer.from(token);
    return expected.length === received.length && crypto.timingSafeEqual(expected, received);
  } catch {
    return false;
  }
}

export function buildUnsubscribeUrl(leadId: string): string {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (!configuredUrl) throw new Error('NEXT_PUBLIC_SITE_URL or NEXT_PUBLIC_APP_URL is not configured');
  const baseUrl = /^https?:\/\//i.test(configuredUrl) ? configuredUrl : `https://${configuredUrl}`;
  const url = new URL('/unsubscribe', baseUrl);
  url.searchParams.set('lead', leadId);
  url.searchParams.set('token', createUnsubscribeToken(leadId));
  return url.toString();
}

export function buildOneClickUnsubscribeUrl(leadId: string): string {
  const pageUrl = new URL(buildUnsubscribeUrl(leadId));
  pageUrl.pathname = '/api/unsubscribe';
  return pageUrl.toString();
}
