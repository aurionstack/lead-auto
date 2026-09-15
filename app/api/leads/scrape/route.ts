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
import { hasDashboardSession } from '@/lib/auth';
import { validateCampaignTarget } from '@/lib/campaign';

const APIFY_ACTOR_ID = 'compass~crawler-google-places';
const APIFY_BASE_URL = 'https://api.apify.com/v2';

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!(await hasDashboardSession())) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const apifyToken = process.env.APIFY_TOKEN;
  const webhookSecret = process.env.APIFY_WEBHOOK_SECRET || process.env.CRON_SECRET;
  if (!apifyToken || !webhookSecret) {
    return NextResponse.json({ error: 'APIFY_TOKEN or APIFY_WEBHOOK_SECRET not configured.' }, { status: 500 });
  }

  // Parse request body
  let body: { location?: string; category?: string; maxResults?: number; channel?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { location, category, maxResults = 50, channel = 'email' } = body;

  if (
    typeof location !== 'string' || !location.trim() || location.length > 160 ||
    typeof category !== 'string' || !category.trim() || category.length > 120 ||
    !Number.isInteger(maxResults) || maxResults < 1 || maxResults > 200 ||
    !['email', 'whatsapp', 'instantly'].includes(channel)
  ) {
    return NextResponse.json(
      { error: 'Both location and category are required.' },
      { status: 400 }
    );
  }

  // Build the webhook URL so Apify calls back to our system when done
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

  // Build search queries — e.g. "restaurants in Mumbai"
  const cleanLocation = location.trim();
  const cleanCategory = category.trim();
  const campaignError = validateCampaignTarget(cleanCategory, cleanLocation);
  if (campaignError) {
    return NextResponse.json({ error: campaignError }, { status: 400 });
  }
  const searchQuery = `${cleanCategory} in ${cleanLocation}`;

  // 1. Create a new scrape job in the database
  const { data: jobData, error: jobError } = await supabaseAdmin
    .from('scrape_jobs')
    .insert([{ location: cleanLocation, category: cleanCategory, channel, status: 'scraping' }])
    .select('id')
    .single();

  if (jobError || !jobData) {
    console.error('[scrape] Error creating scrape job:', jobError);
    return NextResponse.json({ error: 'Failed to create scrape job in database.' }, { status: 500 });
  }

  const jobId = jobData.id;

  const webhookUrl = `${appUrl}/api/webhooks/apify?jobId=${jobId}`;

  console.log(`[scrape] Triggering Apify for: "${searchQuery}", max: ${maxResults}, jobId: ${jobId}`);

  const webhooks = [
    {
      eventTypes: ['ACTOR.RUN.SUCCEEDED'],
      requestUrl: webhookUrl,
      headersTemplate: JSON.stringify({ Authorization: `Bearer ${webhookSecret}` })
    }
  ];
  const webhooksBase64 = Buffer.from(JSON.stringify(webhooks)).toString('base64');

  // Call Apify to start a new actor run
  try {
    const apifyResponse = await fetch(
      `${APIFY_BASE_URL}/acts/${APIFY_ACTOR_ID}/runs?token=${apifyToken}&webhooks=${encodeURIComponent(webhooksBase64)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          searchStringsArray: [searchQuery],
          maxCrawledPlacesPerSearch: maxResults,
          language: 'en',
        }),
      }
    );

    if (!apifyResponse.ok) {
      const errorText = await apifyResponse.text();
      console.error(`[scrape] Apify API error ${apifyResponse.status}: ${errorText}`);
      await supabaseAdmin.from('scrape_jobs').update({ status: 'failed' }).eq('id', jobId);
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
    await supabaseAdmin.from('scrape_jobs').update({ status: 'failed' }).eq('id', jobId);
    return NextResponse.json({ error: 'Network error starting scrape.' }, { status: 502 });
  }
}
