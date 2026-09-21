'use client';

import { useState } from 'react';
import { LockKeyhole, Pause, Play, Save } from 'lucide-react';
import type { YouTubeCampaign } from '@/lib/tools/youtube-outreach/types';

export default function AutomationConfig({ initialCampaign, databaseReady }: { initialCampaign: YouTubeCampaign; databaseReady: boolean }) {
  const [campaign, setCampaign] = useState(initialCampaign);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState('');
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

  const changeStatus = async (action: 'activate' | 'pause') => {
    if (!campaign.id) return setMessage('Save the campaign draft before activation.');
    setSaving(true); setMessage(null);
    try {
      const response = await fetch('/api/tools/youtube-outreach/campaigns', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: campaign.id, action, confirmation }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Unable to change campaign status.');
      setCampaign((current) => ({ ...current, status: data.status }));
      setConfirmation('');
      setMessage(action === 'activate' ? 'Campaign activated. Discovery and guarded sending will run on schedule.' : 'Campaign paused. Pending messages were returned to the paused state.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to change campaign status.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
      <div className="rounded-2xl border border-white/[0.07] bg-[#10131a] p-5 sm:p-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Automation status"><select value={campaign.status} disabled className="field"><option value="paused">Paused</option><option value="active">Active</option><option value="completed">Completed</option></select></Field>
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
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex-1">{campaign.status !== 'active' && <input className="field" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Type ACTIVATE YOUTUBE OUTREACH" />}</div><div className="flex gap-2"><button onClick={saveDraft} disabled={saving || !databaseReady || campaign.status === 'active'} className="inline-flex items-center gap-2 rounded-xl border border-white/[0.1] px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-40"><Save className="size-4" /> Save draft</button>{campaign.status === 'active' ? <button onClick={() => changeStatus('pause')} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-amber-300 px-4 py-2.5 text-sm font-semibold text-slate-950"><Pause className="size-4" /> Pause</button> : <button onClick={() => changeStatus('activate')} disabled={saving || confirmation !== 'ACTIVATE YOUTUBE OUTREACH'} className="inline-flex items-center gap-2 rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"><Play className="size-4" /> Activate</button>}</div></div>
      </div>
      <aside className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.04] p-5"><div className="flex items-center gap-2 text-sm font-semibold text-amber-200"><LockKeyhole className="size-4" /> Guarded automation</div><p className="mt-3 text-sm leading-6 text-slate-500">Discovery and sending remain paused until the exact activation phrase is submitted. Activation is refused unless YouTube, Hunter, SMTP, sender identity, postal address, and daily limits are ready.</p><ul className="mt-5 space-y-2 text-xs text-slate-500"><li>• Public channel-description email provenance is required.</li><li>• Hunter must verify the mailbox as valid.</li><li>• Suppression and unsubscribe checks run before delivery.</li><li>• Pausing returns unsent messages to a safe paused state.</li></ul></aside>
    </div>
  );
}

function splitList(value: string) { return value.split(',').map((item) => item.trim()).filter(Boolean); }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-xs font-medium text-slate-500">{label}</span>{children}</label>; }
