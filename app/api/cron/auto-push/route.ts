// ============================================================
// app/api/cron/auto-push/route.ts
//
// AUTONOMOUS INSTANTLY PUSHER (Runs Every 10 mins)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import type { Lead } from '@/lib/types';

export async function GET(request: NextRequest): Promise<NextResponse> {
  // 1. Verify CRON_SECRET authorization
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'Server misconfiguration.' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  const expectedHeader = `Bearer ${cronSecret}`;

  if (!authHeader || authHeader !== expectedHeader) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  // 2. Fetch leads with high scores that haven't been contacted
  const { data: leads, error: fetchError } = await supabaseAdmin
    .from('leads')
    .select('*')
    .eq('status', 'new')
    .not('email', 'is', null)
    .gte('opportunity_score', 85)
    .order('created_at', { ascending: true })
    .limit(30);

  if (fetchError) {
    console.error('[cron/auto-push] Error fetching leads:', fetchError);
    return NextResponse.json({ error: 'Database fetch failed.', detail: fetchError.message }, { status: 500 });
  }

  if (!leads || leads.length === 0) {
    console.log('[cron/auto-push] No high-scoring leads to push.');
    return NextResponse.json({ success: true, processed: 0, message: 'No high-scoring leads.' });
  }

  const instantlyApiKey = process.env.INSTANTLY_API_KEY;
  const instantlyCampaignId = process.env.INSTANTLY_CAMPAIGN_ID;

  if (!instantlyApiKey || !instantlyCampaignId) {
    console.error('[cron/auto-push] INSTANTLY_API_KEY or INSTANTLY_CAMPAIGN_ID missing.');
    return NextResponse.json({ error: 'Instantly credentials missing.' }, { status: 500 });
  }

  // 3. Format payload for Instantly API
  const instantlyLeads = (leads as Lead[]).map(lead => ({
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
    api_key: instantlyApiKey,
    campaign_id: instantlyCampaignId,
    skip_if_in_workspace: true,
    leads: instantlyLeads,
  };

  try {
    const instantlyRes = await fetch('https://api.instantly.ai/api/v1/lead/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(instantlyPayload),
    });

    if (!instantlyRes.ok) {
      const errorText = await instantlyRes.text();
      console.error('[cron/auto-push] Instantly API Error:', errorText);
      return NextResponse.json({ error: 'Instantly API failed.', details: errorText }, { status: 502 });
    }

    // 4. Update status to 'contacted'
    const leadIds = leads.map(l => l.id);
    const { error: updateError } = await supabaseAdmin
      .from('leads')
      .update({ status: 'contacted' })
      .in('id', leadIds);

    if (updateError) {
      console.error('[cron/auto-push] Error updating lead statuses:', updateError);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully pushed ${leads.length} leads to Instantly.`,
      pushed: leads.length,
    });
  } catch (err) {
    console.error('[cron/auto-push] Network error:', err);
    return NextResponse.json({ error: 'Network error calling Instantly API.' }, { status: 502 });
  }
}
