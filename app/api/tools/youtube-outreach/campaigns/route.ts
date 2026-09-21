import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { getCurrentOrganizationId } from '@/lib/tenancy';
import type { YouTubeCampaign } from '@/lib/tools/youtube-outreach/types';

function strings(value: unknown, maxItems: number): string[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > maxItems) return null;
  const values = value.map((item) => typeof item === 'string' ? item.trim() : '').filter(Boolean);
  return values.length === value.length && values.every((item) => item.length <= 80) ? values : null;
}

function integer(value: unknown, min: number, max: number): number | null {
  return Number.isInteger(value) && Number(value) >= min && Number(value) <= max ? Number(value) : null;
}

export async function POST(request: Request) {
  const organizationId = await getCurrentOrganizationId();
  if (!organizationId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  try {
    const input = await request.json() as Partial<YouTubeCampaign>;
    const dailyDiscoveryTarget = integer(input.daily_discovery_target, 0, 500);
    const dailyLimit = integer(input.daily_limit, 0, 100);
    const subscriberMin = integer(input.subscriber_min, 0, 100_000_000);
    const subscriberMax = integer(input.subscriber_max, 0, 100_000_000);
    const countries = strings(input.countries, 20);
    const languages = strings(input.languages, 10);
    const niches = strings(input.niches, 20);
    const senderIdentity = typeof input.sender_identity === 'string' ? input.sender_identity.trim() : '';
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    const shortsUsageRule = typeof input.shorts_usage_rule === 'string' ? input.shorts_usage_rule.trim() : '';

    if (!name || name.length > 160 || !senderIdentity || senderIdentity.length > 320 || !senderIdentity.includes('@') || !shortsUsageRule || shortsUsageRule.length > 240 || dailyDiscoveryTarget === null || dailyLimit === null || subscriberMin === null || subscriberMax === null || subscriberMin > subscriberMax || !countries || !languages || !niches || typeof input.require_long_form !== 'boolean') {
      return NextResponse.json({ error: 'Invalid campaign configuration.' }, { status: 400 });
    }

    const payload = {
      organization_id: organizationId,
      name,
      status: 'paused' as const,
      daily_discovery_target: dailyDiscoveryTarget,
      daily_limit: dailyLimit,
      subscriber_min: subscriberMin,
      subscriber_max: subscriberMax,
      countries,
      languages,
      niches,
      require_long_form: input.require_long_form,
      shorts_usage_rule: shortsUsageRule,
      sender_identity: senderIdentity,
    };
    const supabase = await createClient();
    const query = input.id
      ? supabase.from('youtube_campaigns').update(payload).eq('id', input.id).eq('organization_id', organizationId)
      : supabase.from('youtube_campaigns').insert(payload);
    const { data, error } = await query.select('*').single();
    if (error) {
      console.error('[youtube-outreach] Unable to save paused campaign:', error.message);
      return NextResponse.json({ error: 'Unable to save campaign. Apply migration 010 if it is not installed.' }, { status: 500 });
    }
    return NextResponse.json({ campaign: data });
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request.' }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const organizationId = await getCurrentOrganizationId();
  if (!organizationId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  try {
    const input = await request.json() as { id?: string; action?: 'activate' | 'pause'; confirmation?: string };
    if (!input.id || !['activate', 'pause'].includes(input.action || '')) return NextResponse.json({ error: 'Invalid campaign action.' }, { status: 400 });
    const supabase = await createClient();
    const { data: campaign, error: campaignError } = await supabase.from('youtube_campaigns').select('*').eq('id', input.id).eq('organization_id', organizationId).maybeSingle();
    if (campaignError || !campaign) return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 });

    if (input.action === 'activate') {
      if (input.confirmation !== 'ACTIVATE YOUTUBE OUTREACH') return NextResponse.json({ error: 'Exact activation confirmation is required.' }, { status: 400 });
      if (!process.env.YOUTUBE_API_KEY) return NextResponse.json({ error: 'YOUTUBE_API_KEY is not configured.' }, { status: 409 });
      const { data: settings } = await supabase.from('organization_settings').select('smtp_host,smtp_user,smtp_password,from_email,postal_address,hunter_api_key').eq('organization_id', organizationId).maybeSingle();
      if (!settings?.smtp_host || !settings.smtp_user || !settings.smtp_password || !settings.from_email || !settings.postal_address?.trim()) return NextResponse.json({ error: 'Complete SMTP sender and postal-address settings before activation.' }, { status: 409 });
      if (!settings.hunter_api_key && !process.env.HUNTER_API_KEY) return NextResponse.json({ error: 'Hunter verification is required before activation.' }, { status: 409 });
      if (settings.from_email.toLowerCase() !== campaign.sender_identity.toLowerCase()) return NextResponse.json({ error: 'Campaign sender must exactly match the configured workspace sender.' }, { status: 409 });
      if (campaign.daily_limit < 1 || campaign.daily_discovery_target < 1) return NextResponse.json({ error: 'Discovery and send limits must be greater than zero.' }, { status: 409 });
      const { error } = await supabase.from('youtube_campaigns').update({ status: 'active' }).eq('id', campaign.id).eq('organization_id', organizationId);
      if (error) throw error;
      await supabase.from('youtube_outreach_queue').update({ status: 'pending', scheduled_for: new Date().toISOString() }).eq('campaign_id', campaign.id).eq('organization_id', organizationId).eq('status', 'paused');
      return NextResponse.json({ status: 'active' });
    }

    const { error } = await supabase.from('youtube_campaigns').update({ status: 'paused' }).eq('id', campaign.id).eq('organization_id', organizationId);
    if (error) throw error;
    await supabase.from('youtube_outreach_queue').update({ status: 'paused' }).eq('campaign_id', campaign.id).eq('organization_id', organizationId).eq('status', 'pending');
    return NextResponse.json({ status: 'paused' });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Campaign action failed.' }, { status: 500 });
  }
}
