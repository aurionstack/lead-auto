import { NextResponse } from 'next/server';
import { ingestWhatsAppWebhook, verifyWhatsAppSignature } from '@/lib/tools/revqr-whatsapp/webhook';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');
  if (mode === 'subscribe' && token && token === process.env.WHATSAPP_VERIFY_TOKEN && challenge) return new NextResponse(challenge, { status: 200 });
  return new NextResponse('Forbidden', { status: 403 });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!verifyWhatsAppSignature(rawBody, request.headers.get('x-hub-signature-256'))) return new NextResponse('Invalid signature', { status: 401 });
  try {
    const result = await ingestWhatsAppWebhook(JSON.parse(rawBody));
    return NextResponse.json({ received: true, ...result });
  } catch (error: unknown) {
    console.error('[revqr/whatsapp-webhook]', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
