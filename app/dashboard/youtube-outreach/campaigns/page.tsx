import PageHeader from '@/components/shared/PageHeader';
import { getYouTubeCampaign } from '@/lib/tools/youtube-outreach/service';

export default async function YouTubeCampaignsPage() {
  const { campaign, databaseReady } = await getYouTubeCampaign();
  return <><PageHeader eyebrow="YouTube Outreach" title="Campaigns" description="Define creator acquisition segments independently from Lead Recovery campaigns." /><div className="rounded-2xl border border-white/[0.07] bg-[#10131a] p-6"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><h2 className="text-lg font-semibold text-white">{campaign.name}</h2><p className="mt-2 text-sm text-slate-500">{campaign.niches.join(' · ')}</p></div><span className={`w-fit rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${campaign.status === 'active' ? 'bg-emerald-300/10 text-emerald-300' : 'bg-amber-300/10 text-amber-300'}`}>{campaign.status}</span></div><dl className="mt-7 grid gap-4 border-t border-white/[0.06] pt-6 sm:grid-cols-2 lg:grid-cols-4"><Item label="Subscriber range" value={`${campaign.subscriber_min.toLocaleString()}–${campaign.subscriber_max.toLocaleString()}`} /><Item label="Countries" value={campaign.countries.join(', ')} /><Item label="Languages" value={campaign.languages.join(', ')} /><Item label="Shorts rule" value={campaign.shorts_usage_rule} /></dl>{!databaseReady && <p className="mt-6 text-xs text-amber-300">Preview defaults only—apply migration 010 to save this campaign.</p>}</div></>;
}
function Item({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs text-slate-600">{label}</dt><dd className="mt-1 text-sm font-medium text-slate-300">{value}</dd></div>; }
export const dynamic = 'force-dynamic';
