import Link from 'next/link';
import { Activity, ArrowUpRight, CheckCircle2, Database, Mail, MessageSquareReply, Radar, Search, Users } from 'lucide-react';
import type { DashboardData } from '@/lib/types';
import { ACTIVE_CAMPAIGN } from '@/lib/tools/lead-recovery/campaign';
import AnalyticsChart from '@/components/dashboard/AnalyticsChart';

export default function LeadRecoveryOverview({ data }: { data: DashboardData }) {
  const contactRate = data.leadStats.total > 0 ? Math.round((data.leadStats.contacted / data.leadStats.total) * 100) : 0;
  const replyRate = data.outreachStats.sent > 0 ? Math.round((data.leadStats.replied / data.outreachStats.sent) * 100) : 0;
  const activeCampaigns = data.jobs.filter((job) => job.status === 'scraping').length;

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-3xl border border-indigo-300/10 bg-[linear-gradient(115deg,rgba(99,102,241,.16),rgba(17,20,28,.72)_48%,rgba(34,211,238,.07))] p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-28 size-72 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-6 xl:flex-row xl:items-end">
          <div className="max-w-2xl"><div className="inline-flex items-center gap-2 rounded-full border border-indigo-300/15 bg-indigo-300/[0.06] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-200"><Radar className="size-3" /> {ACTIVE_CAMPAIGN.name}</div><h1 className="mt-5 text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl">Recover leads they already paid for.</h1><p className="mt-3 max-w-xl text-sm leading-6 text-slate-400 sm:text-base">Qualify established US home-service companies that have inbound demand but lack an obvious instant response, booking, or follow-up flow.</p></div>
          <div className="grid grid-cols-2 gap-3 sm:flex"><QuickStat label="Contact rate" value={`${contactRate}%`} detail={`${data.leadStats.contacted} reached`} /><QuickStat label="Reply rate" value={`${replyRate}%`} detail={`${data.leadStats.replied} replies`} /></div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Users} label="Total prospects" value={data.leadStats.total} detail={`${data.leadStats.new} awaiting review`} accent="indigo" />
        <Metric icon={CheckCircle2} label="Qualified leads" value={data.leadStats.qualified} detail="Score of 70 or above" accent="violet" />
        <Metric icon={Mail} label="Emails sent" value={data.outreachStats.sent} detail={`${data.outreachStats.sentToday} sent today`} accent="cyan" />
        <Metric icon={MessageSquareReply} label="Replies" value={data.leadStats.replied} detail={`${replyRate}% of sent outreach`} accent="emerald" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]">
        <Panel title="Outreach velocity" eyebrow="Last 7 days" icon={Activity}><AnalyticsChart data={data.chartData} /></Panel>
        <Panel title="Pipeline progression" eyebrow="Live funnel" icon={Database}>
          <div className="mt-2 space-y-5">
            {data.pipeline.map((stage, index) => {
              const width = data.leadStats.total > 0 ? Math.max(4, Math.round((stage.value / data.leadStats.total) * 100)) : 0;
              return <div key={stage.label}><div className="mb-2 flex items-center justify-between text-sm"><span className="text-slate-400">{index + 1}. {stage.label}</span><span className="font-semibold tabular-nums text-white">{stage.value}</span></div><div className="h-2 overflow-hidden rounded-full bg-white/[0.05]"><div className="h-full rounded-full" style={{ width: `${width}%`, backgroundColor: stage.tone }} /></div></div>;
            })}
          </div>
          <div className="mt-7 grid grid-cols-3 gap-2 border-t border-white/[0.06] pt-5"><QueueStat label="Queued" value={data.outreachStats.pending} tone="text-amber-300" /><QueueStat label="Failed" value={data.outreachStats.failed} tone="text-rose-300" /><QueueStat label="Active jobs" value={activeCampaigns} tone="text-cyan-300" /></div>
        </Panel>
      </section>

      <section className="rounded-2xl border border-white/[0.07] bg-[#10131a] p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><p className="text-sm font-semibold text-white">Recent campaigns</p><p className="mt-1 text-xs text-slate-500">Latest discovery runs in Lead Recovery.</p></div><Link href="/dashboard/lead-recovery/campaigns" className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-300 hover:text-indigo-200">View all campaigns <ArrowUpRight className="size-3.5" /></Link></div>
        <div className="mt-5 divide-y divide-white/[0.06]">
          {data.jobs.slice(0, 4).map((job) => <Link key={job.id} href={`/dashboard/lead-recovery/job/${job.id}`} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/[0.04] text-slate-400"><Search className="size-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium capitalize text-slate-200">{job.category}</span><span className="mt-0.5 block truncate text-xs capitalize text-slate-500">{job.location}</span></span><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${job.status === 'completed' ? 'bg-emerald-300/10 text-emerald-300' : job.status === 'scraping' ? 'bg-amber-300/10 text-amber-300' : 'bg-rose-300/10 text-rose-300'}`}>{job.status}</span><span className="hidden w-20 text-right text-xs text-slate-500 sm:block">{job.results_count || 0} leads</span></Link>)}
          {data.jobs.length === 0 && <div className="py-9 text-center text-sm text-slate-500">No campaign activity yet. Campaigns remain paused until you activate a target.</div>}
        </div>
      </section>
    </div>
  );
}

function QuickStat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="min-w-32 rounded-2xl border border-white/[0.08] bg-black/20 px-4 py-3 backdrop-blur"><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 text-xl font-semibold text-white">{value}</p><p className="mt-0.5 text-[11px] text-slate-500">{detail}</p></div>;
}

function Metric({ icon: Icon, label, value, detail, accent }: { icon: typeof Users; label: string; value: number; detail: string; accent: 'indigo' | 'violet' | 'cyan' | 'emerald' }) {
  const colors = { indigo: 'bg-indigo-400/10 text-indigo-300', violet: 'bg-violet-400/10 text-violet-300', cyan: 'bg-cyan-400/10 text-cyan-300', emerald: 'bg-emerald-400/10 text-emerald-300' };
  return <div className="rounded-2xl border border-white/[0.07] bg-[#10131a] p-5"><div className="flex items-start justify-between"><div><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-3 text-3xl font-semibold tracking-tight text-white tabular-nums">{value.toLocaleString()}</p></div><span className={`grid size-10 place-items-center rounded-xl ${colors[accent]}`}><Icon className="size-[18px]" /></span></div><p className="mt-4 text-xs text-slate-600">{detail}</p></div>;
}

function Panel({ title, eyebrow, icon: Icon, children }: { title: string; eyebrow: string; icon: typeof Activity; children: React.ReactNode }) {
  return <div className="rounded-2xl border border-white/[0.07] bg-[#10131a] p-5 sm:p-6"><div className="mb-6 flex items-center justify-between"><div><p className="text-sm font-semibold text-white">{title}</p><p className="mt-1 text-xs text-slate-500">{eyebrow}</p></div><span className="grid size-9 place-items-center rounded-xl border border-white/[0.06] bg-white/[0.03] text-slate-500"><Icon className="size-4" /></span></div>{children}</div>;
}

function QueueStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return <div><p className={`text-lg font-semibold tabular-nums ${tone}`}>{value}</p><p className="mt-0.5 text-[10px] uppercase tracking-wider text-slate-600">{label}</p></div>;
}
