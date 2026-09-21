import { NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/auth';
import { processYouTubeOutreach } from '@/lib/tools/youtube-outreach/automation';

export const maxDuration = 120;

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) return new NextResponse('Unauthorized', { status: 401 });
  try {
    return NextResponse.json({ success: true, ...(await processYouTubeOutreach()) });
  } catch (error: unknown) {
    console.error('[youtube-outreach/send]', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'YouTube outreach failed' }, { status: 500 });
  }
}
