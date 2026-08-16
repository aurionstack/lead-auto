// ============================================================
// app/api/leads/scrape/route.ts
//
// ON-DEMAND APIFY SCRAPER TRIGGER
// ============================================================
//
// Triggers the Apify Google Maps Scraper actor with a given
// location + business category. Apify runs the scrape async
// and will POST results back to /api/webhooks/apify when done.
//
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const APIFY_ACTOR_ID = 'compass~crawler-google-places';
const APIFY_BASE_URL = 'https://api.apify.com/v2';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const apifyToken = process.env.APIFY_TOKEN;
  if (!apifyToken) {
    return NextResponse.json({ error: 'APIFY_TOKEN not configured.' }, { status: 500 });
  }

  // Parse request body
  let body: { location?: string; category?: string; maxResults?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { location, category, maxResults = 50 } = body;

  if (!location || !category) {
    return NextResponse.json(
      { error: 'Both location and category are required.' },
      { status: 400 }
    );
  }

  // Build the webhook URL so Apify calls back to our system when done
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';

  // Build search queries — e.g. "restaurants in Mumbai"
  const searchQuery = `${category} in ${location}`;

  // 1. Create a new scrape job in the database
  const { data: jobData, error: jobError } = await supabaseAdmin
    .from('scrape_jobs')
    .insert([{ location, category, status: 'scraping' }])
    .select('id')
    .single();

  if (jobError || !jobData) {
    console.error('[scrape] Error creating scrape job:', jobError);
    return NextResponse.json({ error: 'Failed to create scrape job in database.' }, { status: 500 });
  }

  const jobId = jobData.id;

  const webhookUrl = `${appUrl}/api/webhooks/apify?jobId=${jobId}`;

  console.log(`[scrape] Triggering Apify for: "${searchQuery}", max: ${maxResults}, jobId: ${jobId}`);

  // Call Apify to start a new actor run
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
          // Webhook: Apify will POST to this URL when the run finishes
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
      console.error(`[scrape] Apify API error ${apifyResponse.status}: ${errorText}`);
      return NextResponse.json(
        { error: 'Failed to start Apify scrape.', details: errorText },
        { status: 502 }
      );
    }

    const runData = await apifyResponse.json();
    const runId = runData?.data?.id;

    console.log(`[scrape] Apify run started. Run ID: ${runId}`);

    return NextResponse.json({
      success: true,
      message: `Scrape started for "${searchQuery}". Results will appear in your dashboard automatically when Apify finishes.`,
      runId,
      query: searchQuery,
      estimatedResults: maxResults,
    });
  } catch (err) {
    console.error('[scrape] Network error calling Apify:', err);
    return NextResponse.json({ error: 'Network error starting scrape.' }, { status: 502 });
  }
}
