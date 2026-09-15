import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function POST(request: Request) {
  let body: { authorizationId?: string; decision?: 'approve' | 'deny' };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  if (!body.authorizationId || !['approve', 'deny'].includes(body.decision || '')) {
    return NextResponse.json({ error: 'Authorization ID and decision are required.' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const response = body.decision === 'approve'
    ? await supabase.auth.oauth.approveAuthorization(body.authorizationId, { skipBrowserRedirect: true })
    : await supabase.auth.oauth.denyAuthorization(body.authorizationId, { skipBrowserRedirect: true });
  if (response.error || !response.data?.redirect_url) {
    return NextResponse.json({ error: response.error?.message || 'Authorization failed.' }, { status: 400 });
  }
  return NextResponse.json({ redirectUrl: response.data.redirect_url }, { headers: { 'Cache-Control': 'no-store' } });
}
