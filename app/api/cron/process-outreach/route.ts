import { NextResponse } from 'next/server';
import { processQueue } from '@/lib/email/queue';

// For Vercel Cron or Edge execution
// export const maxDuration = 300; 

export async function GET(request: Request) {
  try {
    // Basic security: require an authorization header matching a secret
    // (In a real app, configure CRON_SECRET in your environment)
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Process a small batch to stay within execution limits
    const result = await processQueue(10);

    return NextResponse.json({ success: true, processed: result?.processed || 0 });
  } catch (error: any) {
    console.error('Error in process-outreach cron:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
