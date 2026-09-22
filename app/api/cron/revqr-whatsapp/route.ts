import { NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/auth';
import { processRevQrJobs } from '@/lib/tools/revqr-whatsapp/automation';

export const maxDuration = 120;

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) return new NextResponse('Unauthorized', { status: 401 });
  try {
    return NextResponse.json({ success: true, ...(await processRevQrJobs()) });
  } catch (error: unknown) {
    console.error('[revqr/automation]', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'RevQR automation failed' }, { status: 500 });
  }
}
