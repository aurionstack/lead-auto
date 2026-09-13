import { NextResponse } from 'next/server';
import { processQueue } from '@/lib/email/queue';
import { isCronAuthorized } from '@/lib/auth';

export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    // Basic security: require an authorization header matching a secret
    // (In a real app, configure CRON_SECRET in your environment)
    if (!isCronAuthorized(request)) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Process a small batch to stay within execution limits
    const configuredBatchSize = Number.parseInt(process.env.OUTREACH_BATCH_SIZE || '5', 10);
    const batchSize = Number.isFinite(configuredBatchSize) ? Math.max(1, Math.min(configuredBatchSize, 20)) : 5;
    const result = await processQueue(batchSize);

    return NextResponse.json({ success: true, processed: result?.processed || 0 });
  } catch (error: unknown) {
    console.error('Error in process-outreach cron:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}
