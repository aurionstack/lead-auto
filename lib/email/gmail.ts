import { logEmailEvent } from './tracking';

type GmailHeader = { name?: string; value?: string };
type GmailMessage = {
  id?: string;
  internalDate?: string;
  payload?: { headers?: GmailHeader[] };
};

function gmailConfigured() {
  return Boolean(
    process.env.GMAIL_CLIENT_ID &&
    process.env.GMAIL_CLIENT_SECRET &&
    process.env.GMAIL_REFRESH_TOKEN,
  );
}

function header(message: GmailMessage, name: string) {
  return message.payload?.headers?.find((entry) => entry.name?.toLowerCase() === name.toLowerCase())?.value?.trim();
}

function mailbox(value?: string) {
  if (!value) return null;
  const bracketed = value.match(/<([^>]+)>/);
  const candidate = (bracketed?.[1] || value).trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate) ? candidate : null;
}

async function gmailAccessToken() {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GMAIL_CLIENT_ID || '',
      client_secret: process.env.GMAIL_CLIENT_SECRET || '',
      refresh_token: process.env.GMAIL_REFRESH_TOKEN || '',
      grant_type: 'refresh_token',
    }),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Gmail OAuth refresh failed (${response.status})`);
  const payload = await response.json() as { access_token?: string };
  if (!payload.access_token) throw new Error('Gmail OAuth did not return an access token');
  return payload.access_token;
}

async function gmailJson<T>(path: string, accessToken: string): Promise<T> {
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Gmail API request failed (${response.status})`);
  return response.json() as Promise<T>;
}

export async function syncGmailReplies() {
  if (!gmailConfigured()) return { configured: false, scanned: 0, matched: 0 };

  const token = await gmailAccessToken();
  const query = encodeURIComponent('in:inbox newer_than:2d');
  const listing = await gmailJson<{ messages?: Array<{ id?: string }> }>(`messages?q=${query}&maxResults=50`, token);
  let scanned = 0;
  let matched = 0;

  for (const summary of listing.messages || []) {
    if (!summary.id) continue;
    const message = await gmailJson<GmailMessage>(
      `messages/${encodeURIComponent(summary.id)}?format=metadata&metadataHeaders=From&metadataHeaders=In-Reply-To&metadataHeaders=References&metadataHeaders=Message-ID&metadataHeaders=Subject`,
      token,
    );
    scanned += 1;
    const email = mailbox(header(message, 'From'));
    const inReplyTo = header(message, 'In-Reply-To') || header(message, 'References')?.split(/\s+/).at(-1);
    if (!email || !inReplyTo) continue;

    const result = await logEmailEvent({
      email,
      messageId: inReplyTo,
      eventType: 'replied',
      timestamp: message.internalDate ? new Date(Number(message.internalDate)) : new Date(),
      metadata: {
        provider: 'gmail',
        gmailMessageId: message.id,
        subject: header(message, 'Subject'),
      },
    });
    if (result.matched) matched += 1;
  }

  return { configured: true, scanned, matched };
}
