'use client';

import { useState } from 'react';
import type { SocialCampaign, SocialPost } from '@/lib/tools/social-monitor/types';

type Form = {
  id?: string; name: string; reddit_enabled: boolean; x_enabled: boolean; subreddits: string;
  x_query: string; score_threshold: number; daily_alert_limit: number; telegram_chat_id: string;
};

const emptyForm: Form = {
  name: 'AurionStack buyer opportunities', reddit_enabled: true, x_enabled: false,
  subreddits: 'forhire, freelance_forhire, Jobbit, VideoEditingRequests, reactjs, nextjs',
  x_query: '', score_threshold: 70, daily_alert_limit: 10, telegram_chat_id: '',
};

export default function SocialMonitorWorkspace({ databaseReady, campaigns, posts, readiness }: {
  databaseReady: boolean; campaigns: SocialCampaign[]; posts: SocialPost[];
  readiness: { reddit: boolean; x: boolean; telegram: boolean; gemini: boolean };
}) {
  const [form, setForm] = useState<Form>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const update = <K extends keyof Form>(key: K, value: Form[K]) => setForm((current) => ({ ...current, [key]: value }));
  const edit = (campaign: SocialCampaign) => setForm({ id: campaign.id, name: campaign.name,
    reddit_enabled: campaign.reddit_enabled, x_enabled: campaign.x_enabled,
    subreddits: campaign.subreddits.join(', '), x_query: campaign.x_query || '',
    score_threshold: campaign.score_threshold, daily_alert_limit: campaign.daily_alert_limit,
    telegram_chat_id: campaign.telegram_chat_id });
  async function save() {
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/tools/social-monitor/campaigns', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...form, subreddits: form.subreddits.split(',').map((value) => value.trim()).filter(Boolean) }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Save failed');
      window.location.reload();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Save failed'); }
    finally { setBusy(false); }
  }
  async function changeStatus(campaign: SocialCampaign, action: 'activate' | 'pause') {
    let confirmation = '';
    if (action === 'activate') {
      confirmation = window.prompt('This starts polling public posts and may incur provider costs. Type ACTIVATE SOCIAL MONITOR to continue.') || '';
      if (confirmation !== 'ACTIVATE SOCIAL MONITOR') return;
    }
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/tools/social-monitor/campaigns', { method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: campaign.id, action, confirmation }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Action failed');
      window.location.reload();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Action failed'); }
    finally { setBusy(false); }
  }
  const inputClass = 'mt-2 w-full rounded-xl border border-white/10 bg-[#0b0e14] px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-violet-300/50';
  return <div className="mx-auto max-w-6xl space-y-7">
    <header><p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">AurionStack · Social intelligence</p>
      <h1 className="mt-3 text-3xl font-semibold text-white">Reddit & X Lead Monitor</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">Watch public hiring requests for web development, AI automation, and video editing. Filter sellers, score buyer intent, save opportunities, and alert your team on Telegram with a suggested reply. The system never posts, DMs, or emails prospects automatically.</p>
    </header>

    {!databaseReady && <div className="rounded-2xl border border-amber-300/20 bg-amber-300/5 p-5 text-sm text-amber-200">Database setup required: apply <code>supabase/migrations/014_social_lead_monitor.sql</code> before saving a monitor. Nothing is active.</div>}
    <div className="grid gap-3 sm:grid-cols-4">{Object.entries(readiness).map(([name, ready]) => <div key={name} className="rounded-2xl border border-white/[0.07] bg-[#10131a] p-4"><p className="text-xs uppercase tracking-widest text-slate-500">{name}</p><p className={`mt-2 text-sm font-semibold ${ready ? 'text-emerald-300' : 'text-amber-300'}`}>{ready ? 'Configured' : 'Setup needed'}</p></div>)}</div>
    <p className="text-xs text-slate-500">Reddit and X require their own API access; X search availability and charges depend on your X developer plan. The classifier can use the organization’s existing Gemini key even when the global indicator says setup needed.</p>

    <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
      <div className="rounded-3xl border border-white/[0.07] bg-[#10131a] p-6">
        <div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-white">{form.id ? 'Edit monitor' : 'New monitor'}</h2>{form.id && <button type="button" onClick={() => setForm(emptyForm)} className="text-xs text-violet-300">Create new</button>}</div>
        <p className="mt-2 text-sm text-slate-500">Saving always pauses the monitor. Activation is a separate deliberate step.</p>
        <div className="mt-5 space-y-4">
          <label className="block text-xs text-slate-400">Name<input className={inputClass} value={form.name} onChange={(event) => update('name', event.target.value)} /></label>
          <div className="flex gap-6 text-sm text-slate-300"><label className="flex items-center gap-2"><input type="checkbox" checked={form.reddit_enabled} onChange={(event) => update('reddit_enabled', event.target.checked)} /> Reddit</label><label className="flex items-center gap-2"><input type="checkbox" checked={form.x_enabled} onChange={(event) => update('x_enabled', event.target.checked)} /> X recent search</label></div>
          <label className="block text-xs text-slate-400">Subreddits (comma-separated, up to 6)<input className={inputClass} value={form.subreddits} onChange={(event) => update('subreddits', event.target.value)} /></label>
          <label className="block text-xs text-slate-400">X search query<input className={inputClass} value={form.x_query} onChange={(event) => update('x_query', event.target.value)} placeholder='("looking for" OR hiring) (developer OR editor)' /></label>
          <div className="grid gap-4 sm:grid-cols-2"><label className="block text-xs text-slate-400">Minimum score<input type="number" min="50" max="100" className={inputClass} value={form.score_threshold} onChange={(event) => update('score_threshold', Number(event.target.value))} /></label><label className="block text-xs text-slate-400">Maximum alerts per day<input type="number" min="1" max="50" className={inputClass} value={form.daily_alert_limit} onChange={(event) => update('daily_alert_limit', Number(event.target.value))} /></label></div>
          <label className="block text-xs text-slate-400">Telegram numeric chat ID<input className={inputClass} value={form.telegram_chat_id} onChange={(event) => update('telegram_chat_id', event.target.value)} placeholder="Required to activate" /></label>
          <button type="button" disabled={!databaseReady || busy} onClick={save} className="rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Save as paused</button>
        </div>
      </div>
      <div className="rounded-3xl border border-white/[0.07] bg-[#10131a] p-6"><h2 className="text-lg font-semibold text-white">Monitors</h2>
        {campaigns.length ? <div className="mt-5 space-y-4">{campaigns.map((campaign) => <div key={campaign.id} className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4"><div className="flex justify-between gap-3"><p className="font-medium text-white">{campaign.name}</p><span className={`text-xs uppercase ${campaign.status === 'active' ? 'text-emerald-300' : 'text-amber-300'}`}>{campaign.status}</span></div><p className="mt-2 text-xs text-slate-500">{[campaign.reddit_enabled && 'Reddit', campaign.x_enabled && 'X'].filter(Boolean).join(' + ')} · score ≥ {campaign.score_threshold} · {campaign.daily_alert_limit} alerts/day</p>{campaign.last_error && <p className="mt-2 text-xs text-rose-300">Last error: {campaign.last_error}</p>}<div className="mt-4 flex gap-3 text-xs"><button onClick={() => edit(campaign)} className="text-violet-300">Edit</button><button disabled={busy} onClick={() => changeStatus(campaign, campaign.status === 'active' ? 'pause' : 'activate')} className="text-slate-200 disabled:opacity-50">{campaign.status === 'active' ? 'Pause' : 'Activate'}</button></div></div>)}</div> : <p className="mt-4 text-sm text-slate-500">No monitor saved yet.</p>}
      </div>
    </section>
    {message && <p role="alert" className="rounded-xl border border-rose-300/20 bg-rose-300/5 p-4 text-sm text-rose-200">{message}</p>}
    <section className="rounded-3xl border border-white/[0.07] bg-[#10131a] p-6"><h2 className="text-lg font-semibold text-white">Qualified opportunities</h2><p className="mt-2 text-sm text-slate-500">Drafts are suggestions to review manually before replying on the source platform.</p>
      {posts.length ? <div className="mt-5 space-y-4">{posts.map((post) => <article key={post.id} className="rounded-2xl border border-white/[0.07] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-semibold uppercase tracking-wider text-violet-300">{post.platform === 'reddit' ? `r/${post.source_name}` : 'X'} · {post.category} · {post.score ?? 0}/100</p><span className="text-xs text-slate-500">{post.status.replace('_', ' ')}</span></div><a href={post.post_url} target="_blank" rel="noopener noreferrer" className="mt-2 block text-sm font-medium text-white hover:text-violet-200">{post.title} ↗</a>{post.budget && <p className="mt-2 text-xs text-slate-500">Budget: {post.budget}</p>}{post.draft_reply && <p className="mt-3 whitespace-pre-wrap rounded-xl bg-white/[0.03] p-3 text-xs leading-5 text-slate-300">Suggested reply: {post.draft_reply}</p>}{post.last_error && <p className="mt-2 text-xs text-rose-300">Alert error: {post.last_error}</p>}</article>)}</div> : <p className="mt-4 text-sm text-slate-500">No qualified opportunities yet.</p>}
    </section>
  </div>;
}
