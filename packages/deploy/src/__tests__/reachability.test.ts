import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkDeploymentUrl, normalizeDeploymentUrl, waitForReachableDeploymentUrl } from '../reachability.js';

function jsonResponse(status: number, headers: Record<string, string> = {}, body = ''): Response {
  return new Response(body, { status, headers });
}

describe('normalizeDeploymentUrl', () => {
  it('prefixes a bare hostname with https://', () => {
    expect(normalizeDeploymentUrl('my-site.vercel.app')).toBe('https://my-site.vercel.app');
  });

  it('leaves an already-absolute URL untouched', () => {
    expect(normalizeDeploymentUrl('http://my-site.vercel.app')).toBe('http://my-site.vercel.app');
  });

  it('returns an empty string for non-string or empty input', () => {
    expect(normalizeDeploymentUrl(undefined)).toBe('');
    expect(normalizeDeploymentUrl('   ')).toBe('');
    expect(normalizeDeploymentUrl(42)).toBe('');
  });
});

describe('checkDeploymentUrl', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports reachable:false without a network call when the URL is empty', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const result = await checkDeploymentUrl('');
    expect(result).toEqual({ reachable: false, statusMessage: 'Deployment URL is empty.' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('reports reachable:true on a 2xx HEAD response without falling back to GET', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse(200));
    vi.stubGlobal('fetch', fetchSpy);
    const result = await checkDeploymentUrl('https://site.example');
    expect(result).toEqual({ reachable: true, statusCode: 200 });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0]?.[1]?.method).toBe('HEAD');
  });

  it('falls back to GET when HEAD returns a client/method error', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(405))
      .mockResolvedValueOnce(jsonResponse(200));
    vi.stubGlobal('fetch', fetchSpy);
    const result = await checkDeploymentUrl('https://site.example');
    expect(result).toEqual({ reachable: true, statusCode: 200 });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy.mock.calls[1]?.[1]?.method).toBe('GET');
  });

  it('classifies a 401 as protected when the caller-supplied detector matches', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse(401, {}, 'Authentication Required'));
    vi.stubGlobal('fetch', fetchSpy);
    const result = await checkDeploymentUrl('https://site.example', {
      detectProtected: (_resp, body) => body.includes('Authentication Required'),
      protectedMessage: 'gated',
    });
    expect(result).toEqual({ reachable: false, status: 'protected', statusCode: 401, statusMessage: 'gated' });
  });

  it('folds a network error (e.g. connection refused) into reachable:false with a message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('fetch failed')),
    );
    const result = await checkDeploymentUrl('https://site.example');
    expect(result.reachable).toBe(false);
    expect(result.statusMessage).toContain('fetch failed');
  });
});

describe('waitForReachableDeploymentUrl', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns link-delayed immediately when no candidate URLs are given', async () => {
    const result = await waitForReachableDeploymentUrl([], { providerLabel: 'Test Provider' });
    expect(result.status).toBe('link-delayed');
    expect(result.url).toBe('');
    expect(result.statusMessage).toContain('Test Provider');
  });

  it('resolves ready as soon as a candidate is reachable, without waiting out the timeout', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200)));
    const result = await waitForReachableDeploymentUrl(['site.example'], { timeoutMs: 60_000, intervalMs: 5_000 });
    expect(result.status).toBe('ready');
    expect(result.url).toBe('https://site.example');
    expect(result.reachableAt).toBeTypeOf('number');
  });

  it('short-circuits to protected as soon as any candidate reports the auth wall', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(401, {}, 'Authentication Required')));
    const result = await waitForReachableDeploymentUrl(['site.example'], {
      timeoutMs: 60_000,
      intervalMs: 5_000,
      detectProtected: (_resp, body) => body.includes('Authentication Required'),
    });
    expect(result.status).toBe('protected');
  });

  it('reports link-delayed once the timeout budget elapses with no reachable/protected candidate', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    const result = await waitForReachableDeploymentUrl(['site.example'], { timeoutMs: 20, intervalMs: 10 });
    expect(result.status).toBe('link-delayed');
    expect(result.url).toBe('https://site.example');
  });

  it('de-duplicates candidate URLs so a repeated alias is not probed twice per sweep', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse(200));
    vi.stubGlobal('fetch', fetchSpy);
    await waitForReachableDeploymentUrl(['site.example', 'https://site.example', 'site.example'], {
      timeoutMs: 1_000,
      intervalMs: 100,
    });
    // Only one distinct candidate after normalization+dedup; the first sweep hits it once (HEAD) then resolves.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
