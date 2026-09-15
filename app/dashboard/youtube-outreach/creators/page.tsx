import CreatorTable from '@/components/tools/youtube-outreach/CreatorTable';
import PageHeader from '@/components/shared/PageHeader';
import { getYouTubeCreators } from '@/lib/tools/youtube-outreach/service';

export default async function YouTubeCreatorsPage() {
  const { creators, databaseReady } = await getYouTubeCreators();
  return <><PageHeader eyebrow="YouTube Outreach" title="Creators" description="A dedicated creator prospect model with channel-level deduplication and public business-email provenance." />{!databaseReady && <SetupNotice />}<CreatorTable creators={creators} /></>;
}
function SetupNotice() { return <div className="mb-5 rounded-xl border border-amber-300/15 bg-amber-300/[0.05] px-4 py-3 text-sm text-amber-200">Apply migration 010 before importing creator records.</div>; }
export const dynamic = 'force-dynamic';
