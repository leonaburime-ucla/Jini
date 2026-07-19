import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PendingAuthCache,
  buildAuthorizeUrl,
  deriveCodeChallenge,
  exchangeCodeForToken,
  generateCodeVerifier,
  generateState,
  refreshAccessToken,
  type PendingAuthState,
} from '../pkce.js';

describe('generateCodeVerifier / deriveCodeChallenge / generateState', () => {
  it('generates a base64url verifier of the expected length with no padding', () => {
    const verifier = generateCodeVerifier();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(verifier.length).toBeGreaterThan(40);
  });

  it('derives a deterministic S256 challenge for a given verifier', () => {
    const challenge1 = deriveCodeChallenge('fixed-verifier');
    const challenge2 = deriveCodeChallenge('fixed-verifier');
    expect(challenge1).toBe(challenge2);
    expect(challenge1).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('generates a base64url state value', () => {
    expect(generateState()).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('generates distinct verifiers/states across calls', () => {
    expect(generateCodeVerifier()).not.toBe(generateCodeVerifier());
    expect(generateState()).not.toBe(generateState());
  });
});

describe('buildAuthorizeUrl', () => {
  const authServer = {
    issuer: 'https://auth.example.com',
    authorization_endpoint: 'https://auth.example.com/authorize',
    token_endpoint: 'https://auth.example.com/token',
  };

  it('builds a url with the required PKCE params', () => {
    const url = buildAuthorizeUrl({
      authServer,
      clientId: 'client-1',
      redirectUri: 'http://127.0.0.1:5555/callback',
      state: 'state-1',
      codeChallenge: 'challenge-1',
    });
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe('https://auth.example.com/authorize');
    expect(parsed.searchParams.get('response_type')).toBe('code');
    expect(parsed.searchParams.get('client_id')).toBe('client-1');
    expect(parsed.searchParams.get('redirect_uri')).toBe('http://127.0.0.1:5555/callback');
    expect(parsed.searchParams.get('state')).toBe('state-1');
    expect(parsed.searchParams.get('code_challenge')).toBe('challenge-1');
    expect(parsed.searchParams.get('code_challenge_method')).toBe('S256');
    expect(parsed.searchParams.has('scope')).toBe(false);
    expect(parsed.searchParams.has('resource')).toBe(false);
  });

  it('includes scope and resource when supplied', () => {
    const url = buildAuthorizeUrl({
      authServer,
      clientId: 'client-1',
      redirectUri: 'http://127.0.0.1:5555/callback',
      state: 'state-1',
      codeChallenge: 'challenge-1',
      scope: 'a b',
      resource: 'https://api.example.com',
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get('scope')).toBe('a b');
    expect(parsed.searchParams.get('resource')).toBe('https://api.example.com');
  });
});

describe('exchangeCodeForToken / refreshAccessToken', () => {
  it('exchanges a code for a token via the correct grant_type and body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'at-1', token_type: 'Bearer', expires_in: 3600 }),
    });
    const result = await exchangeCodeForToken(
      {
        tokenEndpoint: 'https://auth.example.com/token',
        clientId: 'client-1',
        redirectUri: 'http://127.0.0.1:5555/callback',
        code: 'code-1',
        codeVerifier: 'verifier-1',
      },
      fetchMock,
    );
    expect(result.access_token).toBe('at-1');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://auth.example.com/token');
    const body = new URLSearchParams(init.body as string);
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code')).toBe('code-1');
    expect(body.get('code_verifier')).toBe('verifier-1');
    expect(init.headers['authorization']).toBeUndefined();
  });

  it('includes a resource indicator and confidential-client basic auth when supplied', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ access_token: 'at-2' }) });
    await exchangeCodeForToken(
      {
        tokenEndpoint: 'https://auth.example.com/token',
        clientId: 'client-1',
        clientSecret: 'secret-1',
        redirectUri: 'http://127.0.0.1:5555/callback',
        code: 'code-1',
        codeVerifier: 'verifier-1',
        resource: 'https://api.example.com',
      },
      fetchMock,
    );
    const [, init] = fetchMock.mock.calls[0]!;
    const body = new URLSearchParams(init.body as string);
    expect(body.get('resource')).toBe('https://api.example.com');
    expect(init.headers['authorization']).toBe(`Basic ${Buffer.from('client-1:secret-1').toString('base64')}`);
  });

  it('refreshes an access token via grant_type=refresh_token, including optional scope/resource', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ access_token: 'at-3' }) });
    await refreshAccessToken(
      {
        tokenEndpoint: 'https://auth.example.com/token',
        clientId: 'client-1',
        refreshToken: 'rt-1',
        scope: 'a b',
        resource: 'https://api.example.com',
      },
      fetchMock,
    );
    const [, init] = fetchMock.mock.calls[0]!;
    const body = new URLSearchParams(init.body as string);
    expect(body.get('grant_type')).toBe('refresh_token');
    expect(body.get('refresh_token')).toBe('rt-1');
    expect(body.get('scope')).toBe('a b');
    expect(body.get('resource')).toBe('https://api.example.com');
  });

  it('defaults fetchImpl to the global fetch when not supplied', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ access_token: 'at-4' }) });
    vi.stubGlobal('fetch', fetchMock);
    await exchangeCodeForToken({
      tokenEndpoint: 'https://auth.example.com/token',
      clientId: 'client-1',
      redirectUri: 'http://127.0.0.1:5555/callback',
      code: 'code-1',
      codeVerifier: 'verifier-1',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it('throws with the response status/text on a non-ok token response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      text: async () => 'invalid_grant',
    });
    await expect(
      exchangeCodeForToken(
        {
          tokenEndpoint: 'https://auth.example.com/token',
          clientId: 'client-1',
          redirectUri: 'http://127.0.0.1:5555/callback',
          code: 'bad-code',
          codeVerifier: 'verifier-1',
        },
        fetchMock,
      ),
    ).rejects.toThrow(/HTTP 400 Bad Request invalid_grant/);
  });

  it('handles a text() failure on a non-ok response gracefully', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      text: async () => {
        throw new Error('stream closed');
      },
    });
    await expect(
      exchangeCodeForToken(
        {
          tokenEndpoint: 'https://auth.example.com/token',
          clientId: 'client-1',
          redirectUri: 'http://127.0.0.1:5555/callback',
          code: 'x',
          codeVerifier: 'y',
        },
        fetchMock,
      ),
    ).rejects.toThrow(/HTTP 500 Server Error/);
  });

  it('throws when the token endpoint response has no access_token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ token_type: 'Bearer' }) });
    await expect(
      exchangeCodeForToken(
        {
          tokenEndpoint: 'https://auth.example.com/token',
          clientId: 'client-1',
          redirectUri: 'http://127.0.0.1:5555/callback',
          code: 'x',
          codeVerifier: 'y',
        },
        fetchMock,
      ),
    ).rejects.toThrow(/missing access_token/);
  });
});

describe('PendingAuthCache', () => {
  const state = (overrides: Partial<PendingAuthState> = {}): PendingAuthState => ({
    serverId: 'p1',
    authServerIssuer: 'https://auth.example.com',
    tokenEndpoint: 'https://auth.example.com/token',
    clientId: 'client-1',
    redirectUri: 'http://127.0.0.1:5555/callback',
    codeVerifier: 'verifier-1',
    createdAt: Date.now(),
    ...overrides,
  });

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stores and one-shot consumes a pending state', () => {
    const cache = new PendingAuthCache();
    cache.put('state-1', state());
    expect(cache.size()).toBe(1);
    expect(cache.consume('state-1')?.clientId).toBe('client-1');
    expect(cache.consume('state-1')).toBeNull();
    cache.stop();
  });

  it('returns null for an unknown state', () => {
    const cache = new PendingAuthCache();
    expect(cache.consume('nope')).toBeNull();
    cache.stop();
  });

  it('treats an entry older than the ttl as expired even if still present in the store', () => {
    // Jump the system clock without advancing timers, so the sweeper's own
    // interval never fires and doesn't delete the entry first — this
    // isolates consume()'s own TTL check (as opposed to the sweeper's).
    const start = Date.now();
    const cache = new PendingAuthCache(1000);
    cache.put('state-1', state({ createdAt: start }));
    vi.setSystemTime(start + 1001);
    expect(cache.consume('state-1')).toBeNull();
    cache.stop();
  });

  it('sweeps expired entries on its own timer and stops the sweeper once empty', () => {
    const cache = new PendingAuthCache(100);
    cache.put('state-1', state());
    expect(cache.size()).toBe(1);
    vi.advanceTimersByTime(60_000 + 1);
    expect(cache.size()).toBe(0);
  });

  it('does not restart an already-running sweeper on a second put', () => {
    const cache = new PendingAuthCache(10_000);
    cache.put('state-1', state());
    cache.put('state-2', state());
    expect(cache.size()).toBe(2);
    cache.stop();
  });

  it('stop() is idempotent and safe when never started', () => {
    const cache = new PendingAuthCache();
    expect(() => cache.stop()).not.toThrow();
    expect(() => cache.stop()).not.toThrow();
  });
});
