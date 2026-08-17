// ============================================================
// app/api/cron/auto-scrape/route.ts
//
// AUTONOMOUS APIFY SCRAPER (Runs Daily)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const maxDuration = 60;

const APIFY_ACTOR_ID = 'compass~crawler-google-places';
const APIFY_BASE_URL = 'https://api.apify.com/v2';

export async function GET(request: NextRequest): Promise<NextResponse> {
  // 1. Verify CRON_SECRET authorization
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'Server misconfiguration.' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  const expectedHeader = `Bearer ${cronSecret}`;

  if (!authHeader || authHeader !== expectedHeader) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  // 2. Fetch the oldest untouched search configuration
  const { data: config, error: fetchError } = await supabaseAdmin
    .from('search_configs')
    .select('*')
    .eq('is_active', true)
    .order('last_scraped_at', { ascending: true })
    .limit(1)
    .single();

  if (fetchError || !config) {
    console.log('[cron/auto-scrape] No active search configurations found.');
    return NextResponse.json({ message: 'No configurations found.' });
  }

  const apifyToken = process.env.APIFY_TOKEN;
  if (!apifyToken) {
    return NextResponse.json({ error: 'APIFY_TOKEN not configured.' }, { status: 500 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

  const searchQuery = `${config.search_query} in ${config.location}`;
  const maxResults = 50; // default for auto-scrape

  // 3. Create a new scrape job in the database
  const { data: jobData, error: jobError } = await supabaseAdmin
    .from('scrape_jobs')
    .insert([{ location: config.location, category: config.search_query, status: 'scraping' }])
    .select('id')
    .single();

  if (jobError || !jobData) {
    console.error('[cron/auto-scrape] Error creating scrape job:', jobError);
    return NextResponse.json({ error: 'Failed to create scrape job.' }, { status: 500 });
  }

  const jobId = jobData.id;
  const webhookUrl = `${appUrl}/api/webhooks/apify?jobId=${jobId}`;

  console.log(`[cron/auto-scrape] Triggering Apify for: "${searchQuery}"`);

  // 4. Call Apify
  try {
    const apifyResponse = await fetch(
      `${APIFY_BASE_URL}/acts/${APIFY_ACTOR_ID}/runs?token=${apifyToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          searchStringsArray: [searchQuery],
          maxCrawledPlacesPerSearch: maxResults,
          language: 'en',
          webhooks: [
            {
              eventTypes: ['ACTOR.RUN.SUCCEEDED'],
              requestUrl: webhookUrl,
              headersTemplate: "{\n  \"ngrok-skip-browser-warning\": \"true\"\n}"
            },
          ],
        }),
      }
    );

    if (!apifyResponse.ok) {
      const errorText = await apifyResponse.text();
      return NextResponse.json({ error: 'Failed to start Apify scrape.', details: errorText }, { status: 502 });
    }

    // 5. Update last_scraped_at to push it to the back of the queue
    await supabaseAdmin
      .from('search_configs')
      .update({ last_scraped_at: new Date().toISOString() })
      .eq('id', config.id);

    return NextResponse.json({
      success: true,
      message: `Autonomous scrape started for "${searchQuery}".`,
      jobId,
    });
  } catch (err) {
    console.error('[cron/auto-scrape] Network error calling Apify:', err);
    return NextResponse.json({ error: 'Network error starting scrape.' }, { status: 502 });
  }
}
