import { NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/auth';
import { syncGmailReplies } from '@/lib/email/gmail';

export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) return new NextResponse('Unauthorized', { status: 401 });

  try {
    return NextResponse.json({ success: true, ...(await syncGmailReplies()) });
  } catch (error: unknown) {
    console.error('[cron/sync-replies] Gmail sync failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Gmail reply sync failed' },
      { status: 500 },
    );
  }
}
