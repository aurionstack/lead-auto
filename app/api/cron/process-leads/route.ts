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
import * as cheerio from 'cheerio';
import { supabaseAdmin } from '@/lib/supabase';
import type { Lead, AIResult } from '@/lib/types';

const BATCH_SIZE = 10;

const SYSTEM_PROMPT = `You are an expert B2B sales intelligence analyst for "Aurion Stack".
We sell premium international tech partnerships (NOT basic local agency services).

Our Core Offerings:
1. Generative Engine Optimization (GEO): Next.js SSR, Structured Schema (replaces Local SEO).
2. Signal-Based AI Revenue Operations: Custom Python Scrapers, Clay, Apollo (replaces Cold Email Spam).
3. Autonomous AI Workflows & RAG Systems: OpenAI APIs, Supabase Vector, LangChain (replaces basic Chatbots).
4. Full-Stack SaaS MVPs & Interactive 3D: Next.js, React, Tailwind, Three.js, GSAP (replaces basic Web Design).

Analyze the provided business data and website content.
Scoring criteria (0-100):
- No website or missing social handles = 95+ score (Prime target for Full-Stack MVP or GEO).
- Has website but poor design, bad SEO, or missing clear call to actions = 85+ score.
- High reviews but no website = 100 score (Massive untapped potential).

CRITICAL TONE RULE: 
While we use high-end tech (Next.js, RAG, etc.), the business owners reading these emails are NOT technical. You MUST translate our tech offerings into simple, user-friendly business outcomes. 
(Example: Instead of saying "We will build a RAG system", say "We can build an AI assistant that automatically answers your customers' questions 24/7".)

WEBSITE PROBLEM RULE:
If they have a website, you MUST identify a very specific problem with it based on the scraped content (e.g., "I noticed your site doesn't have a clear way for visitors to book a call", or "Your website's headings are missing key SEO terms for your industry"). Mention this naturally in the reasoning and pitch.

Return ONLY a valid JSON object with this exact schema — no markdown, no explanation, no preamble:
{
  "score": <integer 0-100>,
  "reasoning": "<2 sentences: Critique their missing/poor digital presence (mention a SPECIFIC problem if they have a website) and map it to a specific Aurion Stack tech solution>",
  "pitch_whatsapp": "<3 sentences: Friendly, high-converting WhatsApp hook focusing on the BUSINESS OUTCOME of our software (more revenue, less manual work)>",
  "pitch_email": "<3 sentences: Professional email hook pitching the VALUE of our tech stack without using confusing jargon>"
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

      let enrichedData = '';
      let enrichedEmail = null;
      let finalWebsite = lead.website;

      // Search for missing website using DuckDuckGo HTML proxy
      if (!finalWebsite) {
        console.log(`[cron/process-leads] No website found on Maps. Searching web for ${lead.business_name}...`);
        const foundUrl = await findMissingWebsite(lead.business_name || 'Unknown Business', lead.address || '');
        if (foundUrl) {
          console.log(`[cron/process-leads] Discovered missing website: ${foundUrl}`);
          finalWebsite = foundUrl;
          // Note: we don't update the DB with the found website immediately here, but we could.
        }
      }

      if (finalWebsite) {
        console.log(`[cron/process-leads] Scraping website data for ${finalWebsite} via Jina Reader`);
        const websiteText = await fetchWebsiteText(finalWebsite);
        
        if (websiteText.includes('Failed to load') || websiteText.includes('failed to load')) {
          enrichedData = `- Website Analysis: Their website exists but could not be scraped by our bot (likely anti-bot protection or a slow server). Do NOT mention that their website failed to load. Assume they have a basic website, and pitch them on advanced AI RevOps, Automation, or SEO systems instead.\n`;
        } else {
          enrichedData = `- Scraped Website Content (Markdown): "${websiteText}"\n`;
        }

        const domain = finalWebsite.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
        enrichedEmail = 'owner@' + domain;
        enrichedData += `- Contact Email Found: ${enrichedEmail}\n`;
      } else {
        console.log(`[cron/process-leads] No website found online for ${lead.business_name}. High priority target.`);
        enrichedData = '- Website Analysis: NO WEBSITE OR DIGITAL PRESENCE FOUND. Massive opportunity for a Full-Stack MVP.\n';
      }

      // Build the lead data string for the AI prompt
      const leadDataPrompt = buildLeadPrompt(lead, enrichedData);

      // ── 5a. Call Gemini 3.5 Flash Lite ────────────────────────
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash-lite',
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
          drafted_pitch: aiResult.pitch_whatsapp,
          drafted_email_pitch: aiResult.pitch_email,
          email: enrichedEmail,
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
function buildLeadPrompt(lead: Lead, enrichedData: string = ''): string {
  return `
Business Profile to Analyze:
- Business Name: ${lead.business_name ?? 'Unknown'}
- Category: ${lead.category ?? 'Unknown'}
- Google Rating: ${lead.rating ?? 'N/A'} stars
- Total Reviews: ${lead.review_count ?? 'N/A'}
- Address: ${lead.address ?? 'Not provided'}
- Phone: ${lead.phone ?? 'Not provided'}
- Website: ${lead.website ?? 'Not provided'}
- Google Maps URL: ${lead.google_maps_url ?? 'Not provided'}
${enrichedData}
Analyze this business for custom software engineering sales potential and respond with a JSON object only.
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
    typeof (parsed as Record<string, unknown>).pitch_whatsapp !== 'string' ||
    typeof (parsed as Record<string, unknown>).pitch_email !== 'string'
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

// ── Helper: Find missing website via DuckDuckGo HTML ───────────
async function findMissingWebsite(businessName: string, location: string): Promise<string | null> {
  try {
    const query = encodeURIComponent(`${businessName} ${location} official website`);
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${query}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    if (!res.ok) return null;
    
    const html = await res.text();
    const $ = cheerio.load(html);
    
    // Find the first organic result URL
    let foundUrl: string | null = null;
    $('.result__url').each((_, el) => {
      const url = $(el).attr('href');
      if (url && url.includes('uddg=')) {
        // Extract from DuckDuckGo redirect format: //duckduckgo.com/l/?uddg=https%3A%2F%2F...
        const decoded = decodeURIComponent(url.split('uddg=')[1].split('&')[0]);
        // Filter out directories and social media if we want strict websites
        if (!decoded.includes('facebook.com') && !decoded.includes('instagram.com') && !decoded.includes('justdial') && !decoded.includes('yelp.com')) {
          foundUrl = decoded;
          return false; // break loop
        }
      }
    });
    
    return foundUrl;
  } catch (err) {
    console.error('[cron] DuckDuckGo search failed:', err);
    return null;
  }
}

// ── Helper: Scrape website using Jina Reader ───────────────────
async function fetchWebsiteText(url: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 seconds max

  try {
    // Jina Reader converts any URL to structured Markdown
    const res = await fetch(`https://r.jina.ai/${url}`, { 
      signal: controller.signal, 
      headers: { 
        'Accept': 'text/plain',
        'X-Return-Format': 'markdown' 
      } 
    });
    clearTimeout(timeoutId);
    
    if (!res.ok) return 'Failed to load website via Jina (returned error code).';
    
    let text = await res.text();
    
    // Truncate to first 4000 chars to avoid overwhelming Gemini while keeping structure
    if (text.length > 4000) text = text.substring(0, 4000) + '\n...[TRUNCATED]';
    
    return text || 'Website loaded but no readable text found.';
  } catch (err: any) {
    clearTimeout(timeoutId);
    return 'Website failed to load or timed out.';
  }
}
