import { NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/auth';
import { runYouTubeDiscovery } from '@/lib/tools/youtube-outreach/automation';
import { verifyYouTubeApiConnection } from '@/lib/tools/youtube-outreach/youtube';

export const maxDuration = 300;

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) return new NextResponse('Unauthorized', { status: 401 });
  try {
    if (new URL(request.url).searchParams.get('test') === '1') {
      return NextResponse.json({ success: true, test: true, ...(await verifyYouTubeApiConnection()) });
    }
    return NextResponse.json({ success: true, ...(await runYouTubeDiscovery()) });
  } catch (error: unknown) {
    console.error('[youtube-outreach/discover]', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'YouTube discovery failed' }, { status: 500 });
  }
}
