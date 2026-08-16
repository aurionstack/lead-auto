import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    
    // Call our own cron endpoint using the secret
    const cronRes = await fetch(`${protocol}://${host}/api/cron/process-leads`, {
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
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
