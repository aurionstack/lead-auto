import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { addSuppression } from '@/lib/email/suppression';
import { verifyUnsubscribeToken } from '@/lib/email/unsubscribe';

function htmlResponse(message: string, status = 200) {
  return new NextResponse(`<!doctype html><html><body style="font-family:system-ui;background:#020617;color:#e2e8f0;text-align:center;padding:5rem"><h1>${message}</h1><p>You can close this page.</p></body></html>`, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

export async function POST(request: Request) {
  const contentType = request.headers.get('content-type') || '';
  const requestUrl = new URL(request.url);
  let lead = '';
  let token = '';

  if (contentType.includes('application/json')) {
    const body = await request.json();
    lead = String(body.lead || requestUrl.searchParams.get('lead') || '');
    token = String(body.token || requestUrl.searchParams.get('token') || '');
  } else {
    const form = await request.formData();
    lead = String(form.get('lead') || requestUrl.searchParams.get('lead') || '');
    token = String(form.get('token') || requestUrl.searchParams.get('token') || '');
  }

  if (!lead || !token || !verifyUnsubscribeToken(lead, token)) {
    return htmlResponse('Invalid unsubscribe request', 400);
  }

  const { data, error } = await supabaseAdmin.from('leads').select('email').eq('id', lead).maybeSingle();
  if (error || !data?.email) return htmlResponse('This email record was not found', 404);

  await addSuppression(data.email, 'unsubscribed');
  await supabaseAdmin.from('leads').update({ status: 'unsubscribed' }).eq('id', lead);
  return htmlResponse('You have been unsubscribed');
}
