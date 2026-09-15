'use client';

import { useState } from 'react';
import { Loader2, LockKeyhole, Save } from 'lucide-react';
import type { YouTubeCampaign } from '@/lib/tools/youtube-outreach/types';

export default function AutomationConfig({ initialCampaign, databaseReady }: { initialCampaign: YouTubeCampaign; databaseReady: boolean }) {
  const [campaign, setCampaign] = useState(initialCampaign);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const set = <K extends keyof YouTubeCampaign>(key: K, value: YouTubeCampaign[K]) => setCampaign((current) => ({ ...current, [key]: value }));

  const saveDraft = async () => {
    setSaving(true); setMessage(null);
    try {
      const response = await fetch('/api/tools/youtube-outreach/campaigns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(campaign) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Unable to save draft.');
      setCampaign(data.campaign);
      setMessage('Paused campaign draft saved. No outreach was started.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to save draft.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
      <div className="rounded-2xl border border-white/[0.07] bg-[#10131a] p-5 sm:p-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Automation status"><select value="paused" disabled className="field"><option>Paused</option></select></Field>
          <Field label="Sender identity"><input className="field" type="email" value={campaign.sender_identity} onChange={(event) => set('sender_identity', event.target.value)} /></Field>
          <Field label="Daily discovery target"><input className="field" type="number" min={0} max={500} value={campaign.daily_discovery_target} onChange={(event) => set('daily_discovery_target', Number(event.target.value))} /></Field>
          <Field label="Daily send limit"><input className="field" type="number" min={0} max={100} value={campaign.daily_limit} onChange={(event) => set('daily_limit', Number(event.target.value))} /></Field>
          <Field label="Subscriber minimum"><input className="field" type="number" min={0} value={campaign.subscriber_min} onChange={(event) => set('subscriber_min', Number(event.target.value))} /></Field>
          <Field label="Subscriber maximum"><input className="field" type="number" min={0} value={campaign.subscriber_max} onChange={(event) => set('subscriber_max', Number(event.target.value))} /></Field>
          <Field label="Languages"><input className="field" value={campaign.languages.join(', ')} onChange={(event) => set('languages', splitList(event.target.value))} /></Field>
          <Field label="Countries"><input className="field" value={campaign.countries.join(', ')} onChange={(event) => set('countries', splitList(event.target.value))} /></Field>
          <Field label="Creator niches"><input className="field" value={campaign.niches.join(', ')} onChange={(event) => set('niches', splitList(event.target.value))} /></Field>
          <Field label="Shorts usage filter"><input className="field" value={campaign.shorts_usage_rule} onChange={(event) => set('shorts_usage_rule', event.target.value)} /></Field>
          <label className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-black/20 px-4 py-3 text-sm text-slate-300 sm:col-span-2"><input type="checkbox" checked={campaign.require_long_form} onChange={(event) => set('require_long_form', event.target.checked)} className="size-4 accent-rose-500" /> Require active long-form content</label>
        </div>
        {message && <p className="mt-5 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3 text-sm text-slate-300">{message}</p>}
        <div className="mt-6 flex justify-end"><button onClick={saveDraft} disabled={saving || !databaseReady} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40">{saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save paused draft</button></div>
      </div>
      <aside className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.04] p-5"><div className="flex items-center gap-2 text-sm font-semibold text-amber-200"><LockKeyhole className="size-4" /> Sending disabled</div><p className="mt-3 text-sm leading-6 text-slate-500">This screen stores targeting configuration only. There is no creator discovery worker, mail sender, or scheduled YouTube outreach process in this release.</p><ul className="mt-5 space-y-2 text-xs text-slate-500"><li>• Campaign status is forced to paused server-side.</li><li>• Public business email provenance is required.</li><li>• Queue records default to paused.</li><li>• Future sends require explicit authorization.</li></ul></aside>
    </div>
  );
}

function splitList(value: string) { return value.split(',').map((item) => item.trim()).filter(Boolean); }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-xs font-medium text-slate-500">{label}</span>{children}</label>; }
