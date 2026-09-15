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
