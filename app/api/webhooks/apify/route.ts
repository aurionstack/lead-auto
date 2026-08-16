// ============================================================
// src/app/api/webhooks/apify/route.ts
//
// APIFY WEBHOOK RECEIVER — Anti-Timeout Architecture
// ============================================================
//
// CRITICAL DESIGN PRINCIPLE:
//   This route NEVER runs AI scoring inline. Doing so would
//   risk Vercel's serverless timeout (10s hobby / 60s pro).
//   Instead it:
//     1. Parses the incoming Apify webhook payload
//     2. Fetches raw lead data from Apify's Dataset API
//     3. Filters & upserts raw rows into Supabase instantly
//     4. Returns HTTP 200 to Apify in < 1 second
//
//   AI scoring is deferred to the async cron worker:
//   /api/cron/process-leads (runs every 10 min via Vercel Cron)
//
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import type { ApifyLeadItem } from '@/lib/types';

// Apify Dataset API base URL
const APIFY_BASE_URL = 'https://api.apify.com/v2';

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── 1. Validate Apify Token is configured ──────────────────
  const apifyToken = process.env.APIFY_TOKEN;
  if (!apifyToken) {
    console.error('[webhook/apify] APIFY_TOKEN is not configured.');
    return NextResponse.json(
      { success: false, error: 'Server misconfiguration.' },
      { status: 500 }
    );
  }

  // ── 2. Parse the Apify webhook payload ─────────────────────
  // Apify sends: { "resource": { "defaultDatasetId": "abc123" }, ... }
  let body: { resource?: { defaultDatasetId?: string } };
  try {
    body = await request.json();
  } catch {
    console.error('[webhook/apify] Failed to parse JSON body.');
    return NextResponse.json(
      { success: false, error: 'Invalid JSON payload.' },
      { status: 400 }
    );
  }

  const datasetId = body?.resource?.defaultDatasetId;
  if (!datasetId) {
    console.error('[webhook/apify] Missing resource.defaultDatasetId in payload.');
    return NextResponse.json(
      { success: false, error: 'Missing datasetId.' },
      { status: 400 }
    );
  }

  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('jobId');

  console.log(`[webhook/apify] Received dataset ID: ${datasetId}, jobId: ${jobId}`);

  // ── 3. Fetch items from Apify Dataset API ──────────────────
  // Limit to 1000 items per webhook call to bound execution time.
  // For larger datasets, implement pagination using `offset` param.
  let rawItems: ApifyLeadItem[] = [];
  try {
    const apifyUrl = `${APIFY_BASE_URL}/datasets/${datasetId}/items?token=${apifyToken}&limit=1000&clean=true`;
    const apifyResponse = await fetch(apifyUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!apifyResponse.ok) {
      const errorText = await apifyResponse.text();
      console.error(
        `[webhook/apify] Apify API error ${apifyResponse.status}: ${errorText}`
      );
      return NextResponse.json(
        { success: false, error: 'Failed to fetch from Apify.' },
        { status: 502 }
      );
    }

    rawItems = await apifyResponse.json();
    console.log(`[webhook/apify] Fetched ${rawItems.length} items from Apify.`);
  } catch (err) {
    console.error('[webhook/apify] Network error fetching from Apify:', err);
    return NextResponse.json(
      { success: false, error: 'Network error fetching dataset.' },
      { status: 502 }
    );
  }

  // ── 4. Filter leads — must have a phone number ─────────────
  const validItems = rawItems.filter(
    (item) => item.phone && item.phone.trim().length > 0
  );

  console.log(
    `[webhook/apify] ${validItems.length} leads have phone numbers (${rawItems.length - validItems.length} filtered out).`
  );

  if (validItems.length === 0) {
    if (jobId) {
      await supabaseAdmin.from('scrape_jobs').update({ status: 'completed', results_count: 0 }).eq('id', jobId);
    }
    return NextResponse.json({
      success: true,
      message: 'No leads with phone numbers found.',
      inserted: 0,
    });
  }

  // ── 5. Transform Apify items to our DB schema ───────────────
  const leadsToUpsert = validItems.map((item) => ({
    business_name: item.title ?? null,
    phone: item.phone?.trim() ?? null,
    google_maps_url: item.url ?? null,
    category: item.categoryName ?? null,
    rating: item.totalScore ?? null,
    review_count: item.reviewsCount ?? null,
    address: item.address ?? null,
    website: item.website ?? null,
    scrape_job_id: jobId || null,
    // opportunity_score defaults to 0 (unscored)
    // status defaults to 'new'
    // ai_reasoning, drafted_pitch are set by the cron worker
  }));

  // ── 6. Upsert into Supabase (service role bypasses RLS) ─────
  // onConflict: 'google_maps_url' prevents duplicate entries
  // for the same business if the webhook fires multiple times.
  const { data, error } = await supabaseAdmin
    .from('leads')
    .upsert(leadsToUpsert, {
      onConflict: 'google_maps_url',
      ignoreDuplicates: false, // Update existing rows with fresh data
    })
    .select('id');

  if (error) {
    console.error('[webhook/apify] Supabase upsert error:', error);
    // Still return 200 to Apify — we don't want Apify to retry
    // and flood us with duplicate webhook calls.
    return NextResponse.json(
      { success: false, error: 'Database write failed.', detail: error.message },
      { status: 200 } // Intentional 200 to prevent Apify retries
    );
  }

  const upsertedCount = data?.length ?? 0;
  console.log(
    `[webhook/apify] Successfully upserted ${upsertedCount} leads. AI scoring deferred to cron.`
  );

  // Update the scrape job status
  if (jobId) {
    await supabaseAdmin
      .from('scrape_jobs')
      .update({ status: 'completed', results_count: upsertedCount })
      .eq('id', jobId);
  }

  // ── 7. Return 200 immediately — Apify expects a fast response ─
  return NextResponse.json({
    success: true,
    received: rawItems.length,
    withPhone: validItems.length,
    upserted: upsertedCount,
    message: 'Leads stored. AI scoring will run on next cron cycle.',
  });
}
