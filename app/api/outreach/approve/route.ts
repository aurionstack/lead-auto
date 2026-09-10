import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { addToQueue } from '@/lib/email/queue';
import { buildOutreachHtml, buildOutreachText } from '@/lib/email/templates';
import { isSuppressed } from '@/lib/email/suppression';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { leadId } = body;

    if (!leadId) {
      return NextResponse.json({ error: 'Missing leadId' }, { status: 400 });
    }

    // 1. Fetch lead and enrichment data to snapshot content
    const { data: lead, error: fetchError } = await supabaseAdmin
      .from('leads')
      .select('*, leads_enrichment(discovered_emails)')
      .eq('id', leadId)
      .single();

    if (fetchError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    if (lead.status !== 'new') {
      return NextResponse.json({ error: 'Only new leads can be approved' }, { status: 400 });
    }

    const enrichment = lead.leads_enrichment as any;
    let targetEmail = null;
    if (enrichment?.discovered_emails && Array.isArray(enrichment.discovered_emails)) {
      targetEmail = enrichment.discovered_emails[0]?.email;
    }

    if (!targetEmail || !lead.drafted_pitch) {
      return NextResponse.json({ error: 'Lead is missing an email or draft pitch' }, { status: 400 });
    }

    // 2. Suppression check
    if (await isSuppressed(targetEmail)) {
      await supabaseAdmin.from('leads').update({ status: 'suppressed' }).eq('id', leadId);
      return NextResponse.json({ error: 'Target email is suppressed' }, { status: 400 });
    }

    // 3. Render snapshots
    const businessName = lead.business_name || 'Business Owner';
    const draft = lead.drafted_pitch;
    const unsubscribeLink = `https://${process.env.NEXT_PUBLIC_SITE_URL || 'localhost:3000'}/unsubscribe?lead=${leadId}`;
    
    const html = buildOutreachHtml({ businessName, body: draft, unsubscribeLink });
    const text = buildOutreachText({ businessName, body: draft, unsubscribeLink });
    const subject = `Partnership Inquiry - ${businessName}`;

    // 4. Update the lead status to 'approved'
    const { error: updateError } = await supabaseAdmin
      .from('leads')
      .update({ status: 'approved' })
      .eq('id', leadId);

    if (updateError) {
      console.error('Failed to update lead status:', updateError);
      return NextResponse.json({ error: 'Failed to approve lead' }, { status: 500 });
    }

    // 5. Add snapshot to outreach queue
    await addToQueue({
      leadId: leadId,
      subject: subject,
      bodyHtml: html,
      bodyText: text,
      targetEmail: targetEmail
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in approve route:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
