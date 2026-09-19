import type { WebhookEvent } from './tracking';

type ProviderPayload = Record<string, unknown>;

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (Array.isArray(value)) {
      const found = value.find((item) => typeof item === 'string' && item.trim());
      if (typeof found === 'string') return found.trim();
    }
  }
}

function eventTimestamp(value: unknown): Date {
  if (typeof value === 'number') {
    const date = new Date(value < 10_000_000_000 ? value * 1000 : value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  if (typeof value === 'string' && value.trim()) {
    const numeric = Number(value);
    const date = Number.isFinite(numeric)
      ? new Date(numeric < 10_000_000_000 ? numeric * 1000 : numeric)
      : new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return new Date();
}

export function parseEmailProviderEvents(payload: unknown): WebhookEvent[] {
  const providerEvents = Array.isArray(payload) ? payload : [payload];
  const parsed: WebhookEvent[] = [];

  for (const raw of providerEvents) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const event = raw as ProviderPayload;
    const type = firstString(event.event, event.type, event.status)?.toLowerCase();
    const email = firstString(event.rcpt, event.recipients, event.email, event.recipient);
    if (!type || !email) continue;

    let eventType: WebhookEvent['eventType'] | null = null;
    if (type.includes('bounce')) eventType = 'bounced';
    else if (type.includes('deliver')) eventType = 'delivered';
    else if (type.includes('spam') || type.includes('complain')) eventType = 'complained';
    else if (type.includes('unsub')) eventType = 'unsubscribed';
    else if (type.includes('reply')) eventType = 'replied';
    else if (type.includes('open')) eventType = 'opened';
    else if (type.includes('click')) eventType = 'clicked';
    // SMTP2GO "processed" and "reject" events are intentionally ignored: a
    // processed event is not delivery, while a reject may be a sender/config issue.
    if (!eventType) continue;

    parsed.push({
      email,
      eventType,
      messageId: firstString(event['message-id'], event.message_id, event.messageId),
      timestamp: eventTimestamp(event.time ?? event.timestamp ?? event.sendtime),
      metadata: event,
    });
  }

  return parsed;
}
