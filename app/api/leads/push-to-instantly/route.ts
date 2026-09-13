// ============================================================
// src/app/api/leads/push-to-instantly/route.ts
//
// INSTANTLY API INTEGRATION
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { hasDashboardSession } from '@/lib/auth';

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── 1. Verify session cookie (dashboard actions are gated) ─
  if (!(await hasDashboardSession())) {
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
  if (!['new', 'approved'].includes(lead.status)) {
    return NextResponse.json({ error: 'Lead is already processing or contacted.' }, { status: 409 });
  }

  // ── 4. Push to Instantly API ───────────────────────────────
  const instantlyApiKey = process.env.INSTANTLY_API_KEY;
  const instantlyCampaignId = process.env.INSTANTLY_CAMPAIGN_ID;

  if (!instantlyApiKey || !instantlyCampaignId) {
    return NextResponse.json({ error: 'Instantly credentials are not configured.' }, { status: 500 });
  }

  const { data: claimedLead, error: claimError } = await supabaseAdmin
    .from('leads')
    .update({ status: 'processing', processing_started_at: new Date().toISOString() })
    .eq('id', leadId)
    .eq('status', lead.status)
    .select('id')
    .maybeSingle();
  if (claimError || !claimedLead) {
    return NextResponse.json({ error: 'Lead was claimed by another request.' }, { status: 409 });
  }

  try {
    const instantlyPayload = {
      campaign_id: instantlyCampaignId,
      leads: [
        {
          email: lead.email,
          first_name: lead.business_name || 'Business Owner',
          company_name: lead.business_name || '',
          phone: lead.phone || '',
          website: lead.website || '',
          personalization: lead.drafted_email_pitch || '',
          custom_variables: {
            pitch: lead.drafted_email_pitch || '',
            ai_reasoning: lead.ai_reasoning || '',
          },
        }
      ]
    };

    const instantlyRes = await fetch('https://api.instantly.ai/api/v2/leads/add', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${instantlyApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(instantlyPayload),
    });

    if (!instantlyRes.ok) {
      const errorText = await instantlyRes.text();
      console.error('[push-to-instantly] Instantly API Error:', errorText);
      await supabaseAdmin.from('leads').update({ status: lead.status, processing_started_at: null }).eq('id', leadId);
      return NextResponse.json({ error: 'Instantly API failed to add lead.', details: errorText }, { status: 502 });
    }
  } catch (err) {
    console.error('[push-to-instantly] Network error pushing to Instantly:', err);
    await supabaseAdmin.from('leads').update({ status: lead.status, processing_started_at: null }).eq('id', leadId);
    return NextResponse.json({ error: 'Network error calling Instantly API.' }, { status: 502 });
  }

  // ── 5. Update lead status to 'contacted' ───────────────────
  const { error: updateError } = await supabaseAdmin
    .from('leads')
    .update({ status: 'contacted', processing_started_at: null })
    .eq('id', leadId);

  if (updateError) {
    console.error(`[push-to-instantly] Error updating lead status ${leadId}:`, updateError);
    return NextResponse.json({ error: 'Lead was pushed, but local status reconciliation failed.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: 'Lead pushed to Instantly and marked as contacted.' });
}
