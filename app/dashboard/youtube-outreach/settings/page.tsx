import Link from 'next/link';
import { Database, KeyRound, MailCheck, ShieldCheck } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';

const controls = [
  { icon: Database, title: 'Dedicated data boundary', detail: 'Creators, campaigns, notes, events, and queue records use YouTube-specific tables.' },
  { icon: MailCheck, title: 'Public email only', detail: 'A business email cannot be stored without recording its public source.' },
  { icon: ShieldCheck, title: 'Paused by default', detail: 'Campaign and queue defaults prevent accidental discovery or sending.' },
];

export default function YouTubeSettingsPage() {
  return <><PageHeader eyebrow="YouTube Outreach" title="Tool settings" description="Review module-specific policy. Provider credentials remain in shared platform integrations." /><div className="grid gap-4 lg:grid-cols-3">{controls.map(({ icon: Icon, title, detail }) => <div key={title} className="rounded-2xl border border-white/[0.07] bg-[#10131a] p-5"><span className="grid size-10 place-items-center rounded-xl bg-rose-400/10 text-rose-300"><Icon className="size-4" /></span><h2 className="mt-5 text-sm font-semibold text-white">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{detail}</p></div>)}</div><Link href="/dashboard/integrations" className="mt-6 inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/[0.06]"><KeyRound className="size-4" /> Open shared integrations</Link></>;
}
