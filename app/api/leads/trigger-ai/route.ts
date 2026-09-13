import { NextRequest, NextResponse } from 'next/server';
import { hasDashboardSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    if (!(await hasDashboardSession())) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return NextResponse.json({ error: 'Server misconfiguration.' }, { status: 500 });
    }
    
    // Call our own cron endpoint using the secret
    const cronRes = await fetch(new URL('/api/cron/process-leads', request.nextUrl.origin), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${cronSecret}`
      }
    });

    if (!cronRes.ok) {
      const errorText = await cronRes.text();
      return NextResponse.json({ error: 'Failed to trigger AI cron', details: errorText }, { status: 500 });
    }

    const data = await cronRes.json();
    return NextResponse.json(data);
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}
