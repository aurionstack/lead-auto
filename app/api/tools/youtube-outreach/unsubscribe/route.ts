import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { addSuppression } from '@/lib/email/suppression';
import { verifyYouTubeUnsubscribe } from '@/lib/tools/youtube-outreach/unsubscribe';

function response(message: string, status = 200) {
  return new NextResponse(`<!doctype html><html><body style="font-family:system-ui;background:#020617;color:#e2e8f0;text-align:center;padding:5rem"><h1>${message}</h1><p>You can close this page.</p></body></html>`, { status, headers: { 'content-type': 'text/html; charset=utf-8' } });
}

async function unsubscribe(request: Request) {
  const url = new URL(request.url);
  let creatorId = url.searchParams.get('creator') || '';
  let token = url.searchParams.get('token') || '';
  if (request.method === 'POST' && request.headers.get('content-type')?.includes('application/x-www-form-urlencoded')) {
    const form = await request.formData();
    creatorId = String(form.get('creator') || creatorId);
    token = String(form.get('token') || token);
  }
  if (!creatorId || !token || !verifyYouTubeUnsubscribe(creatorId, token)) return response('Invalid unsubscribe request', 400);
  const { data: creator } = await supabaseAdmin.from('youtube_creators').select('business_email,organization_id').eq('id', creatorId).maybeSingle();
  if (!creator?.business_email) return response('This creator record was not found', 404);
  await addSuppression(creator.business_email, 'unsubscribed', creator.organization_id);
  await supabaseAdmin.from('youtube_creators').update({ status: 'unsubscribed' }).eq('id', creatorId);
  await supabaseAdmin.from('youtube_outreach_queue').update({ status: 'cancelled', error_message: 'Creator unsubscribed' }).eq('creator_id', creatorId).in('status', ['paused', 'pending', 'locked']);
  return response('You have been unsubscribed');
}

export async function GET(request: Request) { return unsubscribe(request); }
export async function POST(request: Request) { return unsubscribe(request); }
