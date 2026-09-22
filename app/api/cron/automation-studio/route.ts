import { NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/auth';
import { enqueueDueAutomationRuns, processAutomationRuns } from '@/lib/tools/automation-studio/engine';

export const maxDuration = 120;

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) return new NextResponse('Unauthorized', { status: 401 });
  try {
    const scheduled = await enqueueDueAutomationRuns();
    const processed = await processAutomationRuns();
    return NextResponse.json({ success: true, scheduled, processed });
  } catch (error: unknown) {
    console.error('[automation-studio]', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Automation Studio failed' }, { status: 500 });
  }
}
