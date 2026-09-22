import Link from 'next/link';
import { Bot, CheckCircle2, CircleDollarSign, MessageCircle, QrCode, Send, Users } from 'lucide-react';
import type { RevQrDashboardData } from '@/lib/tools/revqr-whatsapp/types';

export default function RevQrOverview({ data }: { data: RevQrDashboardData }) {
  const metrics = [
    ['Prospects', data.metrics.prospects, Users], ['Open chats', data.metrics.openConversations, MessageCircle],
    ['Demo sent', data.metrics.demoSent, Send], ['Interested', data.metrics.interested, CheckCircle2],
    ['Payment sent', data.metrics.paymentSent, CircleDollarSign], ['Customers', data.metrics.customers, QrCode],
  ] as const;
  return <div className="space-y-6">
    <section className="rounded-3xl border border-emerald-300/10 bg-[linear-gradient(120deg,rgba(16,185,129,.12),rgba(17,20,28,.8)_50%,rgba(99,102,241,.08))] p-6 sm:p-8">
      <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-300/[0.06] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-200"><Bot className="size-3.5" /> Autonomous opt-in sales</div>
      <h1 className="mt-5 text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl">Turn WhatsApp interest into a working RevQR customer.</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400 sm:text-base">Inbound conversations are classified automatically, answered inside WhatsApp’s service window, followed up using an approved template, and stopped immediately on opt-out.</p>
    </section>
    {!data.databaseReady && <div className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.05] px-5 py-4 text-sm text-amber-200">Apply migration 012 to create the RevQR data model, then configure the campaign and Meta webhook.</div>}
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{metrics.map(([label, value, Icon]) => <div key={label} className="rounded-2xl border border-white/[0.07] bg-[#10131a] p-5"><div className="flex justify-between"><div><p className="text-xs text-slate-500">{label}</p><p className="mt-3 text-3xl font-semibold text-white">{value}</p></div><Icon className="size-5 text-emerald-300" /></div></div>)}</section>
    <section className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
      <div className="rounded-2xl border border-white/[0.07] bg-[#10131a] p-6"><h2 className="text-sm font-semibold text-white">Recent pipeline</h2><div className="mt-4 divide-y divide-white/[0.06]">{data.recentProspects.map((prospect) => <div key={prospect.id} className="flex items-center justify-between py-3"><div><p className="text-sm text-slate-200">{prospect.business_name || 'WhatsApp contact'}</p><p className="text-xs text-slate-600">••••{prospect.phone_e164.slice(-4)}</p></div><span className="text-xs capitalize text-slate-500">{prospect.status.replaceAll('_', ' ')}</span></div>)}{!data.recentProspects.length && <p className="py-8 text-center text-sm text-slate-600">No opted-in conversations yet.</p>}</div></div>
      <div className="rounded-2xl border border-white/[0.07] bg-[#10131a] p-6"><h2 className="text-sm font-semibold text-white">Automation state</h2><p className={`mt-4 text-2xl font-semibold ${data.active ? 'text-emerald-300' : 'text-amber-300'}`}>{data.active ? 'Active' : 'Paused'}</p><p className="mt-2 text-sm leading-6 text-slate-500">{data.active ? 'Eligible inbound conversations run without a review queue.' : 'Configure credentials and activate once to begin unattended processing.'}</p><Link href="/dashboard/revqr-whatsapp/campaigns" className="mt-6 inline-flex text-xs font-semibold text-emerald-300">Configure engine →</Link></div>
    </section>
  </div>;
}
