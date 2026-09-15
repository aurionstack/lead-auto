import CreatorTable from '@/components/tools/youtube-outreach/CreatorTable';
import PageHeader from '@/components/shared/PageHeader';
import { getYouTubeCreators } from '@/lib/tools/youtube-outreach/service';

export default async function YouTubeRepliesPage() {
  const { creators } = await getYouTubeCreators(['replied', 'positive_reply', 'sample_requested', 'sample_sent', 'client']);
  return <><PageHeader eyebrow="YouTube Outreach" title="Replies" description="Review creator responses and progress qualified conversations toward samples and clients." /><CreatorTable creators={creators} emptyMessage="No creator replies yet. Outreach is paused." /></>;
}
export const dynamic = 'force-dynamic';
