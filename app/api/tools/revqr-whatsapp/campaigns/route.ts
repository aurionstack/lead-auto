import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { getCurrentOrganizationId } from '@/lib/tenancy';

export async function POST(request: Request) {
  const organizationId = await getCurrentOrganizationId();
  if (!organizationId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  try {
    const input = await request.json() as Record<string, unknown>;
    const text = (key: string, max = 500) => typeof input[key] === 'string' && String(input[key]).trim().length <= max ? String(input[key]).trim() : '';
    const dailyLimit = Number(input.daily_limit);
    const followUpDelay = Number(input.follow_up_delay_hours);
    const payload = {
      organization_id: organizationId,
      name: text('name', 160),
      phone_number_id: text('phone_number_id', 100),
      daily_limit: dailyLimit,
      follow_up_delay_hours: followUpDelay,
      demo_url: text('demo_url', 1000),
      payment_url: text('payment_url', 1000),
      website_url: text('website_url', 1000),
      offer_text: text('offer_text', 1000),
      follow_up_template_name: text('follow_up_template_name', 160) || null,
      template_language: text('template_language', 20),
      status: 'paused' as const,
    };
    if (!payload.name || !payload.phone_number_id || !payload.demo_url.startsWith('https://') || !payload.payment_url.startsWith('https://') || !payload.website_url.startsWith('https://') || !payload.offer_text || !payload.template_language || !Number.isInteger(dailyLimit) || dailyLimit < 1 || dailyLimit > 100 || !Number.isInteger(followUpDelay) || followUpDelay < 24 || followUpDelay > 336) return NextResponse.json({ error: 'Invalid campaign configuration.' }, { status: 400 });
    const supabase = await createClient();
    const query = typeof input.id === 'string' && input.id
      ? supabase.from('revqr_campaigns').update(payload).eq('id', input.id).eq('organization_id', organizationId)
      : supabase.from('revqr_campaigns').insert(payload);
    const { data, error } = await query.select('*').single();
    if (error) throw error;
    return NextResponse.json({ campaign: data });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Campaign save failed.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const organizationId = await getCurrentOrganizationId();
  if (!organizationId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  try {
    const input = await request.json() as { id?: string; action?: 'activate' | 'pause'; confirmation?: string };
    if (!input.id || !['activate', 'pause'].includes(input.action || '')) return NextResponse.json({ error: 'Invalid campaign action.' }, { status: 400 });
    const supabase = await createClient();
    const { data: campaign } = await supabase.from('revqr_campaigns').select('*').eq('id', input.id).eq('organization_id', organizationId).maybeSingle();
    if (!campaign) return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 });

    if (input.action === 'activate') {
      if (input.confirmation !== 'ACTIVATE REVQR WHATSAPP') return NextResponse.json({ error: 'Exact activation confirmation is required.' }, { status: 400 });
      if (!process.env.WHATSAPP_ACCESS_TOKEN || !process.env.WHATSAPP_APP_SECRET || !process.env.WHATSAPP_VERIFY_TOKEN) return NextResponse.json({ error: 'WhatsApp credentials are incomplete.' }, { status: 409 });
      if (!process.env.REVQR_ONBOARDING_WEBHOOK_URL?.startsWith('https://') || !process.env.REVQR_ONBOARDING_WEBHOOK_SECRET) return NextResponse.json({ error: 'RevQR onboarding integration is incomplete.' }, { status: 409 });
      if (!campaign.phone_number_id || !campaign.demo_url || !campaign.payment_url || !campaign.follow_up_template_name || campaign.daily_limit < 1) return NextResponse.json({ error: 'Complete the campaign configuration and approved follow-up template before activation.' }, { status: 409 });
      const { error } = await supabase.from('revqr_campaigns').update({ status: 'active' }).eq('id', campaign.id).eq('organization_id', organizationId);
      if (error) throw error;
      await supabase.from('revqr_jobs').update({ status: 'pending' }).eq('campaign_id', campaign.id).eq('organization_id', organizationId).eq('status', 'paused');
      return NextResponse.json({ status: 'active' });
    }

    const { error } = await supabase.from('revqr_campaigns').update({ status: 'paused' }).eq('id', campaign.id).eq('organization_id', organizationId);
    if (error) throw error;
    await supabase.from('revqr_jobs').update({ status: 'paused' }).eq('campaign_id', campaign.id).eq('organization_id', organizationId).eq('status', 'pending');
    return NextResponse.json({ status: 'paused' });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Campaign action failed.' }, { status: 500 });
  }
}
