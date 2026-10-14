import { afterEach, describe, expect, it, vi } from 'vitest';
import { discoverYouTubeCreators } from '../lib/tools/youtube-outreach/youtube';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('YouTube discovery resilience', () => {
  it('continues to the next channel when an uploads playlist no longer exists', async () => {
    vi.stubEnv('YOUTUBE_API_KEY', 'test-key');
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/search')) return json({ items: [
        { snippet: { channelId: 'channel-a' } }, { snippet: { channelId: 'channel-b' } },
      ] });
      if (url.pathname.endsWith('/channels')) return json({ items: [
        { id: 'channel-a', snippet: { title: 'A' }, contentDetails: { relatedPlaylists: { uploads: 'missing' } } },
        { id: 'channel-b', snippet: { title: 'B' }, contentDetails: { relatedPlaylists: { uploads: 'available' } } },
      ] });
      if (url.pathname.endsWith('/playlistItems') && url.searchParams.get('playlistId') === 'missing') {
        return json({ error: { errors: [{ reason: 'playlistNotFound' }] } }, 404);
      }
      if (url.pathname.endsWith('/playlistItems')) return json({ items: [{ snippet: { title: 'Video B', resourceId: { videoId: 'video-b' } } }] });
      if (url.pathname.endsWith('/videos')) return json({ items: [{ id: 'video-b', contentDetails: { duration: 'PT10M' } }] });
      throw new Error(`Unexpected request: ${url.pathname}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const creators = await discoverYouTubeCreators('test', 2);
    expect(creators.map((creator) => creator.channelName)).toEqual(['A', 'B']);
    expect(creators[0].longFormScore).toBe(0);
    expect(creators[1].latestVideoTitle).toBe('Video B');
  });

  it('still fails on authorization errors instead of concealing provider failures', async () => {
    vi.stubEnv('YOUTUBE_API_KEY', 'test-key');
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith('/search')) return json({ items: [{ snippet: { channelId: 'channel-a' } }] });
      if (path.endsWith('/channels')) return json({ items: [{ id: 'channel-a', snippet: { title: 'A' }, contentDetails: { relatedPlaylists: { uploads: 'restricted' } } }] });
      return json({ error: { errors: [{ reason: 'quotaExceeded' }] } }, 403);
    }));

    await expect(discoverYouTubeCreators('test', 1)).rejects.toThrow('playlistItems failed (403: quotaExceeded)');
  });
});
