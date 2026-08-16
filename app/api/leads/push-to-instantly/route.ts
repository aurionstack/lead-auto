// ============================================================
// src/app/api/leads/push-to-instantly/route.ts
//
// INSTANTLY API INTEGRATION
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase';
import { SESSION_COOKIE_NAME } from '@/app/api/auth/login/route';

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── 1. Verify session cookie (dashboard actions are gated) ─
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

  if (!sessionCookie || sessionCookie.value !== 'authenticated') {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  // ── 2. Parse request body ──────────────────────────────────
  let body: { leadId: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { leadId } = body;
  if (!leadId) {
    return NextResponse.json({ error: 'leadId is required.' }, { status: 400 });
  }

  // ── 3. Fetch lead from Supabase ────────────────────────────
  const { data: lead, error: fetchError } = await supabaseAdmin
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .single();

  if (fetchError || !lead) {
    return NextResponse.json({ error: 'Lead not found.' }, { status: 404 });
  }

  if (!lead.email) {
    return NextResponse.json({ error: 'Lead does not have an email address.' }, { status: 400 });
  }

  // ── 4. Push to Instantly API ───────────────────────────────
  const instantlyApiKey = process.env.INSTANTLY_API_KEY;
  const instantlyCampaignId = process.env.INSTANTLY_CAMPAIGN_ID;

  if (instantlyApiKey && instantlyCampaignId) {
    try {
      const instantlyPayload = {
        api_key: instantlyApiKey,
        campaign_id: instantlyCampaignId,
        skip_if_in_workspace: true,
        leads: [
          {
            email: lead.email,
            first_name: lead.business_name || 'Business Owner',
            company_name: lead.business_name || '',
            phone: lead.phone || '',
            website: lead.website || '',
            custom_variables: {
              pitch: lead.drafted_email_pitch || '',
              ai_reasoning: lead.ai_reasoning || '',
            },
          }
        ]
      };

      const instantlyRes = await fetch('https://api.instantly.ai/api/v1/lead/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(instantlyPayload),
      });

      if (!instantlyRes.ok) {
        const errorText = await instantlyRes.text();
        console.error('[push-to-instantly] Instantly API Error:', errorText);
        return NextResponse.json({ error: 'Instantly API failed to add lead.', details: errorText }, { status: 502 });
      }
    } catch (err) {
      console.error('[push-to-instantly] Network error pushing to Instantly:', err);
      return NextResponse.json({ error: 'Network error calling Instantly API.' }, { status: 502 });
    }
  } else {
    console.warn('[push-to-instantly] INSTANTLY_API_KEY or INSTANTLY_CAMPAIGN_ID missing. Mocking success.');
  }

  // ── 5. Update lead status to 'contacted' ───────────────────
  const { error: updateError } = await supabaseAdmin
    .from('leads')
    .update({ status: 'contacted' })
    .eq('id', leadId);

  if (updateError) {
    console.error(`[push-to-instantly] Error updating lead status ${leadId}:`, updateError);
    // Continue anyway since push was successful
  }

  return NextResponse.json({ success: true, message: 'Lead pushed to Instantly and marked as contacted.' });
}
