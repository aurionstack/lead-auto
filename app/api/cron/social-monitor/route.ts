import { NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/auth';
import { runSocialMonitor } from '@/lib/tools/social-monitor/automation';

export const maxDuration = 300;

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) return new NextResponse('Unauthorized', { status: 401 });
  try {
    const result = await runSocialMonitor();
    return NextResponse.json(result, { status: result.errors.length ? 502 : 200 });
  } catch (error) {
    console.error('[social-monitor/cron]', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Social monitor failed' }, { status: 500 });
  }
}
