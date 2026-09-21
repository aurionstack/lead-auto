import { createUnsubscribeToken, verifyUnsubscribeToken } from '@/lib/email/unsubscribe';

export function buildYouTubeUnsubscribeUrl(creatorId: string) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (!configured) throw new Error('NEXT_PUBLIC_SITE_URL or NEXT_PUBLIC_APP_URL is not configured');
  const url = new URL('/api/tools/youtube-outreach/unsubscribe', /^https?:\/\//i.test(configured) ? configured : `https://${configured}`);
  url.searchParams.set('creator', creatorId);
  url.searchParams.set('token', createUnsubscribeToken(`youtube:${creatorId}`));
  return url.toString();
}

export function verifyYouTubeUnsubscribe(creatorId: string, token: string) {
  return verifyUnsubscribeToken(`youtube:${creatorId}`, token);
}
