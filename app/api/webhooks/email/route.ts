import { NextResponse } from 'next/server';
import { logEmailEvent, WebhookEvent } from '@/lib/email/tracking';
import { isBearerAuthorized } from '@/lib/auth';

/**
 * Generic webhook receiver for email events.
 * Since the provider is not finalized, this acts as a placeholder structure.
 * You will need to parse the specific provider's payload structure here.
 */
export async function POST(request: Request) {
  try {
    if (!isBearerAuthorized(request, process.env.EMAIL_WEBHOOK_SECRET)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    
    // 2. Parse provider payload into our internal WebhookEvent structure
    // Example: (this will vary wildly between Resend, Mail360, SendGrid, etc.)
    
    const eventsToProcess: WebhookEvent[] = [];
    
    // Mock parsing logic for a generic array of events:
    const providerEvents = Array.isArray(body) ? body : [body];
    
    for (const evt of providerEvents) {
      // Translate provider status to our event types
      let mappedType: WebhookEvent['eventType'] | null = null;
      
      const typeStr = evt.type || evt.event || evt.status;
      if (typeof typeStr === 'string') {
        const t = typeStr.toLowerCase();
        if (t.includes('bounce')) mappedType = 'bounced';
        else if (t.includes('deliver')) mappedType = 'delivered';
        else if (t.includes('spam') || t.includes('complain')) mappedType = 'complained';
        else if (t.includes('unsub')) mappedType = 'unsubscribed';
        else if (t.includes('reply')) mappedType = 'replied';
        else if (t.includes('open')) mappedType = 'opened';
        else if (t.includes('click')) mappedType = 'clicked';
      }

      if (mappedType && evt.email) {
        eventsToProcess.push({
          email: evt.email,
          eventType: mappedType,
          messageId: evt.message_id || evt.id,
          timestamp: evt.timestamp ? new Date(evt.timestamp) : new Date(),
          metadata: evt
        });
      }
    }

    // 3. Process the events
    for (const event of eventsToProcess) {
      await logEmailEvent(event);
    }

    return NextResponse.json({ success: true, processed: eventsToProcess.length });
  } catch (error: unknown) {
    console.error('Error processing email webhook:', error);
    return NextResponse.json({ error: 'Failed to process webhook' }, { status: 500 });
  }
}
