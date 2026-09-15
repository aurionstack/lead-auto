import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { hasDashboardSession } from '@/lib/auth';
import { validateCampaignTarget } from '@/lib/tools/lead-recovery/campaign';
import { getCurrentOrganizationId } from '@/lib/tenancy';

export async function POST(request: NextRequest) {
  if (!(await hasDashboardSession())) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const organizationId = await getCurrentOrganizationId();
    if (!organizationId) return NextResponse.json({ error: 'No organization found.' }, { status: 403 });
    const { search_query, location, channel } = await request.json();

    if (
      typeof search_query !== 'string' || !search_query.trim() || search_query.length > 120 ||
      typeof location !== 'string' || !location.trim() || location.length > 160 ||
      !['email', 'whatsapp', 'instantly'].includes(channel)
    ) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const cleanQuery = search_query.trim();
    const cleanLocation = location.trim();
    const campaignError = validateCampaignTarget(cleanQuery, cleanLocation);
    if (campaignError) {
      return NextResponse.json({ error: campaignError }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('search_configs')
      .insert([{ search_query: cleanQuery, location: cleanLocation, channel, organization_id: organizationId, is_active: false }]);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}
