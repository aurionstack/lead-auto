import YouTubeOverview from '@/components/tools/youtube-outreach/YouTubeOverview';
import { getYouTubeDashboardData } from '@/lib/tools/youtube-outreach/service';

export default async function YouTubeOutreachPage() {
  return <YouTubeOverview data={await getYouTubeDashboardData()} />;
}
export const dynamic = 'force-dynamic';
