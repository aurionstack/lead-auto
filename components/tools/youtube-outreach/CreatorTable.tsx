import { ExternalLink, Video as Youtube } from 'lucide-react';
import type { YouTubeCreator } from '@/lib/tools/youtube-outreach/types';

export default function CreatorTable({ creators, emptyMessage = 'No creators have been added to this pipeline yet.' }: { creators: YouTubeCreator[]; emptyMessage?: string }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/[0.07] bg-[#10131a]">
      <table className="w-full min-w-[780px] text-left text-sm">
        <thead className="border-b border-white/[0.06] bg-white/[0.02] text-xs text-slate-500"><tr><th className="px-5 py-4 font-medium">Creator</th><th className="px-5 py-4 font-medium">Subscribers</th><th className="px-5 py-4 font-medium">Market</th><th className="px-5 py-4 font-medium">Opportunity</th><th className="px-5 py-4 font-medium">Status</th><th className="px-5 py-4 font-medium">Business email</th></tr></thead>
        <tbody className="divide-y divide-white/[0.05]">
          {creators.map((creator) => <tr key={creator.id} className="hover:bg-white/[0.02]"><td className="px-5 py-4"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-rose-400/10 text-rose-300"><Youtube className="size-4" /></span><div><a href={creator.channel_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-medium text-slate-200 hover:text-white">{creator.channel_name}<ExternalLink className="size-3" /></a><p className="mt-0.5 text-xs text-slate-600">{creator.handle ?? creator.channel_id}</p></div></div></td><td className="px-5 py-4 tabular-nums text-slate-300">{creator.subscriber_count?.toLocaleString() ?? '—'}</td><td className="px-5 py-4 text-slate-400">{[creator.country, creator.language].filter(Boolean).join(' · ') || '—'}</td><td className="px-5 py-4"><span className="font-semibold text-white">{creator.opportunity_score ?? '—'}</span></td><td className="px-5 py-4"><span className="rounded-full bg-white/[0.05] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{creator.status.replaceAll('_', ' ')}</span></td><td className="px-5 py-4 text-slate-400">{creator.business_email ?? 'Not sourced'}{creator.email_source && <p className="mt-0.5 text-[10px] text-slate-600">Source: {creator.email_source}</p>}</td></tr>)}
          {creators.length === 0 && <tr><td colSpan={6} className="px-5 py-14 text-center text-slate-600">{emptyMessage}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
