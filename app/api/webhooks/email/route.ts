import { NextResponse } from 'next/server';
import { logEmailEvent } from '@/lib/email/tracking';
import { parseEmailProviderEvents } from '@/lib/email/webhook';
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
    
    const contentType = request.headers.get('content-type') || '';
    let body: unknown;
    if (contentType.includes('application/json')) {
      body = await request.json();
    } else {
      body = Object.fromEntries((await request.formData()).entries());
    }
    const eventsToProcess = parseEmailProviderEvents(body);

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
