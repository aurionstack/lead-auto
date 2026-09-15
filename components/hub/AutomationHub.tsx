import Link from 'next/link';
import { ArrowUpRight, Plus, Radar, ShieldCheck, Video as Youtube } from 'lucide-react';
import { automationTools, type AutomationTool } from '@/lib/tools/registry';
import BrandMark from '@/components/shared/BrandMark';
import LogoutButton from '@/components/shared/LogoutButton';

export interface HubSummary {
  prospects: number;
  replies: number;
  active: boolean;
  databaseReady?: boolean;
}

export default function AutomationHub({ summaries }: { summaries: Record<AutomationTool['id'], HubSummary> }) {
  return (
    <div className="min-h-screen bg-[#080a10] text-slate-100">
      <header className="border-b border-white/[0.06] bg-[#0b0e14]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8"><BrandMark /><LogoutButton compact /></div>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:py-14">
        <section className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-300/15 bg-indigo-300/[0.05] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-200"><ShieldCheck className="size-3.5" /> Shared, tenant-safe workspace</div>
          <h1 className="mt-5 text-3xl font-semibold tracking-[-0.035em] text-white sm:text-5xl">AurionStack Automations</h1>
          <p className="mt-4 text-base leading-7 text-slate-400 sm:text-lg">Operate your automation systems from one workspace. Each tool owns its workflow and data while authentication, integrations, and safety controls stay shared.</p>
        </section>

        <section className="mt-10 grid gap-5 lg:grid-cols-2" aria-label="Automation tools">
          {automationTools.map((tool) => <AutomationToolCard key={tool.id} tool={tool} summary={summaries[tool.id]} />)}
          <div className="flex min-h-72 flex-col justify-between rounded-3xl border border-dashed border-white/[0.10] bg-white/[0.015] p-6 sm:p-7">
            <span className="grid size-12 place-items-center rounded-2xl border border-white/[0.08] bg-white/[0.03] text-slate-500"><Plus className="size-5" /></span>
            <div><p className="text-lg font-semibold text-slate-300">New automation</p><p className="mt-2 max-w-sm text-sm leading-6 text-slate-600">New products plug into the typed registry and implement their own routes, services, and data model.</p></div>
            <p className="text-xs font-medium text-slate-600">Registry-driven architecture</p>
          </div>
        </section>

        <footer className="mt-10 flex flex-col gap-3 border-t border-white/[0.06] pt-6 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <p>Shared infrastructure: authentication, tenancy, integrations, notifications, and audit controls.</p>
          <Link href="/dashboard/integrations" className="font-semibold text-indigo-300 hover:text-indigo-200">Manage integrations →</Link>
        </footer>
      </main>
    </div>
  );
}

function AutomationToolCard({ tool, summary }: { tool: AutomationTool; summary: HubSummary }) {
  const Icon = tool.icon === 'youtube' ? Youtube : Radar;
  const accent = tool.accent === 'rose' ? 'bg-rose-400/10 text-rose-300 border-rose-300/15' : 'bg-indigo-400/10 text-indigo-300 border-indigo-300/15';
  const status = summary.active ? 'Active' : tool.id === 'youtube-outreach' ? 'Paused · setup' : 'Paused';
  return (
    <Link href={tool.route} className="group flex min-h-72 flex-col justify-between rounded-3xl border border-white/[0.07] bg-[#10131a] p-6 shadow-[0_20px_70px_rgba(0,0,0,.18)] hover:-translate-y-0.5 hover:border-white/[0.14] sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <span className={`grid size-12 place-items-center rounded-2xl border ${accent}`}><Icon className="size-5" /></span>
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${summary.active ? 'bg-emerald-300/10 text-emerald-300' : 'bg-amber-300/10 text-amber-300'}`}>{status}</span>
      </div>
      <div className="mt-8"><h2 className="text-xl font-semibold text-white">{tool.name}</h2><p className="mt-2 max-w-md text-sm leading-6 text-slate-500">{tool.description}</p></div>
      <div className="mt-8 flex items-end justify-between border-t border-white/[0.06] pt-5">
        <div className="flex gap-8"><ToolMetric label={tool.id === 'youtube-outreach' ? 'Creators' : 'Prospects'} value={summary.prospects} /><ToolMetric label="Replies" value={summary.replies} /></div>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-300 group-hover:text-indigo-200">Open tool <ArrowUpRight className="size-3.5" /></span>
      </div>
    </Link>
  );
}

function ToolMetric({ label, value }: { label: string; value: number }) {
  return <div><p className="text-xl font-semibold tabular-nums text-white">{value.toLocaleString()}</p><p className="mt-1 text-[10px] uppercase tracking-wider text-slate-600">{label}</p></div>;
}
