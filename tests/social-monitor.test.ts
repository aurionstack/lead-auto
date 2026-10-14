import { afterEach, describe, expect, it, vi } from 'vitest';
import { prefilterSocialPost } from '../lib/tools/social-monitor/filter';
import { fetchRedditPosts, fetchXPosts, sendTelegramLeadAlert } from '../lib/tools/social-monitor/providers';

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('social monitor buyer filter', () => {
  it('accepts a hiring request in a supported service', () => {
    expect(prefilterSocialPost('[Hiring] Need a Next.js developer', 'Budget: $500 for Stripe checkout')).toEqual({ category: 'Web Dev', keyword: 'next.js' });
  });
  it('rejects sellers even if the service and budget match', () => {
    expect(prefilterSocialPost('[For Hire] React developer', 'I can build your site for $500')).toBeNull();
  });
  it('rejects unrelated requests', () => {
    expect(prefilterSocialPost('Looking for an accountant', 'Need help with bookkeeping')).toBeNull();
  });
  it('detects video editing buyer intent', () => {
    expect(prefilterSocialPost('Looking for a video editor', 'Paying $150 per short')).toEqual({ category: 'Video Editing', keyword: 'video editor' });
  });
});

describe('social monitor providers', () => {
  it('uses Reddit OAuth and maps public submissions without posting', async () => {
    vi.stubEnv('REDDIT_CLIENT_ID', 'id'); vi.stubEnv('REDDIT_CLIENT_SECRET', 'secret'); vi.stubEnv('REDDIT_USER_AGENT', 'test-agent');
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      return new Response(JSON.stringify(url.includes('access_token') ? { access_token: 'test-token' } : { data: { children: [{ data: { id: 'abc', title: '[Hiring] React developer', selftext: 'Budget $500', author: 'buyer', permalink: '/r/forhire/comments/abc/', created_utc: 1780000000 } }] } }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const posts = await fetchRedditPosts(['forhire']);
    expect(posts).toHaveLength(1);
    expect(posts[0].platform).toBe('reddit');
    expect(posts[0].url).toBe('https://www.reddit.com/r/forhire/comments/abc/');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('maps X recent search and keeps Telegram as an internal alert only', async () => {
    vi.stubEnv('X_BEARER_TOKEN', 'test-token'); vi.stubEnv('TELEGRAM_BOT_TOKEN', 'test-bot');
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      return new Response(JSON.stringify(url.includes('/sendMessage') ? { ok: true } : { data: [{ id: '123', text: 'Looking for video editor', author_id: '42', created_at: '2026-10-01T00:00:00Z' }], includes: { users: [{ id: '42', username: 'buyer' }] } }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const posts = await fetchXPosts('looking for video editor');
    expect(posts[0].url).toBe('https://x.com/buyer/status/123');
    await sendTelegramLeadAlert('1234567', { platform: 'x', source_name: 'X', title: posts[0].title, post_url: posts[0].url, score: 85, category: 'Video Editing', budget: '$150', matched_reasons: ['Buyer request'], draft_reply: 'Draft only' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toContain('api.telegram.org');
  });
});
