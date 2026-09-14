'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Activity, ArrowUpRight, BarChart3, Bolt, CheckCircle2, Clock3, Database,
  Inbox, KeyRound, Layers3, LogOut, Mail, Menu, MessageSquareReply, Search,
  Sparkles, Target, Users, X,
} from 'lucide-react';
import type { DashboardData } from '@/lib/types';
import { createClient } from '@/lib/supabase-client';
import AnalyticsChart from './AnalyticsChart';
import SentInbox from './SentInbox';
import BatchListClient from './BatchListClient';

type Tab = 'overview' | 'inbox' | 'campaigns';

const tabs: { id: Tab; label: string; icon: typeof BarChart3 }[] = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'inbox', label: 'Sent mail', icon: Inbox },
  { id: 'campaigns', label: 'Campaigns', icon: Layers3 },
];

function formatRelativeDate(value: string | null) {
  if (!value) return 'No activity yet';
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return 'Updated just now';
  if (minutes < 60) return `Updated ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Updated ${hours}h ago`;
  return `Updated ${Math.floor(hours / 24)}d ago`;
}

export default function DashboardTabs({ data }: { data: DashboardData }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const handleLogout = async () => {
    await createClient().auth.signOut();
    router.replace('/login');
    router.refresh();
  };

  const contactRate = data.leadStats.total > 0 ? Math.round((data.leadStats.contacted / data.leadStats.total) * 100) : 0;
  const replyRate = data.outreachStats.sent > 0 ? Math.round((data.leadStats.replied / data.outreachStats.sent) * 100) : 0;
  const activeCampaigns = data.jobs.filter((job) => job.status === 'scraping').length;

  return (
    <div className="min-h-screen bg-[#080a10] text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside className={`${mobileNavOpen ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-white/[0.07] bg-[#0b0e14] p-5 transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0`}>
          <div className="flex items-center justify-between px-2">
            <Link href="/dashboard" className="flex items-center gap-3" aria-label="LeadFlow home">
              <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-indigo-400 to-violet-600 shadow-lg shadow-indigo-500/20"><Sparkles className="size-5 text-white" /></span>
              <span><span className="block text-lg font-bold tracking-tight text-white">LeadFlow</span><span className="block text-[10px] font-semibold uppercase tracking-[0.24em] text-indigo-300/70">AI revenue engine</span></span>
            </Link>
            <button onClick={() => setMobileNavOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-white/5 lg:hidden" aria-label="Close navigation"><X className="size-5" /></button>
          </div>

          <nav className="mt-10 space-y-1" aria-label="Workspace navigation">
            <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600">Workspace</p>
            {tabs.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => { setActiveTab(id); setMobileNavOpen(false); }} className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${activeTab === id ? 'bg-indigo-400/10 text-indigo-200 ring-1 ring-inset ring-indigo-400/15' : 'text-slate-400 hover:bg-white/[0.04] hover:text-white'}`}>
                <Icon className={`size-[18px] ${activeTab === id ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
                {label}
                {id === 'inbox' && data.outreach.length > 0 && <span className="ml-auto rounded-md bg-white/[0.06] px-2 py-0.5 text-[10px] text-slate-400">{data.outreach.length}</span>}
              </button>
            ))}
            <p className="px-3 pb-2 pt-7 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600">Automation</p>
            <Link href="/dashboard/settings" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-white/[0.04] hover:text-white"><Target className="size-[18px] text-slate-500" /> Search targets</Link>
            <Link href="/dashboard/api-keys" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-white/[0.04] hover:text-white"><KeyRound className="size-[18px] text-slate-500" /> Integrations</Link>
          </nav>

          <div className="mt-auto space-y-4">
            <div className="rounded-2xl border border-emerald-300/10 bg-emerald-300/[0.04] p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300"><span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" /><span className="relative inline-flex size-2 rounded-full bg-emerald-400" /></span>Automation online</div>
              <p className="mt-2 text-xs leading-5 text-slate-500">Lead discovery and outreach queues are monitored continuously.</p>
            </div>
            <button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 hover:bg-white/[0.04] hover:text-slate-200"><LogOut className="size-[18px]" /> Sign out</button>
          </div>
        </aside>

        {mobileNavOpen && <button className="fixed inset-0 z-30 bg-black/70 backdrop-blur-sm lg:hidden" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation overlay" />}

        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-10 lg:py-8">
          <header className="mb-8 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button onClick={() => setMobileNavOpen(true)} className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-slate-300 lg:hidden" aria-label="Open navigation"><Menu className="size-5" /></button>
              <div><p className="text-xs font-medium text-slate-500">Revenue workspace</p><h1 className="mt-0.5 text-xl font-semibold tracking-tight text-white sm:text-2xl">{tabs.find((tab) => tab.id === activeTab)?.label}</h1></div>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden items-center gap-2 text-xs text-slate-500 sm:flex"><Clock3 className="size-3.5" />{formatRelativeDate(data.lastActivityAt)}</span>
              <button onClick={() => setActiveTab('campaigns')} className="inline-flex items-center gap-2 rounded-xl bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-950 shadow-lg shadow-white/5 hover:bg-slate-200 sm:text-sm"><Search className="size-4" /> Find leads</button>
            </div>
          </header>

          {activeTab === 'overview' && (
            <div className="space-y-5">
              <section className="relative overflow-hidden rounded-3xl border border-indigo-300/10 bg-[linear-gradient(115deg,rgba(99,102,241,.16),rgba(17,20,28,.72)_48%,rgba(34,211,238,.07))] p-6 sm:p-8">
                <div className="pointer-events-none absolute -right-20 -top-28 size-72 rounded-full bg-indigo-500/10 blur-3xl" />
                <div className="relative flex flex-col justify-between gap-6 xl:flex-row xl:items-end">
                  <div className="max-w-2xl"><div className="inline-flex items-center gap-2 rounded-full border border-indigo-300/15 bg-indigo-300/[0.06] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-200"><Bolt className="size-3" /> Pipeline intelligence</div><h2 className="mt-5 text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl">Your outbound engine, at a glance.</h2><p className="mt-3 max-w-xl text-sm leading-6 text-slate-400 sm:text-base">LeadFlow discovers prospects, scores intent, and moves qualified opportunities into personalized outreach.</p></div>
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
                      return <div key={stage.label}><div className="mb-2 flex items-center justify-between text-sm"><span className="text-slate-400">{index + 1}. {stage.label}</span><span className="font-semibold tabular-nums text-white">{stage.value}</span></div><div className="h-2 overflow-hidden rounded-full bg-white/[0.05]"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${width}%`, backgroundColor: stage.tone }} /></div></div>;
                    })}
                  </div>
                  <div className="mt-7 grid grid-cols-3 gap-2 border-t border-white/[0.06] pt-5"><QueueStat label="Queued" value={data.outreachStats.pending} tone="text-amber-300" /><QueueStat label="Failed" value={data.outreachStats.failed} tone="text-rose-300" /><QueueStat label="Active jobs" value={activeCampaigns} tone="text-cyan-300" /></div>
                </Panel>
              </section>

              <section className="rounded-2xl border border-white/[0.07] bg-[#10131a] p-5 sm:p-6">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><p className="text-sm font-semibold text-white">Recent campaigns</p><p className="mt-1 text-xs text-slate-500">The latest discovery runs across your workspace.</p></div><button onClick={() => setActiveTab('campaigns')} className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-300 hover:text-indigo-200">View all campaigns <ArrowUpRight className="size-3.5" /></button></div>
                <div className="mt-5 divide-y divide-white/[0.06]">
                  {data.jobs.slice(0, 4).map((job) => <Link key={job.id} href={`/dashboard/job/${job.id}`} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/[0.04] text-slate-400"><Search className="size-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium capitalize text-slate-200">{job.category}</span><span className="mt-0.5 block truncate text-xs capitalize text-slate-500">{job.location}</span></span><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${job.status === 'completed' ? 'bg-emerald-300/10 text-emerald-300' : job.status === 'scraping' ? 'bg-amber-300/10 text-amber-300' : 'bg-rose-300/10 text-rose-300'}`}>{job.status}</span><span className="hidden w-20 text-right text-xs text-slate-500 sm:block">{job.results_count || 0} leads</span></Link>)}
                  {data.jobs.length === 0 && <div className="py-9 text-center text-sm text-slate-500">No campaign activity yet. Start your first lead search.</div>}
                </div>
              </section>
            </div>
          )}

          {activeTab === 'inbox' && <SentInbox outreach={data.outreach} />}
          {activeTab === 'campaigns' && <BatchListClient jobs={data.jobs} />}
        </main>
      </div>
    </div>
  );
}

function QuickStat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="min-w-32 rounded-2xl border border-white/[0.08] bg-black/20 px-4 py-3 backdrop-blur"><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 text-xl font-semibold text-white">{value}</p><p className="mt-0.5 text-[11px] text-slate-500">{detail}</p></div>;
}

function Metric({ icon: Icon, label, value, detail, accent }: { icon: typeof Users; label: string; value: number; detail: string; accent: 'indigo' | 'violet' | 'cyan' | 'emerald' }) {
  const colors = { indigo: 'bg-indigo-400/10 text-indigo-300', violet: 'bg-violet-400/10 text-violet-300', cyan: 'bg-cyan-400/10 text-cyan-300', emerald: 'bg-emerald-400/10 text-emerald-300' };
  return <div className="rounded-2xl border border-white/[0.07] bg-[#10131a] p-5 shadow-[0_16px_50px_rgba(0,0,0,.14)]"><div className="flex items-start justify-between"><div><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-3 text-3xl font-semibold tracking-tight text-white tabular-nums">{value.toLocaleString()}</p></div><span className={`grid size-10 place-items-center rounded-xl ${colors[accent]}`}><Icon className="size-[18px]" /></span></div><p className="mt-4 text-xs text-slate-600">{detail}</p></div>;
}

function Panel({ title, eyebrow, icon: Icon, children }: { title: string; eyebrow: string; icon: typeof Activity; children: React.ReactNode }) {
  return <div className="rounded-2xl border border-white/[0.07] bg-[#10131a] p-5 sm:p-6"><div className="mb-6 flex items-center justify-between"><div><p className="text-sm font-semibold text-white">{title}</p><p className="mt-1 text-xs text-slate-500">{eyebrow}</p></div><span className="grid size-9 place-items-center rounded-xl border border-white/[0.06] bg-white/[0.03] text-slate-500"><Icon className="size-4" /></span></div>{children}</div>;
}

function QueueStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return <div><p className={`text-lg font-semibold tabular-nums ${tone}`}>{value}</p><p className="mt-0.5 text-[10px] uppercase tracking-wider text-slate-600">{label}</p></div>;
}
