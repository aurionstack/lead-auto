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
import { findEmailWithApollo } from '@/lib/apollo';
import { findEmailWithHunter } from '@/lib/hunter';
import { findEmailWithRegex } from '@/lib/email-parser';

export const maxDuration = 60;
const BATCH_SIZE = 5;

const SYSTEM_PROMPT = `You are an expert B2B Growth Consultant for "Aurion Stack".
Our target clients are high-end, non-technical B2B businesses (e.g. Commercial Cleaning, Corporate Event Planners, Wholesale Distributors, Managed IT).

We sell three core services. You MUST dynamically choose the best service to pitch based on their digital footprint:
1. Web Design / Full-Stack Build: Pitch this if they DO NOT have a website, or if their website is completely broken.
2. SEO & Website Redesign: Pitch this if they have a website, but it is extremely slow, looks incredibly outdated, or lacks proper local SEO keywords on the homepage.
3. AI Lead Generation & Automation: Pitch this if they have a decent website. Offer to build an AI system that scrapes their exact target market (e.g. medical clinics for a commercial cleaner) and automatically sends 1,000 highly targeted B2B emails per month to book them meetings.

Analyze the provided business data, website content, and the pool of discovered email addresses.

Email Selection Rule:
- Review the pool of discovered emails.
- Select the SINGLE BEST email for B2B outreach (prioritize human names, CEO, Founder, or decision-maker titles over generic info@ emails).
- If no good emails exist in the pool, return null.

Scoring criteria (0-100):
- No website or missing digital presence = 95+ score (Prime target for Web Design).
- Has website but extremely outdated design or bad SEO = 90+ score (Prime target for Redesign/SEO).
- Great website with high reviews = 85+ score (Prime target for AI Lead Generation scaling).
- Low rating/sketchy business = under 50 score.

CRITICAL TONE RULE: 
The business owners reading these emails are NOT technical. You MUST translate our tech offerings into simple, user-friendly business outcomes (e.g. "Get more clients", "Rank higher on Google").

WEBSITE PROBLEM RULE:
If they have a website, you MUST identify a very specific problem with it based on the scraped content (e.g., "I noticed your site doesn't mention [Service]", or "Your website is missing key SEO terms for your industry"). Mention this naturally in the reasoning and pitch to prove you actually looked at it.

Return ONLY a valid JSON object with this exact schema — no markdown, no explanation, no preamble:
{
  "score": <integer 0-100>,
  "reasoning": "<2 sentences: Critique their digital presence (mention a SPECIFIC problem if they have a website) and map it to Web Design, SEO, or AI Lead Gen>",
  "pitch_whatsapp": "<3 sentences: Friendly, high-converting WhatsApp hook focusing on the BUSINESS OUTCOME of our software (more revenue, less manual work)>",
  "pitch_email": "<3 sentences: Professional email hook pitching the VALUE of our tech stack without using confusing jargon>",
  "selected_email": "<selected email string or null>"
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
      let allFoundEmails: any[] = [];

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
        
        // ── CONCURRENT EMAIL DISCOVERY ──
        console.log(`[cron/process-leads] Running concurrent email discovery for ${domain}...`);
        
        const [apolloResult, hunterResult] = await Promise.allSettled([
          findEmailWithApollo(domain),
          findEmailWithHunter(domain)
        ]);
        
        const regexResult = findEmailWithRegex(websiteText);
        
        // Pool and deduplicate
        const emailPool = new Map();
        
        if (apolloResult.status === 'fulfilled' && apolloResult.value) {
          apolloResult.value.forEach(e => emailPool.set(e.email.toLowerCase(), e));
        }
        if (hunterResult.status === 'fulfilled' && hunterResult.value) {
          hunterResult.value.forEach(e => {
            if (!emailPool.has(e.email.toLowerCase())) emailPool.set(e.email.toLowerCase(), e);
          });
        }
        regexResult.forEach(e => {
          if (!emailPool.has(e.email.toLowerCase())) emailPool.set(e.email.toLowerCase(), e);
        });

        allFoundEmails = Array.from(emailPool.values());
        
        if (allFoundEmails.length > 0) {
          console.log(`[cron/process-leads] SUCCESS: Pooled ${allFoundEmails.length} unique emails for ${domain}`);
          enrichedData += `- Discovered Email Pool: ${JSON.stringify(allFoundEmails)}\n`;
        } else {
          console.log(`[cron/process-leads] FAILED: No valid emails found in any discovery method for ${domain}.`);
          enrichedData += `- Discovered Email Pool: []\n`;
        }
      } else {
        console.log(`[cron/process-leads] No website found online for ${lead.business_name}. High priority target.`);
        enrichedData = '- Website Analysis: NO WEBSITE OR DIGITAL PRESENCE FOUND. Massive opportunity for a Full-Stack MVP.\n- Discovered Email Pool: []\n';
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
      let alternativeEmails: any[] = [];
      if (allFoundEmails.length > 0) {
        if (aiResult.selected_email) {
          alternativeEmails = allFoundEmails.filter(e => e.email.toLowerCase() !== aiResult.selected_email?.toLowerCase());
        } else {
          alternativeEmails = allFoundEmails;
        }
      }

      const { error: updateError } = await supabaseAdmin
        .from('leads')
        .update({
          opportunity_score: aiResult.score,
          ai_reasoning: aiResult.reasoning,
          drafted_pitch: aiResult.pitch_whatsapp,
          drafted_email_pitch: aiResult.pitch_email,
          email: aiResult.selected_email || null,
          alternative_emails: alternativeEmails.length > 0 ? alternativeEmails : null,
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
      
      // Mark as -1 so we don't infinitely retry a broken lead
      await supabaseAdmin.from('leads').update({ opportunity_score: -1 }).eq('id', lead.id);
      
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
async function fetchWebsiteText(baseUrl: string): Promise<string> {
  const cleanBaseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
  const urlsToScrape = [
    cleanBaseUrl,
    `${cleanBaseUrl}/contact`,
    `${cleanBaseUrl}/about`
  ];

  console.log(`[cron/process-leads] Deep scraping ${urlsToScrape.length} paths for ${cleanBaseUrl}...`);

  const scrapePromises = urlsToScrape.map(async (url) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 seconds max

    try {
      const res = await fetch(`https://r.jina.ai/${url}`, { 
        signal: controller.signal, 
        headers: { 
          'Accept': 'text/plain',
          'X-Return-Format': 'markdown' 
        } 
      });
      clearTimeout(timeoutId);
      
      if (!res.ok) return null;
      return await res.text();
    } catch (err) {
      clearTimeout(timeoutId);
      return null;
    }
  });

  const results = await Promise.allSettled(scrapePromises);
  
  let combinedText = '';
  results.forEach(result => {
    if (result.status === 'fulfilled' && result.value) {
      combinedText += result.value + '\n\n';
    }
  });

  if (!combinedText.trim()) {
    return 'Website failed to load or no readable text found on any pages.';
  }

  // Truncate to first 6000 chars to avoid overwhelming Gemini but give enough context from all 3 pages
  if (combinedText.length > 6000) combinedText = combinedText.substring(0, 6000) + '\n...[TRUNCATED]';
  
  return combinedText;
}
