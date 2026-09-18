import { afterEach, describe, expect, it, vi } from 'vitest';
import { apifyTokens, fetchApify } from '../lib/apify';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const url = 'https://api.apify.com/v2/acts/example/runs';

describe('Apify fallback', () => {
  it('retries credit exhaustion using header authentication', async () => {
    const request = vi.fn().mockResolvedValueOnce(Response.json({ error: { type: 'actor-start-credit-limit-exceeded' } }, { status: 403 })).mockResolvedValueOnce(Response.json({ data: { id: 'run' } }, { status: 201 }));
    vi.stubGlobal('fetch', request);
    const response = await fetchApify(url, { method: 'POST', body: '{}' }, ['primary', 'secondary']);
    expect(response.status).toBe(201);
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls.map(call => call[1].headers.get('Authorization'))).toEqual(['Bearer primary', 'Bearer secondary']);
    expect(String(request.mock.calls[0][0])).not.toContain('token=');
  });

  it.each([402, 429])('falls back on limit status %s', async status => {
    const request = vi.fn().mockResolvedValueOnce(new Response(null, { status })).mockResolvedValueOnce(new Response(null, { status: 201 }));
    vi.stubGlobal('fetch', request);
    expect((await fetchApify(url, { method: 'POST' }, ['primary', 'secondary'])).status).toBe(201);
  });

  it.each([400, 401, 403, 500])('does not repeat ambiguous or unrelated run failures (%s)', async status => {
    const request = vi.fn().mockResolvedValue(new Response(null, { status }));
    vi.stubGlobal('fetch', request);
    expect((await fetchApify(url, { method: 'POST' }, ['primary', 'secondary'])).status).toBe(status);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('does not retry a network timeout', async () => {
    const request = vi.fn().mockRejectedValue(new Error('timeout'));
    vi.stubGlobal('fetch', request);
    await expect(fetchApify(url, { method: 'POST' }, ['primary', 'secondary'])).rejects.toThrow('timeout');
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('uses the fallback account to read its private dataset', async () => {
    const request = vi.fn().mockResolvedValueOnce(new Response(null, { status: 404 })).mockResolvedValueOnce(Response.json([]));
    vi.stubGlobal('fetch', request);
    expect((await fetchApify('https://api.apify.com/v2/datasets/example/items', {}, ['primary', 'secondary'])).ok).toBe(true);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('prefers workspace credentials and deduplicates the secondary token', () => {
    vi.stubEnv('APIFY_TOKEN', 'platform');
    vi.stubEnv('APIFY_FALLBACK_TOKEN', 'secondary');
    expect(apifyTokens('workspace')).toEqual(['workspace', 'secondary']);
    expect(apifyTokens('secondary')).toEqual(['secondary']);
  });
});
