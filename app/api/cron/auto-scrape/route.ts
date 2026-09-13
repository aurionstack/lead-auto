// ============================================================
// app/api/cron/auto-scrape/route.ts
//
// AUTONOMOUS APIFY SCRAPER (Runs Daily)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isCronAuthorized } from '@/lib/auth';
import type { SearchConfig } from '@/lib/types';

export const maxDuration = 60;

const APIFY_ACTOR_ID = 'compass~crawler-google-places';
const APIFY_BASE_URL = 'https://api.apify.com/v2';

export async function GET(request: NextRequest): Promise<NextResponse> {
  // 1. Verify CRON_SECRET authorization
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  // 1.5. Safety Limit Check: Prevent scraping if system is backlogged
  // Check pending emails
  const { count: pendingEmails } = await supabaseAdmin
    .from('outreach_queue')
    .select('*', { count: 'exact', head: true })
    .in('status', ['pending', 'locked']);

  if (pendingEmails !== null && pendingEmails >= 20) {
    console.log(`[cron/auto-scrape] Safety limit reached: ${pendingEmails} pending emails. Halting scrape.`);
    return NextResponse.json({ message: 'Scraping paused due to outreach queue backlog.' });
  }

  // Check unscored leads
  const { count: unscoredLeads } = await supabaseAdmin
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'new')
    .or('opportunity_score.is.null,opportunity_score.eq.0');

  if (unscoredLeads !== null && unscoredLeads >= 100) {
    console.log(`[cron/auto-scrape] Safety limit reached: ${unscoredLeads} unscored leads. Halting scrape.`);
    return NextResponse.json({ message: 'Scraping paused due to unscored leads backlog.' });
  }

  // 2. Fetch the oldest untouched search configuration
  const { data: config, error: fetchError } = await supabaseAdmin
    .rpc('claim_search_config')
    .maybeSingle();

  if (fetchError || !config) {
    console.log('[cron/auto-scrape] No active search configurations found.');
    return NextResponse.json({ message: 'No configurations found.' });
  }
  const claimedConfig = config as SearchConfig;

  const apifyToken = process.env.APIFY_TOKEN;
  if (!apifyToken) {
    return NextResponse.json({ error: 'APIFY_TOKEN not configured.' }, { status: 500 });
  }
  const webhookSecret = process.env.APIFY_WEBHOOK_SECRET || process.env.CRON_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: 'APIFY_WEBHOOK_SECRET not configured.' }, { status: 500 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

  const searchQuery = `${claimedConfig.search_query} in ${claimedConfig.location}`;
  const maxResults = 50; // default for auto-scrape

  // 3. Create a new scrape job in the database
  const { data: jobData, error: jobError } = await supabaseAdmin
    .from('scrape_jobs')
    .insert([{ location: claimedConfig.location, category: claimedConfig.search_query, channel: claimedConfig.channel, status: 'scraping' }])
    .select('id')
    .single();

  if (jobError || !jobData) {
    console.error('[cron/auto-scrape] Error creating scrape job:', jobError);
    return NextResponse.json({ error: 'Failed to create scrape job.' }, { status: 500 });
  }

  const jobId = jobData.id;
  const webhookUrl = `${appUrl}/api/webhooks/apify?jobId=${jobId}`;

  console.log(`[cron/auto-scrape] Triggering Apify for: "${searchQuery}"`);

  const webhooks = [
    {
      eventTypes: ['ACTOR.RUN.SUCCEEDED'],
      requestUrl: webhookUrl,
      headersTemplate: JSON.stringify({ Authorization: `Bearer ${webhookSecret}` })
    }
  ];
  const webhooksBase64 = Buffer.from(JSON.stringify(webhooks)).toString('base64');

  // 4. Call Apify
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
      await supabaseAdmin.from('scrape_jobs').update({ status: 'failed' }).eq('id', jobId);
      return NextResponse.json({ error: 'Failed to start Apify scrape.', details: errorText }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      message: `Autonomous scrape started for "${searchQuery}".`,
      jobId,
    });
  } catch (err) {
    console.error('[cron/auto-scrape] Network error calling Apify:', err);
    await supabaseAdmin.from('scrape_jobs').update({ status: 'failed' }).eq('id', jobId);
    return NextResponse.json({ error: 'Network error starting scrape.' }, { status: 502 });
  }
}
