import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { hasDashboardSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  if (!(await hasDashboardSession())) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const { search_query, location, channel } = await request.json();

    if (
      typeof search_query !== 'string' || !search_query.trim() || search_query.length > 120 ||
      typeof location !== 'string' || !location.trim() || location.length > 160 ||
      !['email', 'whatsapp', 'instantly'].includes(channel)
    ) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('search_configs')
      .insert([{ search_query: search_query.trim(), location: location.trim(), channel }]);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}
