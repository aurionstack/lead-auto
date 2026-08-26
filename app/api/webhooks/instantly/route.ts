// ============================================================
// app/api/webhooks/instantly/route.ts
// Webhook endpoint to receive events from Instantly.ai
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { sendTelegramNotification } from '@/lib/telegram';

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();

    const eventType = payload.event_type || payload.type;
    
    // We only care about replies
    if (eventType !== 'reply_received' && eventType !== 'reply') {
      return NextResponse.json({ received: true, ignored: true, reason: 'Not a reply event' });
    }

    const leadEmail = payload.lead_email || payload.data?.email || payload.from || 'Unknown Email';
    const leadName = payload.lead_name || payload.data?.name || 'Unknown Lead';
    const subject = payload.subject || payload.data?.subject || 'No Subject';
    const bodyText = payload.text || payload.body || payload.data?.text || payload.data?.body || 'No content provided';

    // Truncate the body text
    const truncatedBody = bodyText.length > 300 ? bodyText.substring(0, 300) + '...' : bodyText;

    const message = `🚨 *New Client Reply!*\n\n*From:* ${leadName} (${leadEmail})\n*Subject:* ${subject}\n\n*Message:* \n"${truncatedBody}"`;

    console.log(`[Webhook/Instantly] Forwarding reply from ${leadEmail} to Telegram...`);
    
    const success = await sendTelegramNotification(message);

    if (!success) {
      console.error('[Webhook/Instantly] Failed to send Telegram notification');
      return NextResponse.json({ error: 'Failed to send Telegram notification' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Telegram notification sent' });

  } catch (error) {
    console.error('[Webhook/Instantly] Error processing webhook:', error);
    return NextResponse.json({ error: 'Invalid webhook payload' }, { status: 400 });
  }
}
