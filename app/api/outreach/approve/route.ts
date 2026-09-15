import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { addToQueue } from '@/lib/email/queue';
import { buildOutreachHtml, buildOutreachText } from '@/lib/email/templates';
import { isSuppressed } from '@/lib/email/suppression';
import { hasDashboardSession } from '@/lib/auth';
import { buildOneClickUnsubscribeUrl, buildUnsubscribeUrl } from '@/lib/email/unsubscribe';
import { campaignSequenceId } from '@/lib/campaign';

export async function POST(request: Request) {
  try {
    if (!(await hasDashboardSession())) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const body = await request.json();
    const { leadId } = body;

    if (!leadId) {
      return NextResponse.json({ error: 'Missing leadId' }, { status: 400 });
    }

    // 1. Fetch lead and enrichment data to snapshot content
    const { data: lead, error: fetchError } = await supabaseAdmin
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (fetchError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    if (lead.status !== 'new') {
      return NextResponse.json({ error: 'Only new leads can be approved' }, { status: 400 });
    }

    const targetEmail = lead.email;

    if (!targetEmail || !lead.drafted_email_pitch) {
      return NextResponse.json({ error: 'Lead is missing an email or draft pitch' }, { status: 400 });
    }

    // 2. Suppression check
    if (await isSuppressed(targetEmail)) {
      await supabaseAdmin.from('leads').update({ status: 'suppressed' }).eq('id', leadId);
      return NextResponse.json({ error: 'Target email is suppressed' }, { status: 400 });
    }

    // 3. Render snapshots
    const businessName = lead.business_name || 'Business Owner';
    const draft = lead.drafted_email_pitch;
    const unsubscribeLink = buildUnsubscribeUrl(leadId);
    
    const html = buildOutreachHtml({ businessName, body: draft, unsubscribeLink });
    const text = buildOutreachText({ businessName, body: draft, unsubscribeLink });
    const subject = `A missed-enquiry idea for ${businessName}`;

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
    try {
      await addToQueue({
        leadId: leadId,
        subject: subject,
        bodyHtml: html,
        bodyText: text,
        targetEmail: targetEmail,
        unsubscribeUrl: buildOneClickUnsubscribeUrl(leadId),
        campaignId: campaignSequenceId('initial'),
      }, lead.organization_id);
    } catch (queueError) {
      await supabaseAdmin.from('leads').update({ status: 'new' }).eq('id', leadId).eq('status', 'approved');
      throw queueError;
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error in approve route:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}
