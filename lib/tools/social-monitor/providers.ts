import type { SourcePost } from './types';

async function responseJson<T>(response: Response, provider: string): Promise<T> {
  if (!response.ok) throw new Error(`${provider} API returned ${response.status}`);
  return response.json() as Promise<T>;
}

export function redditConfigured() {
  return Boolean(process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET && process.env.REDDIT_USER_AGENT);
}

export async function fetchRedditPosts(subreddits: string[]): Promise<SourcePost[]> {
  if (!redditConfigured()) throw new Error('Reddit client credentials and user agent are required');
  const clientId = process.env.REDDIT_CLIENT_ID!;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET!;
  const userAgent = process.env.REDDIT_USER_AGENT!;
  const tokenResponse = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'content-type': 'application/x-www-form-urlencoded',
      'user-agent': userAgent,
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store', signal: AbortSignal.timeout(10000),
  });
  const token = await responseJson<{ access_token?: string }>(tokenResponse, 'Reddit OAuth');
  if (!token.access_token) throw new Error('Reddit OAuth returned no access token');
  const results: SourcePost[] = [];
  for (const subreddit of subreddits.slice(0, 6)) {
    const url = new URL(`https://oauth.reddit.com/r/${encodeURIComponent(subreddit)}/new`);
    url.searchParams.set('limit', '25');
    const response = await fetch(url, {
      headers: { authorization: `Bearer ${token.access_token}`, 'user-agent': userAgent },
      cache: 'no-store', signal: AbortSignal.timeout(10000),
    });
    const listing = await responseJson<{ data?: { children?: Array<{ data?: {
      id?: string; title?: string; selftext?: string; author?: string; permalink?: string; created_utc?: number;
    } }> } }>(response, 'Reddit');
    for (const child of listing.data?.children || []) {
      const post = child.data;
      if (!post?.id || !post.title || !post.created_utc || !post.permalink?.startsWith('/r/')) continue;
      results.push({ platform: 'reddit', sourceId: post.id, sourceName: subreddit, authorName: post.author || null,
        title: post.title, body: post.selftext || '', url: `https://www.reddit.com${post.permalink}`,
        createdAt: new Date(post.created_utc * 1000).toISOString() });
    }
  }
  return results;
}

export function xConfigured() { return Boolean(process.env.X_BEARER_TOKEN); }

export async function fetchXPosts(query: string): Promise<SourcePost[]> {
  if (!xConfigured()) throw new Error('X bearer token is required');
  const url = new URL('https://api.x.com/2/tweets/search/recent');
  url.searchParams.set('query', `${query} -is:retweet`);
  url.searchParams.set('max_results', '10');
  url.searchParams.set('tweet.fields', 'created_at,author_id');
  url.searchParams.set('expansions', 'author_id');
  url.searchParams.set('user.fields', 'username');
  const response = await fetch(url, { headers: { authorization: `Bearer ${process.env.X_BEARER_TOKEN}` }, cache: 'no-store', signal: AbortSignal.timeout(10000) });
  const result = await responseJson<{ data?: Array<{ id?: string; text?: string; created_at?: string; author_id?: string }>; includes?: { users?: Array<{ id: string; username: string }> } }>(response, 'X');
  const users = new Map((result.includes?.users || []).map((user) => [user.id, user.username]));
  return (result.data || []).filter((post) => post.id && post.text && post.created_at).map((post) => {
    const author = users.get(post.author_id || '') || null;
    return { platform: 'x' as const, sourceId: post.id!, sourceName: 'X', authorName: author,
      title: post.text!.slice(0, 180), body: post.text!, url: author ? `https://x.com/${author}/status/${post.id}` : `https://x.com/i/web/status/${post.id}`,
      createdAt: post.created_at! };
  });
}

export function telegramConfigured() { return Boolean(process.env.TELEGRAM_BOT_TOKEN); }

export async function sendTelegramLeadAlert(chatId: string, post: { platform: string; source_name: string | null; title: string; post_url: string; score: number | null; category: string | null; budget: string | null; matched_reasons: string[]; draft_reply: string | null }) {
  if (!telegramConfigured()) throw new Error('Telegram bot token is required');
  const text = [
    `New ${post.platform === 'reddit' ? `Reddit r/${post.source_name}` : 'X'} opportunity · ${post.score ?? 0}/100`,
    `Category: ${post.category || 'Unknown'} · Budget: ${post.budget || 'Not stated'}`,
    `Post: ${post.title}`,
    `Why: ${post.matched_reasons.join('; ')}`,
    `Suggested reply (review before posting): ${post.draft_reply || 'No draft'}`,
    post.post_url,
  ].join('\n\n').slice(0, 4000);
  const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    cache: 'no-store', signal: AbortSignal.timeout(10000),
  });
  await responseJson(response, 'Telegram');
}
