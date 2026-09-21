import { findEmailWithRegex } from '@/lib/email-parser';

type SearchItem = { snippet?: { channelId?: string } };
type ChannelItem = {
  id?: string;
  snippet?: { title?: string; description?: string; customUrl?: string; country?: string; defaultLanguage?: string };
  statistics?: { subscriberCount?: string };
  contentDetails?: { relatedPlaylists?: { uploads?: string } };
  brandingSettings?: { channel?: { description?: string; country?: string } };
};
type PlaylistItem = { snippet?: { title?: string; resourceId?: { videoId?: string } } };
type VideoItem = { id?: string; contentDetails?: { duration?: string } };

const countryNames: Record<string, string> = { US: 'United States', GB: 'United Kingdom', CA: 'Canada', AU: 'Australia' };
const languageNames: Record<string, string> = { en: 'English', 'en-US': 'English', 'en-GB': 'English' };

function apiKey() {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error('YOUTUBE_API_KEY is not configured');
  return key;
}

async function youtubeJson<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${path}`);
  for (const [key, value] of Object.entries({ ...params, key: apiKey() })) url.searchParams.set(key, value);
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`YouTube API ${path} failed (${response.status})`);
  return response.json() as Promise<T>;
}

function seconds(duration?: string) {
  if (!duration) return 0;
  const match = duration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return 0;
  return Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0);
}

export interface DiscoveredYouTubeCreator {
  channelId: string;
  handle: string | null;
  channelName: string;
  channelUrl: string;
  subscriberCount: number | null;
  country: string | null;
  language: string | null;
  businessEmail: string | null;
  emailSource: string | null;
  longFormScore: number;
  shortsUsageScore: number;
  opportunityScore: number;
  qualificationReason: string;
  latestVideoTitle: string | null;
  latestVideoUrl: string | null;
}

export async function discoverYouTubeCreators(query: string, limit: number): Promise<DiscoveredYouTubeCreator[]> {
  const search = await youtubeJson<{ items?: SearchItem[] }>('search', {
    part: 'snippet', type: 'channel', q: query, maxResults: String(Math.max(1, Math.min(limit, 50))), relevanceLanguage: 'en', safeSearch: 'moderate',
  });
  const channelIds = [...new Set((search.items || []).map((item) => item.snippet?.channelId).filter((id): id is string => Boolean(id)))];
  if (!channelIds.length) return [];
  const channels = await youtubeJson<{ items?: ChannelItem[] }>('channels', {
    part: 'snippet,statistics,contentDetails,brandingSettings', id: channelIds.join(','), maxResults: '50',
  });

  const results: DiscoveredYouTubeCreator[] = [];
  for (const channel of channels.items || []) {
    if (!channel.id || !channel.snippet?.title) continue;
    const uploads = channel.contentDetails?.relatedPlaylists?.uploads;
    let playlistItems: PlaylistItem[] = [];
    let videoItems: VideoItem[] = [];
    if (uploads) {
      const playlist = await youtubeJson<{ items?: PlaylistItem[] }>('playlistItems', { part: 'snippet', playlistId: uploads, maxResults: '8' });
      playlistItems = playlist.items || [];
      const videoIds = playlistItems.map((item) => item.snippet?.resourceId?.videoId).filter((id): id is string => Boolean(id));
      if (videoIds.length) {
        const videos = await youtubeJson<{ items?: VideoItem[] }>('videos', { part: 'contentDetails', id: videoIds.join(',') });
        videoItems = videos.items || [];
      }
    }
    const durations = videoItems.map((video) => seconds(video.contentDetails?.duration));
    const longFormCount = durations.filter((value) => value > 180).length;
    const shortsCount = durations.filter((value) => value > 0 && value <= 180).length;
    const longFormScore = Math.min(100, Math.round((longFormCount / 3) * 100));
    const shortsUsageScore = durations.length ? Math.round((1 - shortsCount / durations.length) * 100) : 50;
    const description = channel.snippet.description || channel.brandingSettings?.channel?.description || '';
    const publicEmail = findEmailWithRegex(description)[0]?.email || null;
    const subscriberCount = channel.statistics?.subscriberCount ? Number(channel.statistics.subscriberCount) : null;
    const channelUrl = `https://www.youtube.com/channel/${channel.id}`;
    const countryCode = channel.snippet.country || channel.brandingSettings?.channel?.country;
    const opportunityScore = Math.round(
      (subscriberCount ? 30 : 10) + longFormScore * 0.4 + shortsUsageScore * 0.3,
    );
    const latest = playlistItems[0]?.snippet;
    results.push({
      channelId: channel.id,
      handle: channel.snippet.customUrl || null,
      channelName: channel.snippet.title,
      channelUrl,
      subscriberCount: Number.isFinite(subscriberCount) ? subscriberCount : null,
      country: countryCode ? countryNames[countryCode] || countryCode : null,
      language: channel.snippet.defaultLanguage ? languageNames[channel.snippet.defaultLanguage] || channel.snippet.defaultLanguage : 'English',
      businessEmail: publicEmail,
      emailSource: publicEmail ? `Public YouTube channel description: ${channelUrl}` : null,
      longFormScore,
      shortsUsageScore,
      opportunityScore: Math.min(100, opportunityScore),
      qualificationReason: `${longFormCount} long-form and ${shortsCount} short-form uploads found in the latest ${durations.length}; ${publicEmail ? 'public business email found' : 'no public business email found'}.`,
      latestVideoTitle: latest?.title || null,
      latestVideoUrl: latest?.resourceId?.videoId ? `https://www.youtube.com/watch?v=${latest.resourceId.videoId}` : null,
    });
  }
  return results;
}
