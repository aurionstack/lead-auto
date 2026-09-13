// ============================================================
// app/api/cron/auto-push/route.ts
//
// AUTONOMOUS INSTANTLY PUSHER (Runs Every 10 mins)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import type { Lead } from '@/lib/types';
import { isCronAuthorized } from '@/lib/auth';

export const maxDuration = 60;

export async function GET(request: NextRequest): Promise<NextResponse> {
  // 1. Verify CRON_SECRET authorization
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const instantlyApiKey = process.env.INSTANTLY_API_KEY;
  const instantlyCampaignId = process.env.INSTANTLY_CAMPAIGN_ID;

  if (!instantlyApiKey || !instantlyCampaignId) {
    console.error('[cron/auto-push] INSTANTLY_API_KEY or INSTANTLY_CAMPAIGN_ID missing.');
    return NextResponse.json({ error: 'Instantly credentials missing.' }, { status: 500 });
  }

  // 2. Atomically claim high-scoring Instantly leads.
  const { data: leads, error: fetchError } = await supabaseAdmin
    .rpc('claim_instantly_leads', { batch_limit: 30 });

  if (fetchError) {
    console.error('[cron/auto-push] Error fetching leads:', fetchError);
    return NextResponse.json({ error: 'Database fetch failed.', detail: fetchError.message }, { status: 500 });
  }

  if (!leads || leads.length === 0) {
    console.log('[cron/auto-push] No high-scoring leads to push.');
    return NextResponse.json({ success: true, processed: 0, message: 'No high-scoring leads.' });
  }
  const claimedLeads = leads as Lead[];

  // 3. Format payload for Instantly API
  const instantlyLeads = claimedLeads.map(lead => ({
    email: lead.email,
    first_name: lead.business_name || 'Business Owner',
    company_name: lead.business_name || '',
    phone: lead.phone || '',
    website: lead.website || '',
    custom_variables: {
      pitch: lead.drafted_email_pitch || '',
      ai_reasoning: lead.ai_reasoning || '',
    },
  }));

  const instantlyPayload = {
    campaign_id: instantlyCampaignId,
    leads: instantlyLeads,
  };

  try {
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
      console.error('[cron/auto-push] Instantly API Error:', errorText);
      await supabaseAdmin.from('leads').update({ status: 'new', processing_started_at: null }).in('id', claimedLeads.map(lead => lead.id));
      return NextResponse.json({ error: 'Instantly API failed.', details: errorText }, { status: 502 });
    }

    // 4. Update status to 'contacted'
    const leadIds = claimedLeads.map(lead => lead.id);
    const { error: updateError } = await supabaseAdmin
      .from('leads')
      .update({ status: 'contacted', processing_started_at: null })
      .in('id', leadIds);

    if (updateError) {
      console.error('[cron/auto-push] Error updating lead statuses:', updateError);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully pushed ${claimedLeads.length} leads to Instantly.`,
      pushed: claimedLeads.length,
    });
  } catch (err) {
    console.error('[cron/auto-push] Network error:', err);
    await supabaseAdmin.from('leads').update({ status: 'new', processing_started_at: null }).in('id', claimedLeads.map(lead => lead.id));
    return NextResponse.json({ error: 'Network error calling Instantly API.' }, { status: 502 });
  }
}
