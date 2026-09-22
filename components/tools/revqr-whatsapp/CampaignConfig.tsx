'use client';

import { useState } from 'react';
import type { RevQrCampaign } from '@/lib/tools/revqr-whatsapp/types';

const defaults = { name: 'RevQR WhatsApp Sales Engine', phone_number_id: '', daily_limit: 20, follow_up_delay_hours: 72, demo_url: '', payment_url: '', website_url: 'https://revqr.tech', offer_text: '₹1,499/year including setup and 1–2 branded QR stands.', follow_up_template_name: '', template_language: 'en' };

export default function CampaignConfig({ campaign }: { campaign: RevQrCampaign | null }) {
  const [form, setForm] = useState({ ...defaults, ...(campaign || {}), follow_up_template_name: campaign?.follow_up_template_name || '' });
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const field = (key: keyof typeof defaults, label: string, type = 'text') => <label className="space-y-2"><span className="text-xs font-medium text-slate-400">{label}</span><input type={type} value={String(form[key])} onChange={(event) => setForm((current) => ({ ...current, [key]: type === 'number' ? Number(event.target.value) : event.target.value }))} className="w-full rounded-xl border border-white/10 bg-[#080a10] px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400/40" /></label>;

  async function save() {
    setBusy(true); setMessage('');
    const response = await fetch('/api/tools/revqr-whatsapp/campaigns', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...form, id: campaign?.id }) });
    const result = await response.json();
    setBusy(false); setMessage(response.ok ? 'Saved as paused. Reloading…' : result.error || 'Save failed.');
    if (response.ok) window.location.reload();
  }

  async function action(actionName: 'activate' | 'pause') {
    if (!campaign?.id) return;
    setBusy(true); setMessage('');
    const response = await fetch('/api/tools/revqr-whatsapp/campaigns', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: campaign.id, action: actionName, confirmation: actionName === 'activate' ? 'ACTIVATE REVQR WHATSAPP' : undefined }) });
    const result = await response.json();
    setBusy(false); setMessage(response.ok ? `Campaign ${result.status}. Reloading…` : result.error || 'Action failed.');
    if (response.ok) window.location.reload();
  }

  return <div className="space-y-6">
    <div className="rounded-2xl border border-emerald-300/10 bg-emerald-300/[0.04] p-5 text-sm leading-6 text-slate-400"><strong className="text-emerald-200">Autonomous after activation.</strong> Incoming WhatsApp messages create consent records, open a 24-hour service window, receive an automatic response, and optionally receive one approved-template follow-up. STOP immediately suppresses all future jobs.</div>
    <div className="grid gap-4 rounded-2xl border border-white/[0.07] bg-[#10131a] p-5 sm:grid-cols-2 sm:p-6">
      {field('name', 'Campaign name')}{field('phone_number_id', 'Meta phone number ID')}{field('demo_url', '30-second demo URL')}{field('payment_url', 'Payment URL')}{field('website_url', 'Website URL')}{field('offer_text', 'Offer')}{field('daily_limit', 'Daily message limit', 'number')}{field('follow_up_delay_hours', 'Follow-up delay (hours)', 'number')}{field('follow_up_template_name', 'Approved follow-up template name')}{field('template_language', 'Template language code')}
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2"><button disabled={busy} onClick={save} className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-[#04110c] disabled:opacity-50">Save paused configuration</button>{campaign && (campaign.status === 'active' ? <button disabled={busy} onClick={() => action('pause')} className="rounded-xl border border-amber-300/20 px-4 py-2.5 text-sm font-semibold text-amber-200">Pause</button> : <button disabled={busy} onClick={() => action('activate')} className="rounded-xl border border-emerald-300/20 px-4 py-2.5 text-sm font-semibold text-emerald-200">Activate autonomous engine</button>)}<span className="text-xs text-slate-500">{message}</span></div>
    </div>
  </div>;
}
