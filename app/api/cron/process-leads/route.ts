// ============================================================
// src/app/api/cron/process-leads/route.ts
//
// ASYNC AI BATCH PROCESSOR — Triggered by Vercel Cron
// ============================================================
//
// Runs every 10 minutes (see vercel.json).
// Processes up to 10 unscored leads per cycle to stay well
// within Vercel's function timeout limits.
//
// SECURITY: Protected by CRON_SECRET header verification.
// Vercel automatically injects the Authorization header when
// calling cron endpoints — configure CRON_SECRET in Vercel
// environment variables.
//
// AI FLOW:
//   1. Fetch unscored leads from Supabase (score IS NULL or 0)
//   2. For each lead: call Gemini 2.5 Flash with structured prompt
//   3. Parse strict JSON response { score, reasoning, pitch }
//   4. Update Supabase row with AI results
//   5. Continue to next lead (sequential, not parallel, to
//      avoid rate-limit bursts on the Gemini API)
//
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { supabaseAdmin } from '@/lib/supabase';
import type { Lead, AIResult } from '@/lib/types';

const BATCH_SIZE = 10;

// AI System Prompt — scores high-ticket B2B alignment
const SYSTEM_PROMPT = `You are an expert B2B sales intelligence analyst specializing in identifying high-value outreach opportunities.

Analyze the provided Google Maps business data and evaluate its alignment with high-ticket B2B sales targets, specifically:
- Self-drive fleet operators (car rentals, chauffeur services)
- Yacht and boat rental businesses
- Luxury villa managers and holiday property operators
- Premium hospitality businesses with significant review presence but no digital marketing infrastructure

Scoring criteria (0–100):
- High review count with no website = very high score (untapped digital potential)
- Premium/luxury category = bonus points
- High rating (4.5+) = signals quality business worth investing in
- Phone available = actionable lead
- Low score for businesses with polished existing digital presence

Return ONLY a valid JSON object with this exact schema — no markdown, no explanation, no preamble:
{
  "score": <integer 0-100>,
  "reasoning": "<2 sentences: structural critique of their digital gap and B2B sales alignment>",
  "pitch": "<3 sentences: high-converting personalized WhatsApp message pitching a Click-to-WhatsApp template system, mentioning their exact rating and review count>"
}`;

export async function GET(request: NextRequest): Promise<NextResponse> {
  // ── 1. Verify CRON_SECRET authorization ───────────────────
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('[cron/process-leads] CRON_SECRET is not configured.');
    return NextResponse.json({ error: 'Server misconfiguration.' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  const expectedHeader = `Bearer ${cronSecret}`;

  if (!authHeader || authHeader !== expectedHeader) {
    console.warn('[cron/process-leads] Unauthorized request — invalid or missing Authorization header.');
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  // ── 2. Validate Gemini API Key ─────────────────────────────
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    console.error('[cron/process-leads] GEMINI_API_KEY is not configured.');
    return NextResponse.json({ error: 'Gemini API key missing.' }, { status: 500 });
  }

  // ── 3. Fetch unscored leads from Supabase ─────────────────
  // Targets rows where opportunity_score is NULL or exactly 0
  // and status is 'new' (not yet touched by any action).
  const { data: leads, error: fetchError } = await supabaseAdmin
    .from('leads')
    .select('*')
    .eq('status', 'new')
    .or('opportunity_score.is.null,opportunity_score.eq.0')
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (fetchError) {
    console.error('[cron/process-leads] Error fetching leads:', fetchError);
    return NextResponse.json({ error: 'Database fetch failed.', detail: fetchError.message }, { status: 500 });
  }

  if (!leads || leads.length === 0) {
    console.log('[cron/process-leads] No unscored leads found. Cron cycle complete.');
    return NextResponse.json({ success: true, processed: 0, message: 'No unscored leads in queue.' });
  }

  console.log(`[cron/process-leads] Processing batch of ${leads.length} leads.`);

  // ── 4. Initialize Google Gemini AI client ─────────────────
  const ai = new GoogleGenAI({ apiKey: geminiApiKey });

  // ── 5. Process each lead sequentially ─────────────────────
  // Sequential (not Promise.all) to avoid Gemini rate limits.
  const results: { id: string; status: 'success' | 'error'; score?: number }[] = [];

  for (const lead of leads as Lead[]) {
    try {
      console.log(`[cron/process-leads] Scoring lead: ${lead.id} (${lead.business_name})`);

      // Build the lead data string for the AI prompt
      const leadDataPrompt = buildLeadPrompt(lead);

      // ── 5a. Call Gemini 2.5 Flash ────────────────────────
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: leadDataPrompt }] }],
        config: {
          systemInstruction: SYSTEM_PROMPT,
          temperature: 0.3, // Lower temp for more consistent structured output
          responseMimeType: 'application/json', // Request JSON mode
        },
      });

      const rawText = response.text;
      if (!rawText) {
        throw new Error('Gemini returned an empty response.');
      }

      // ── 5b. Parse strict JSON response ───────────────────
      const aiResult = parseAIResponse(rawText);

      // ── 5c. Update Supabase row with AI results ───────────
      const { error: updateError } = await supabaseAdmin
        .from('leads')
        .update({
          opportunity_score: aiResult.score,
          ai_reasoning: aiResult.reasoning,
          drafted_pitch: aiResult.pitch,
        })
        .eq('id', lead.id);

      if (updateError) {
        console.error(`[cron/process-leads] Failed to update lead ${lead.id}:`, updateError);
        results.push({ id: lead.id, status: 'error' });
        continue; // Don't throw — process the next lead
      }

      console.log(`[cron/process-leads] Lead ${lead.id} scored: ${aiResult.score}/100`);
      results.push({ id: lead.id, status: 'success', score: aiResult.score });

    } catch (err) {
      // Per-lead error isolation — one bad lead doesn't kill the batch
      console.error(`[cron/process-leads] Error processing lead ${lead.id}:`, err);
      results.push({ id: lead.id, status: 'error' });
    }
  }

  const successCount = results.filter((r) => r.status === 'success').length;
  const errorCount = results.filter((r) => r.status === 'error').length;

  console.log(
    `[cron/process-leads] Batch complete. Success: ${successCount}, Errors: ${errorCount}.`
  );

  return NextResponse.json({
    success: true,
    processed: leads.length,
    succeeded: successCount,
    failed: errorCount,
    results,
  });
}

// ── Helper: Build human-readable lead data for the AI prompt ──
function buildLeadPrompt(lead: Lead): string {
  return `
Business Profile to Analyze:
- Business Name: ${lead.business_name ?? 'Unknown'}
- Category: ${lead.category ?? 'Unknown'}
- Google Rating: ${lead.rating ?? 'N/A'} stars
- Total Reviews: ${lead.review_count ?? 'N/A'}
- Address: ${lead.address ?? 'Not provided'}
- Phone: ${lead.phone ?? 'Not provided'}
- Google Maps URL: ${lead.google_maps_url ?? 'Not provided'}

Analyze this business for B2B high-ticket sales potential and respond with a JSON object only.
`.trim();
}

// ── Helper: Parse and validate AI JSON response ────────────────
function parseAIResponse(rawText: string): AIResult {
  // Strip markdown code fences if present (Gemini sometimes wraps JSON)
  const cleaned = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Failed to parse Gemini JSON response: ${cleaned.slice(0, 200)}`);
  }

  // Validate the shape of the parsed object
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    typeof (parsed as Record<string, unknown>).score !== 'number' ||
    typeof (parsed as Record<string, unknown>).reasoning !== 'string' ||
    typeof (parsed as Record<string, unknown>).pitch !== 'string'
  ) {
    throw new Error(
      `Gemini response missing required fields: ${JSON.stringify(parsed).slice(0, 200)}`
    );
  }

  const result = parsed as AIResult;

  // Clamp score to valid range
  result.score = Math.max(0, Math.min(100, Math.round(result.score)));

  return result;
}
