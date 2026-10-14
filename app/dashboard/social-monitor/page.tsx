import SocialMonitorWorkspace from '@/components/tools/social-monitor/SocialMonitorWorkspace';
import { getSocialMonitorData } from '@/lib/tools/social-monitor/service';
import { redditConfigured, telegramConfigured, xConfigured } from '@/lib/tools/social-monitor/providers';

export default async function SocialMonitorPage() {
  const data = await getSocialMonitorData();
  return <SocialMonitorWorkspace {...data} readiness={{ reddit: redditConfigured(), x: xConfigured(), telegram: telegramConfigured(), gemini: Boolean(process.env.GEMINI_API_KEY) }} />;
}

export const dynamic = 'force-dynamic';
