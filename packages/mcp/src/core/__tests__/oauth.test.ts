import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  generateCodeVerifier,
  deriveCodeChallenge,
  generateState,
  discoverProtectedResource,
  discoverAuthServer,
  registerClient,
  getOrRegisterClient,
  buildAuthorizeUrl,
  exchangeCodeForToken,
  refreshAccessToken,
  PendingAuthCache,
  beginAuth,
  type AuthorizationServerMetadata,
  type PendingAuthState,
} from '../oauth.js';

const tmpDirs: string[] = [];
function tmp(): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'jini-mcp-oauth-'));
  tmpDirs.push(d);
  return d;
}
afterEach(() => {
  for (const d of tmpDirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

const B64URL = /^[A-Za-z0-9_-]+$/;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}
function notFound(): Response {
  return new Response('missing', { status: 404, statusText: 'Not Found' });
}
type Route = (url: string, init?: RequestInit) => Response | Promise<Response>;
function makeFetch(route: Route): typeof fetch {
  return (async (input: string | URL, init?: RequestInit) => route(String(input), init)) as unknown as typeof fetch;
}

const AUTH_META: AuthorizationServerMetadata = {
  issuer: 'https://auth.example.com',
  authorization_endpoint: 'https://auth.example.com/authorize',
  token_endpoint: 'https://auth.example.com/token',
  registration_endpoint: 'https://auth.example.com/register',
  scopes_supported: ['s'],
};

// Same shape as AUTH_META, but issued at the MCP resource's own origin —
// used by beginAuth tests that exercise the "no protected-resource
// document, assume the resource origin IS the auth server" fallback. Since
// discoverAuthServer now enforces RFC 8414 §3.3 issuer matching, a fixture
// whose issuer doesn't match the origin actually queried would be rejected
// rather than resolved (see the `discoverAuthServer` "rejects ... issuer"
// test above), so those beginAuth fixtures must declare an issuer at the
// origin they're actually discovered against.
const AUTH_META_AT_MCP_ORIGIN: AuthorizationServerMetadata = {
  issuer: 'https://mcp.example.com',
  authorization_endpoint: 'https://mcp.example.com/authorize',
  token_endpoint: 'https://mcp.example.com/token',
  registration_endpoint: 'https://mcp.example.com/register',
  scopes_supported: ['s'],
};

describe('PKCE + state helpers', () => {
  it('generates a base64url verifier and a deterministic S256 challenge', () => {
    const v = generateCodeVerifier();
    expect(v).toMatch(B64URL);
    expect(deriveCodeChallenge(v)).toMatch(B64URL);
    expect(deriveCodeChallenge('abc')).toBe(deriveCodeChallenge('abc'));
    expect(deriveCodeChallenge('abc')).not.toBe(deriveCodeChallenge('abd'));
  });
  it('generates unique base64url state values', () => {
    const a = generateState();
    const b = generateState();
    expect(a).toMatch(B64URL);
    expect(a).not.toBe(b);
  });
});

describe('discoverProtectedResource', () => {
  it('returns null for an unparseable url', async () => {
    expect(await discoverProtectedResource('not a url', makeFetch(notFound))).toBeNull();
  });
  it('returns the path-suffixed well-known when present', async () => {
    const f = makeFetch((url) =>
      url.endsWith('/.well-known/oauth-protected-resource/mcp')
        ? jsonResponse({ resource: 'https://mcp.example.com/mcp' })
        : notFound(),
    );
    expect(await discoverProtectedResource('https://mcp.example.com/mcp', f)).toEqual({ resource: 'https://mcp.example.com/mcp' });
  });
  it('falls back to the root well-known (and tolerates a throwing fetch)', async () => {
    const f = makeFetch((url) => {
      if (url.endsWith('/.well-known/oauth-protected-resource/mcp')) throw new Error('network down');
      if (url.endsWith('/.well-known/oauth-protected-resource')) return jsonResponse({ resource: 'root' });
      return notFound();
    });
    expect(await discoverProtectedResource('https://mcp.example.com/mcp', f)).toEqual({ resource: 'root' });
  });
  it('returns null when nothing is published', async () => {
    expect(await discoverProtectedResource('https://mcp.example.com/mcp', makeFetch(notFound))).toBeNull();
  });
});

describe('discoverAuthServer', () => {
  it('returns null for an unparseable issuer', async () => {
    expect(await discoverAuthServer('not a url', makeFetch(notFound))).toBeNull();
  });
  it('returns metadata when the document omits issuer and its endpoints share the queried origin', async () => {
    const f = makeFetch((url) =>
      url === 'https://auth.example.com/.well-known/oauth-authorization-server'
        ? jsonResponse({
            authorization_endpoint: 'https://auth.example.com/authorize',
            token_endpoint: 'https://auth.example.com/token',
          })
        : notFound(),
    );
    const meta = await discoverAuthServer('https://auth.example.com', f);
    expect(meta?.issuer).toBe('https://auth.example.com');
    expect(meta?.authorization_endpoint).toBe('https://auth.example.com/authorize');
  });
  it('rejects a discovery document whose issuer does not match the queried issuer (RFC 8414 §3.3 / SEC-RB-001 / CR-005)', async () => {
    const f = makeFetch((url) =>
      url === 'https://auth.example.com/.well-known/oauth-authorization-server'
        ? jsonResponse({
            issuer: 'https://attacker.example.com',
            authorization_endpoint: 'https://attacker.example.com/authorize',
            token_endpoint: 'https://attacker.example.com/token',
          })
        : notFound(),
    );
    // Previously this mismatched issuer was silently trusted and returned;
    // it must now be rejected outright rather than adopted.
    expect(await discoverAuthServer('https://auth.example.com', f)).toBeNull();
  });
  it('rejects a discovery document whose endpoints live on a different origin than the queried issuer, even when the issuer field matches', async () => {
    const f = makeFetch((url) =>
      url === 'https://auth.example.com/.well-known/oauth-authorization-server'
        ? jsonResponse({
            issuer: 'https://auth.example.com',
            authorization_endpoint: 'https://attacker.example.com/authorize',
            token_endpoint: 'https://auth.example.com/token',
          })
        : notFound(),
    );
    expect(await discoverAuthServer('https://auth.example.com', f)).toBeNull();
  });
  it('rejects a registration_endpoint on a different origin than the queried issuer', async () => {
    const f = makeFetch((url) =>
      url === 'https://auth.example.com/.well-known/oauth-authorization-server'
        ? jsonResponse({
            authorization_endpoint: 'https://auth.example.com/authorize',
            token_endpoint: 'https://auth.example.com/token',
            registration_endpoint: 'https://attacker.example.com/register',
          })
        : notFound(),
    );
    expect(await discoverAuthServer('https://auth.example.com', f)).toBeNull();
  });
  it('skips docs missing endpoints and defaults the issuer to the queried url', async () => {
    const f = makeFetch((url) => {
      if (url === 'https://auth.example.com/.well-known/oauth-authorization-server') return jsonResponse({ nope: true });
      if (url === 'https://auth.example.com/.well-known/openid-configuration') {
        return jsonResponse({
          authorization_endpoint: 'https://auth.example.com/authorize',
          token_endpoint: 'https://auth.example.com/token',
        });
      }
      return notFound();
    });
    const meta = await discoverAuthServer('https://auth.example.com', f);
    expect(meta?.issuer).toBe('https://auth.example.com');
  });
  it('returns null when no discovery doc has endpoints', async () => {
    expect(await discoverAuthServer('https://auth.example.com', makeFetch(notFound))).toBeNull();
  });
});

describe('registerClient', () => {
  it('returns the issued client id and secret', async () => {
    const f = makeFetch(() => jsonResponse({ client_id: 'cid', client_secret: 'sec' }));
    expect(await registerClient('https://auth.example.com/register', 'https://cb', f)).toEqual({ clientId: 'cid', clientSecret: 'sec' });
  });
  it('omits the secret when none is issued', async () => {
    const f = makeFetch(() => jsonResponse({ client_id: 'cid' }));
    expect(await registerClient('https://auth.example.com/register', 'https://cb', f)).toEqual({ clientId: 'cid' });
  });
  it('throws on a non-2xx response (and tolerates a body whose text() throws)', async () => {
    const broken = {
      ok: false,
      status: 500,
      statusText: 'ISE',
      text: () => Promise.reject(new Error('no body')),
    } as unknown as Response;
    await expect(registerClient('https://auth.example.com/register', 'https://cb', makeFetch(() => broken))).rejects.toThrow(
      /dynamic client registration failed: HTTP 500/,
    );
  });
  it('throws when the response is missing a client_id', async () => {
    const f = makeFetch(() => jsonResponse({ nope: true }));
    await expect(registerClient('https://auth.example.com/register', 'https://cb', f)).rejects.toThrow(/missing client_id/);
  });
});

describe('getOrRegisterClient', () => {
  it('returns a cached client without registering', async () => {
    const dir = tmp();
    fs.writeFileSync(
      path.join(dir, 'mcp-oauth-clients.json'),
      JSON.stringify({
        clients: [
          null, // isRegisteredClient: !v
          'nope', // isRegisteredClient: typeof v !== 'object'
          {}, // missing authServerIssuer
          { authServerIssuer: 'x' }, // missing redirectUri
          { authServerIssuer: 'x', redirectUri: 'y' }, // missing clientId
          { authServerIssuer: 'https://auth.example.com', redirectUri: 'https://cb', clientId: 'cached' },
        ],
      }),
    );
    const f = vi.fn();
    const client = await getOrRegisterClient(dir, AUTH_META, 'https://cb', f as unknown as typeof fetch);
    expect(client.clientId).toBe('cached');
    expect(f).not.toHaveBeenCalled();
  });
  it('registers, caches, and keeps a secret when nothing is cached', async () => {
    const dir = tmp();
    const f = makeFetch(() => jsonResponse({ client_id: 'fresh', client_secret: 'shh' }));
    const client = await getOrRegisterClient(dir, AUTH_META, 'https://cb', f);
    expect(client).toMatchObject({ clientId: 'fresh', clientSecret: 'shh', authServerIssuer: 'https://auth.example.com' });
    const cached = JSON.parse(fs.readFileSync(path.join(dir, 'mcp-oauth-clients.json'), 'utf8'));
    expect(cached.clients[0].clientId).toBe('fresh');
  });
  it('registers without a secret and ignores an unparseable cache (non-array clients)', async () => {
    const dir = tmp();
    fs.writeFileSync(path.join(dir, 'mcp-oauth-clients.json'), JSON.stringify({ clients: 'nope' }));
    const f = makeFetch(() => jsonResponse({ client_id: 'fresh' }));
    const client = await getOrRegisterClient(dir, AUTH_META, 'https://cb', f);
    expect(client.clientId).toBe('fresh');
    expect(client).not.toHaveProperty('clientSecret');
  });
  it('throws when the auth server has no registration endpoint and nothing is cached', async () => {
    const noReg: AuthorizationServerMetadata = { ...AUTH_META };
    delete noReg.registration_endpoint;
    await expect(getOrRegisterClient(tmp(), noReg, 'https://cb', makeFetch(notFound))).rejects.toThrow(
      /does not advertise a registration_endpoint/,
    );
  });
  it('rethrows unexpected cache-read errors (EISDIR)', async () => {
    const dir = tmp();
    fs.mkdirSync(path.join(dir, 'mcp-oauth-clients.json'));
    await expect(getOrRegisterClient(dir, AUTH_META, 'https://cb', makeFetch(notFound))).rejects.toThrow();
  });
});

describe('buildAuthorizeUrl', () => {
  it('includes scope and resource when provided', () => {
    const url = new URL(
      buildAuthorizeUrl({
        authServer: AUTH_META,
        clientId: 'cid',
        redirectUri: 'https://cb',
        state: 'st',
        codeChallenge: 'cc',
        scope: 'read',
        resource: 'https://mcp.example.com',
      }),
    );
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('scope')).toBe('read');
    expect(url.searchParams.get('resource')).toBe('https://mcp.example.com');
  });
  it('omits scope and resource when absent', () => {
    const url = new URL(
      buildAuthorizeUrl({ authServer: AUTH_META, clientId: 'cid', redirectUri: 'https://cb', state: 'st', codeChallenge: 'cc' }),
    );
    expect(url.searchParams.has('scope')).toBe(false);
    expect(url.searchParams.has('resource')).toBe(false);
  });
});

describe('token endpoint exchanges', () => {
  it('exchanges a code (with resource) and uses HTTP Basic for confidential clients', async () => {
    let seen: { headers?: unknown; body?: unknown } = {};
    const f = makeFetch((_url, init) => {
      seen = { headers: init?.headers, body: init?.body };
      return jsonResponse({ access_token: 'AT', token_type: 'Bearer' });
    });
    const out = await exchangeCodeForToken(
      { tokenEndpoint: 'https://auth.example.com/token', clientId: 'cid', clientSecret: 'sec', redirectUri: 'https://cb', code: 'code', codeVerifier: 'ver', resource: 'https://mcp.example.com' },
      f,
    );
    expect(out.access_token).toBe('AT');
    const auth = (seen.headers as Record<string, string>).authorization;
    expect(auth).toMatch(/^Basic /);
    expect(String(seen.body)).toContain('resource=https');
  });
  it('exchanges a code without a resource and without client secret', async () => {
    let headers: Record<string, string> = {};
    const f = makeFetch((_url, init) => {
      headers = init?.headers as Record<string, string>;
      return jsonResponse({ access_token: 'AT' });
    });
    await exchangeCodeForToken({ tokenEndpoint: 'https://auth.example.com/token', clientId: 'cid', redirectUri: 'https://cb', code: 'code', codeVerifier: 'ver' }, f);
    expect(headers).not.toHaveProperty('authorization');
  });
  it('refreshes a token with scope + resource', async () => {
    let body = '';
    const f = makeFetch((_url, init) => {
      body = String(init?.body);
      return jsonResponse({ access_token: 'NEW' });
    });
    const out = await refreshAccessToken({ tokenEndpoint: 'https://auth.example.com/token', clientId: 'cid', refreshToken: 'rt', scope: 'read', resource: 'https://mcp.example.com' }, f);
    expect(out.access_token).toBe('NEW');
    expect(body).toContain('grant_type=refresh_token');
    expect(body).toContain('scope=read');
    expect(body).toContain('resource=https');
  });
  it('refreshes a token without scope or resource', async () => {
    const f = makeFetch(() => jsonResponse({ access_token: 'NEW' }));
    expect((await refreshAccessToken({ tokenEndpoint: 'https://auth.example.com/token', clientId: 'cid', refreshToken: 'rt' }, f)).access_token).toBe('NEW');
  });
  it('throws on a non-2xx token response', async () => {
    const f = makeFetch(() => new Response('denied', { status: 400, statusText: 'Bad Request' }));
    await expect(refreshAccessToken({ tokenEndpoint: 'https://auth.example.com/token', clientId: 'cid', refreshToken: 'rt' }, f)).rejects.toThrow(
      /token endpoint rejected request: HTTP 400/,
    );
  });
  it('throws when the token response lacks an access_token', async () => {
    const f = makeFetch(() => jsonResponse({ token_type: 'Bearer' }));
    await expect(refreshAccessToken({ tokenEndpoint: 'https://auth.example.com/token', clientId: 'cid', refreshToken: 'rt' }, f)).rejects.toThrow(
      /missing access_token/,
    );
  });
});

describe('PendingAuthCache', () => {
  function pending(createdAt: number): PendingAuthState {
    return {
      serverId: 's', authServerIssuer: 'i', tokenEndpoint: 't', clientId: 'c',
      redirectUri: 'r', codeVerifier: 'v', createdAt,
    };
  }

  it('stores, consumes once, and returns null for unknown or expired state', () => {
    const c = new PendingAuthCache(10_000);
    const v = pending(Date.now());
    c.put('st', v);
    c.put('st2', pending(Date.now())); // second put: sweeper already running
    expect(c.size()).toBe(2);
    expect(c.consume('st')).toEqual(v);
    expect(c.consume('st')).toBeNull(); // one-shot
    expect(c.consume('unknown')).toBeNull();
    c.stop();
    c.stop(); // idempotent: no timer to clear the second time
  });

  it('drops state that has aged past the ttl on consume', () => {
    const c = new PendingAuthCache(10);
    c.put('old', pending(Date.now() - 1000));
    expect(c.consume('old')).toBeNull();
    c.stop();
  });

  it('sweeps expired entries on its interval and stops itself once empty', () => {
    vi.useFakeTimers();
    try {
      const c = new PendingAuthCache(100);
      c.put('a', pending(Date.now()));
      vi.advanceTimersByTime(100); // sweep: age == ttl, not yet expired -> survives, timer stays
      expect(c.size()).toBe(1);
      vi.advanceTimersByTime(200); // sweep: expired -> removed, store empties -> timer cleared
      expect(c.size()).toBe(0);
      c.stop(); // timer already cleared
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('beginAuth', () => {
  function router(opts: { prm?: unknown; authDoc?: unknown; reg?: unknown }): Route {
    return (url) => {
      if (url.includes('oauth-protected-resource')) return opts.prm === undefined ? notFound() : jsonResponse(opts.prm);
      if (url.includes('oauth-authorization-server') || url.includes('openid-configuration')) {
        return opts.authDoc === undefined ? notFound() : jsonResponse(opts.authDoc);
      }
      if (url.endsWith('/register')) return jsonResponse(opts.reg ?? { client_id: 'cid' });
      return notFound();
    };
  }

  it('runs discovery -> DCR -> PKCE using the protected-resource hints', async () => {
    const f = makeFetch(
      router({
        prm: { authorization_servers: ['https://auth.example.com'], resource: 'https://res.example.com', scopes_supported: ['a', 'b'] },
        authDoc: AUTH_META,
        reg: { client_id: 'cid', client_secret: 'sec' },
      }),
    );
    const out = await beginAuth({ serverId: 's1', serverUrl: 'https://mcp.example.com/mcp', redirectUri: 'https://cb', dataDir: tmp(), fetchImpl: f });
    const url = new URL(out.authorizeUrl);
    expect(url.searchParams.get('scope')).toBe('a b'); // from prm.scopes_supported
    expect(url.searchParams.get('resource')).toBe('https://res.example.com');
    expect(out.pending).toMatchObject({ serverId: 's1', clientSecret: 'sec', scope: 'a b', resourceUrl: 'https://res.example.com' });
    expect(out.state).toMatch(B64URL);
  });

  it('falls back to the origin issuer + server url when no protected-resource doc exists', async () => {
    const f = makeFetch(router({ prm: undefined, authDoc: AUTH_META_AT_MCP_ORIGIN }));
    const out = await beginAuth({ serverId: 's1', serverUrl: 'https://mcp.example.com/mcp', redirectUri: 'https://cb', dataDir: tmp(), fetchImpl: f });
    const url = new URL(out.authorizeUrl);
    expect(url.searchParams.get('scope')).toBe('s'); // from authServer.scopes_supported
    expect(url.searchParams.get('resource')).toBe('https://mcp.example.com/mcp'); // serverUrl fallback
    expect(out.pending).not.toHaveProperty('clientSecret');
  });

  it('honors an explicit scope override', async () => {
    const f = makeFetch(router({ prm: { resource: 'https://res.example.com', scopes_supported: [] }, authDoc: { ...AUTH_META_AT_MCP_ORIGIN, scopes_supported: undefined } }));
    const out = await beginAuth({ serverId: 's1', serverUrl: 'https://mcp.example.com/mcp', redirectUri: 'https://cb', dataDir: tmp(), scope: 'custom', fetchImpl: f });
    expect(new URL(out.authorizeUrl).searchParams.get('scope')).toBe('custom');
  });

  it('emits no scope when none can be resolved', async () => {
    const f = makeFetch(router({ prm: { scopes_supported: [] }, authDoc: { ...AUTH_META_AT_MCP_ORIGIN, scopes_supported: undefined } }));
    const out = await beginAuth({ serverId: 's1', serverUrl: 'https://mcp.example.com/mcp', redirectUri: 'https://cb', dataDir: tmp(), fetchImpl: f });
    expect(new URL(out.authorizeUrl).searchParams.has('scope')).toBe(false);
    expect(out.pending).not.toHaveProperty('scope');
  });

  it('throws when the auth server cannot be discovered', async () => {
    const f = makeFetch(router({ prm: { authorization_servers: ['https://auth.example.com'] }, authDoc: undefined }));
    await expect(
      beginAuth({ serverId: 's1', serverUrl: 'https://mcp.example.com/mcp', redirectUri: 'https://cb', dataDir: tmp(), fetchImpl: f }),
    ).rejects.toThrow(/could not discover OAuth metadata/);
  });
});

describe('defaults to the global fetch when no fetchImpl is passed', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('resolves discovery/registration/token/beginAuth via the global fetch', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetch((url) => {
        if (url.includes('oauth-protected-resource')) return jsonResponse({ authorization_servers: ['https://auth.example.com'], resource: 'https://res.example.com', scopes_supported: ['s'] });
        if (url.includes('oauth-authorization-server') || url.includes('openid-configuration')) return jsonResponse(AUTH_META);
        if (url.endsWith('/register')) return jsonResponse({ client_id: 'cid' });
        if (url.endsWith('/token')) return jsonResponse({ access_token: 'AT' });
        return notFound();
      }),
    );
    expect(await discoverProtectedResource('https://mcp.example.com/mcp')).not.toBeNull();
    expect(await discoverAuthServer('https://auth.example.com')).not.toBeNull();
    expect(await registerClient('https://auth.example.com/register', 'https://cb')).toEqual({ clientId: 'cid' });
    expect(await getOrRegisterClient(tmp(), AUTH_META, 'https://cb')).toMatchObject({ clientId: 'cid' });
    expect((await exchangeCodeForToken({ tokenEndpoint: 'https://auth.example.com/token', clientId: 'cid', redirectUri: 'https://cb', code: 'c', codeVerifier: 'v' })).access_token).toBe('AT');
    expect((await refreshAccessToken({ tokenEndpoint: 'https://auth.example.com/token', clientId: 'cid', refreshToken: 'rt' })).access_token).toBe('AT');
    const out = await beginAuth({ serverId: 's1', serverUrl: 'https://mcp.example.com/mcp', redirectUri: 'https://cb', dataDir: tmp() });
    expect(out.authorizeUrl).toContain('https://auth.example.com/authorize');
  });
});

// SEC-RB-001 / CR-005: every outbound fetch in this file (discovery, DCR,
// token exchange) must refuse plaintext/private/loopback destinations,
// refuse to follow redirects, cap response bytes, and time out — rather
// than trusting a caller- or metadata-supplied URL unconditionally.
describe('SSRF hardening: outbound-fetch safety (SEC-RB-001 / CR-005)', () => {
  it('discoverAuthServer rejects a non-https issuer without ever calling fetch', async () => {
    const fetchSpy = vi.fn();
    expect(await discoverAuthServer('http://auth.example.com', fetchSpy as unknown as typeof fetch)).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('discoverProtectedResource rejects a non-https resource url without ever calling fetch', async () => {
    const fetchSpy = vi.fn();
    expect(
      await discoverProtectedResource('http://mcp.example.com/mcp', fetchSpy as unknown as typeof fetch),
    ).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('discoverProtectedResource rejects a literal private/loopback IP without ever calling fetch', async () => {
    const fetchSpy = vi.fn();
    expect(
      await discoverProtectedResource('https://127.0.0.1/mcp', fetchSpy as unknown as typeof fetch),
    ).toBeNull();
    expect(
      await discoverProtectedResource('https://169.254.169.254/mcp', fetchSpy as unknown as typeof fetch),
    ).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('registerClient rejects a non-https registration endpoint without ever calling fetch', async () => {
    const fetchSpy = vi.fn();
    await expect(
      registerClient('http://auth.example.com/register', 'https://cb', fetchSpy as unknown as typeof fetch),
    ).rejects.toThrow();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('exchangeCodeForToken rejects a non-https token endpoint without ever calling fetch', async () => {
    const fetchSpy = vi.fn();
    await expect(
      exchangeCodeForToken(
        { tokenEndpoint: 'http://auth.example.com/token', clientId: 'cid', redirectUri: 'https://cb', code: 'c', codeVerifier: 'v' },
        fetchSpy as unknown as typeof fetch,
      ),
    ).rejects.toThrow();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('refreshAccessToken rejects a literal private-IP token endpoint without ever calling fetch', async () => {
    const fetchSpy = vi.fn();
    await expect(
      refreshAccessToken(
        { tokenEndpoint: 'https://127.0.0.1/token', clientId: 'cid', refreshToken: 'rt' },
        fetchSpy as unknown as typeof fetch,
      ),
    ).rejects.toThrow();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('refuses to follow a redirect response instead of trusting it (discovery folds the refusal into null)', async () => {
    const f = makeFetch(() => new Response(null, { status: 302, headers: { location: 'https://internal.example/secret' } }));
    expect(await discoverProtectedResource('https://mcp.example.com/mcp', f)).toBeNull();
  });

  it('refuses to follow a redirect from the token endpoint (surfaces as a thrown error, not a followed hop)', async () => {
    const f = makeFetch(() => new Response(null, { status: 307, headers: { location: 'https://internal.example/steal-token' } }));
    await expect(
      refreshAccessToken({ tokenEndpoint: 'https://auth.example.com/token', clientId: 'cid', refreshToken: 'rt' }, f),
    ).rejects.toThrow(/redirect/);
  });

  it('treats an oversized discovery response as a failure rather than buffering it unbounded', async () => {
    const huge = JSON.stringify({
      authorization_endpoint: 'https://auth.example.com/authorize',
      token_endpoint: 'https://auth.example.com/token',
      padding: 'x'.repeat(5_000_000),
    });
    const f = makeFetch(() => new Response(huge, { status: 200, headers: { 'content-type': 'application/json' } }));
    expect(await discoverAuthServer('https://auth.example.com', f)).toBeNull();
  });

  it('aborts a hanging registration request once the fetch timeout elapses, rejecting rather than hanging forever', async () => {
    vi.useFakeTimers();
    try {
      const hangingFetch = ((_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('The operation was aborted')));
        })) as unknown as typeof fetch;
      // registerClient makes exactly one fetch call (unlike discovery, which
      // loops over multiple well-known candidates and would need the
      // timeout advanced once per candidate) — the simplest deterministic
      // way to prove the internal AbortSignal-based timeout actually fires.
      const promise = registerClient('https://auth.example.com/register', 'https://cb', hangingFetch);
      // Attach a handler immediately so Node doesn't flag the eventual
      // rejection as "unhandled" during the gap before `advanceTimersByTimeAsync`
      // resolves; the real assertion below still observes the same rejection.
      promise.catch(() => {});
      await vi.advanceTimersByTimeAsync(10_000); // the internal fetch timeout
      await expect(promise).rejects.toThrow();
    } finally {
      vi.useRealTimers();
    }
  }, 15_000);

  describe('connection-time DNS-rebinding guard (real fetch, injected lookup — mirrors packages/deploy/src/reachability.test.ts)', () => {
    it('rejects when the injected lookup resolves the well-known host to a private/link-local address', async () => {
      // Deliberately does not stub global fetch: the rejection must come
      // from the real undici Agent's connect-time `lookup` (wired via the
      // injected `lookupImpl`) refusing to connect, not from a mocked
      // network layer.
      const result = await discoverProtectedResource(
        'https://rebinding-attacker.example/mcp',
        undefined,
        ((_hostname: string, _opts: unknown, cb: (err: Error | null, address?: unknown, family?: number) => void) =>
          cb(null, '169.254.169.254', 4)) as never,
      );
      expect(result).toBeNull();
    }, 15_000);
  });
});
