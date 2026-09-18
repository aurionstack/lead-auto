// Shared server-side Apify transport. Never retry an ambiguous run-start failure.
export function apifyTokens(primary?: string | null): string[] {
  return [...new Set([primary || process.env.APIFY_TOKEN, process.env.APIFY_FALLBACK_TOKEN]
    .map(token => token?.trim()).filter((token): token is string => Boolean(token)))];
}

async function canUseFallback(response: Response, method: string): Promise<boolean> {
  if ([402, 429].includes(response.status)) return true;
  if (method === 'GET' && [401, 403, 404].includes(response.status)) return true;
  if (response.status !== 403) return false;
  const body = await response.clone().json().catch(() => null);
  const type = String(body?.error?.type || '').toLowerCase();
  return /(?:limit|quota|credit|insufficient-funds|payment)/.test(type);
}

export async function fetchApify(url: string, init: RequestInit, tokens: string[]): Promise<Response> {
  const target = new URL(url);
  if (target.origin !== 'https://api.apify.com' || target.searchParams.has('token')) {
    throw new Error('Apify requests must use the API origin and header authentication.');
  }
  if (!tokens.length) throw new Error('Apify credentials are not configured.');
  const method = (init.method || 'GET').toUpperCase();
  for (let index = 0; index < tokens.length; index++) {
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${tokens[index]}`);
    const response = await fetch(target, { ...init, headers, cache: 'no-store', signal: init.signal || AbortSignal.timeout(20000) });
    if (response.ok || index === tokens.length - 1 || !(await canUseFallback(response, method))) return response;
    console.warn(`[apify] Primary request rejected (${response.status}); trying fallback credentials.`);
    await response.body?.cancel();
  }
  throw new Error('No Apify response.');
}
