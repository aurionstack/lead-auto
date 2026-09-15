import { redirect } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase-server';
import ConsentActions from './ConsentActions';

export const metadata = { title: 'Authorize MCP access' };
export const dynamic = 'force-dynamic';

export default async function OAuthConsentPage({ searchParams }: { searchParams: Promise<{ authorization_id?: string }> }) {
  const authorizationId = (await searchParams).authorization_id;
  if (!authorizationId) return <ConsentError message="Missing authorization request." />;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirect=${encodeURIComponent(`/oauth/consent?authorization_id=${authorizationId}`)}`);

  const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
  if (error || !data) return <ConsentError message="This authorization request is invalid or expired." />;
  if ('redirect_url' in data) redirect(data.redirect_url);

  const scopes = data.scope.split(' ').filter(Boolean);
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#080a10] px-5 py-12 text-slate-100">
      <section className="w-full max-w-lg rounded-3xl border border-white/[0.08] bg-[#11141c] p-7 shadow-2xl shadow-black/30 sm:p-9">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-indigo-400/10 text-indigo-300"><ShieldCheck className="size-6" /></div>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-300">AurionStack authorization</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Connect {data.client.name}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">This app is requesting read-only access to operational data in your AurionStack workspace.</p>
        <div className="mt-6 rounded-2xl border border-white/[0.07] bg-black/20 p-5">
          <p className="text-sm font-medium text-white">Allowed</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-400">
            <li>View Lead Recovery status, prospects, replies, and statistics</li>
            <li>View YouTube Outreach status, creators, replies, and statistics</li>
          </ul>
          <p className="mt-5 text-sm font-medium text-white">Not allowed</p>
          <p className="mt-2 text-sm text-slate-400">No scraping, editing, campaign activation, queueing, or message sending.</p>
        </div>
        {scopes.length > 0 && <p className="mt-5 text-xs text-slate-600">Requested scopes: {scopes.join(', ')}</p>}
        <ConsentActions authorizationId={authorizationId} />
      </section>
    </main>
  );
}

function ConsentError({ message }: { message: string }) {
  return <main className="flex min-h-screen items-center justify-center bg-[#080a10] px-5 text-slate-100"><div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-6 text-rose-200">{message}</div></main>;
}
