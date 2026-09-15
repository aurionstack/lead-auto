import Link from 'next/link';
import { ArrowRight, CheckCircle2, CircleDashed, MessageSquareReply, Send, Sparkles, UserCheck, Users, Video as Youtube } from 'lucide-react';
import type { YouTubeDashboardData } from '@/lib/tools/youtube-outreach/types';

const pipeline = [
  ['Discovered', 'discovered'], ['Qualified', 'qualified'], ['Contacted', 'contacted'],
  ['Replied', 'replies'], ['Sample requested', 'samplesRequested'], ['Clients', 'clients'],
] as const;

export default function YouTubeOverview({ data }: { data: YouTubeDashboardData }) {
  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-rose-300/10 bg-[linear-gradient(120deg,rgba(244,63,94,.12),rgba(17,20,28,.75)_48%,rgba(99,102,241,.08))] p-6 sm:p-8">
        <div className="relative max-w-3xl"><div className="inline-flex items-center gap-2 rounded-full border border-rose-300/15 bg-rose-300/[0.06] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-200"><Youtube className="size-3.5" /> Creator acquisition</div><h1 className="mt-5 text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl">Turn long-form authority into a Shorts growth opportunity.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">Qualify commercially mature English-speaking creators who publish strong long-form content but underuse Shorts. Outreach remains paused until a sender workflow is explicitly implemented and authorized.</p></div>
      </section>

      {!data.databaseReady && <div className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.05] px-5 py-4 text-sm text-amber-200"><span className="font-semibold">Database setup required.</span> Apply migration 010 to persist creators and campaign drafts. The module is currently showing safe defaults.</div>}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Users} label="Creators discovered" value={data.metrics.discovered} />
        <Metric icon={UserCheck} label="Qualified" value={data.metrics.qualified} />
        <Metric icon={Send} label="Contacted" value={data.metrics.contacted} />
        <Metric icon={MessageSquareReply} label="Replies" value={data.metrics.replies} />
        <Metric icon={CheckCircle2} label="Positive replies" value={data.metrics.positiveReplies} />
        <Metric icon={Sparkles} label="Samples requested" value={data.metrics.samplesRequested} />
        <Metric icon={CircleDashed} label="Clients" value={data.metrics.clients} />
      </section>

      <section className="rounded-2xl border border-white/[0.07] bg-[#10131a] p-5 sm:p-6">
        <div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold text-white">Creator pipeline</h2><p className="mt-1 text-xs text-slate-500">A separate lifecycle from Lead Recovery prospects.</p></div><span className="rounded-full bg-amber-300/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-300">{data.campaign.status}</span></div>
        <div className="mt-6 grid gap-2 md:grid-cols-6">
          {pipeline.map(([label, key], index) => <div key={key} className="relative rounded-xl border border-white/[0.06] bg-white/[0.025] p-4"><p className="text-2xl font-semibold tabular-nums text-white">{data.metrics[key]}</p><p className="mt-1 text-[10px] uppercase tracking-wider text-slate-500">{label}</p>{index < pipeline.length - 1 && <ArrowRight className="absolute -right-3 top-1/2 z-10 hidden size-4 -translate-y-1/2 text-slate-700 md:block" />}</div>)}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl border border-white/[0.07] bg-[#10131a] p-5 sm:p-6"><div className="flex items-center justify-between"><h2 className="text-sm font-semibold text-white">Recently discovered</h2><Link href="/dashboard/youtube-outreach/creators" className="text-xs font-semibold text-rose-300 hover:text-rose-200">View creators →</Link></div><div className="mt-5 divide-y divide-white/[0.06]">{data.recentCreators.map((creator) => <div key={creator.id} className="flex items-center gap-3 py-3"><span className="grid size-9 place-items-center rounded-xl bg-rose-400/10 text-rose-300"><Youtube className="size-4" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-200">{creator.channel_name}</p><p className="text-xs text-slate-600">{creator.subscriber_count?.toLocaleString() ?? 'Unknown'} subscribers</p></div><span className="text-xs capitalize text-slate-500">{creator.status.replaceAll('_', ' ')}</span></div>)}{data.recentCreators.length === 0 && <p className="py-8 text-center text-sm text-slate-600">No creators imported yet.</p>}</div></div>
        <div className="rounded-2xl border border-white/[0.07] bg-[#10131a] p-5 sm:p-6"><h2 className="text-sm font-semibold text-white">Pilot targeting</h2><dl className="mt-5 space-y-4 text-sm"><Row label="Subscribers" value={`${data.campaign.subscriber_min.toLocaleString()}–${data.campaign.subscriber_max.toLocaleString()}`} /><Row label="Language" value={data.campaign.languages.join(', ')} /><Row label="Long-form" value={data.campaign.require_long_form ? 'Required' : 'Optional'} /><Row label="Daily send limit" value={`${data.campaign.daily_limit} (paused)`} /></dl><Link href="/dashboard/youtube-outreach/automation" className="mt-6 inline-flex text-xs font-semibold text-rose-300 hover:text-rose-200">Configure automation →</Link></div>
      </section>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
  return <div className="rounded-2xl border border-white/[0.07] bg-[#10131a] p-5"><div className="flex items-start justify-between"><div><p className="text-xs text-slate-500">{label}</p><p className="mt-3 text-3xl font-semibold tabular-nums text-white">{value.toLocaleString()}</p></div><span className="grid size-9 place-items-center rounded-xl bg-rose-400/10 text-rose-300"><Icon className="size-4" /></span></div></div>;
}
function Row({ label, value }: { label: string; value: string }) { return <div className="flex justify-between gap-4"><dt className="text-slate-500">{label}</dt><dd className="text-right font-medium text-slate-300">{value}</dd></div>; }
