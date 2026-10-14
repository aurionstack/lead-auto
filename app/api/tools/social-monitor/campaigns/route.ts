import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { getCurrentOrganizationId } from '@/lib/tenancy';
import { redditConfigured, telegramConfigured, xConfigured } from '@/lib/tools/social-monitor/providers';

function validate(input: Record<string, unknown>) {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const rawSubreddits = Array.isArray(input.subreddits) ? input.subreddits : [];
  const subreddits = rawSubreddits.map((value) => typeof value === 'string' ? value.trim().replace(/^r\//, '') : '');
  const xQuery = typeof input.x_query === 'string' ? input.x_query.trim() : '';
  const chatId = typeof input.telegram_chat_id === 'string' ? input.telegram_chat_id.trim() : '';
  const redditEnabled = input.reddit_enabled === true;
  const xEnabled = input.x_enabled === true;
  const threshold = Number(input.score_threshold);
  const alertLimit = Number(input.daily_alert_limit);
  if (!name || name.length > 160 || (!redditEnabled && !xEnabled) || subreddits.length > 6 || (redditEnabled && !subreddits.length) || subreddits.some((value) => !/^[A-Za-z0-9_]{2,21}$/.test(value)) || (xEnabled && (!xQuery || xQuery.length > 256)) || !Number.isInteger(threshold) || threshold < 50 || threshold > 100 || !Number.isInteger(alertLimit) || alertLimit < 1 || alertLimit > 50 || (chatId && !/^-?\d{5,20}$/.test(chatId))) return null;
  return { name, reddit_enabled: redditEnabled, x_enabled: xEnabled, subreddits, x_query: xQuery || null,
    score_threshold: threshold, daily_alert_limit: alertLimit, telegram_chat_id: chatId };
}

export async function POST(request: Request) {
  const organizationId = await getCurrentOrganizationId();
  if (!organizationId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  try {
    const input = await request.json() as Record<string, unknown>;
    const payload = validate(input);
    if (!payload) return NextResponse.json({ error: 'Invalid monitor settings.' }, { status: 400 });
    const supabase = await createClient();
    const id = typeof input.id === 'string' ? input.id : null;
    const query = id
      ? supabase.from('social_monitor_campaigns').update({ ...payload, status: 'paused', last_error: null }).eq('id', id).eq('organization_id', organizationId)
      : supabase.from('social_monitor_campaigns').insert({ ...payload, organization_id: organizationId, status: 'paused' });
    const { data, error } = await query.select('*').single();
    if (error || !data) return NextResponse.json({ error: 'Could not save the paused monitor. Apply migration 014 first.' }, { status: 500 });
    return NextResponse.json({ campaign: data });
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const organizationId = await getCurrentOrganizationId();
  if (!organizationId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  try {
    const input = await request.json() as { id?: string; action?: string; confirmation?: string };
    if (!input.id || !['activate', 'pause'].includes(input.action || '')) return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
    const supabase = await createClient();
    const { data: campaign, error: lookupError } = await supabase.from('social_monitor_campaigns').select('*').eq('id', input.id).eq('organization_id', organizationId).maybeSingle();
    if (lookupError || !campaign) return NextResponse.json({ error: 'Monitor not found.' }, { status: 404 });
    if (input.action === 'activate') {
      if (input.confirmation !== 'ACTIVATE SOCIAL MONITOR') return NextResponse.json({ error: 'Exact activation phrase required.' }, { status: 400 });
      if (campaign.reddit_enabled && !redditConfigured()) return NextResponse.json({ error: 'Reddit credentials are not configured.' }, { status: 409 });
      if (campaign.x_enabled && !xConfigured()) return NextResponse.json({ error: 'X bearer token is not configured.' }, { status: 409 });
      if (!telegramConfigured() || !campaign.telegram_chat_id) return NextResponse.json({ error: 'Telegram bot and numeric chat ID are required.' }, { status: 409 });
      const { data: settings } = await supabase.from('organization_settings').select('gemini_api_key').eq('organization_id', organizationId).maybeSingle();
      if (!settings?.gemini_api_key && !process.env.GEMINI_API_KEY) return NextResponse.json({ error: 'Gemini classifier key is required.' }, { status: 409 });
      const { count } = await supabase.from('social_monitor_campaigns').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).eq('status', 'active').neq('id', input.id);
      if (count) return NextResponse.json({ error: 'Pause the other active social monitor first.' }, { status: 409 });
    }
    const now = new Date().toISOString();
    const { error } = await supabase.from('social_monitor_campaigns').update(input.action === 'activate'
      ? { status: 'active', reddit_polled_at: now, x_polled_at: now, last_error: null }
      : { status: 'paused' }).eq('id', input.id).eq('organization_id', organizationId);
    if (error) throw error;
    return NextResponse.json({ status: input.action === 'activate' ? 'active' : 'paused' });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Monitor action failed.' }, { status: 500 });
  }
}
