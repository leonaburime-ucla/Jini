import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// chmod is intercepted so we can exercise the best-effort 0600 lockdown's
// success + failure branches without needing an OS that rejects chmod. All
// other fs/promises calls delegate to the real implementation.
const hoisted = vi.hoisted(() => ({ chmodMode: 'ok' as 'ok' | 'enotsup' | 'eperm' | 'error' | 'nomsg' }));
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  const codes: Record<string, string> = { enotsup: 'ENOTSUP', eperm: 'EPERM', error: 'EIO' };
  return {
    ...actual,
    chmod: (p: fs.PathLike, mode: fs.Mode) => {
      if (hoisted.chmodMode === 'ok') return actual.chmod(p, mode);
      // A message-less error object -> exercises the `e.message ?? err` fallback.
      if (hoisted.chmodMode === 'nomsg') return Promise.reject({ code: 'EIO' });
      const e = new Error('chmod refused') as NodeJS.ErrnoException;
      e.code = codes[hoisted.chmodMode];
      return Promise.reject(e);
    },
  };
});

import {
  sanitizeTokensFile,
  readTokensFile,
  getToken,
  setToken,
  clearToken,
  readAllTokens,
  isTokenExpired,
  type StoredMcpToken,
} from './tokens.js';

const tmpDirs: string[] = [];
function tmp(): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'jini-mcp-tok-'));
  tmpDirs.push(d);
  return d;
}
function writeRaw(dir: string, json: string): void {
  fs.writeFileSync(path.join(dir, 'mcp-tokens.json'), json);
}

beforeEach(() => {
  hoisted.chmodMode = 'ok';
});
afterEach(() => {
  for (const d of tmpDirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

describe('sanitizeTokensFile / sanitizeToken', () => {
  it('returns an empty store for non-objects and a non-object servers map', () => {
    expect(sanitizeTokensFile(null)).toEqual({ servers: {} });
    expect(sanitizeTokensFile({ servers: 5 })).toEqual({ servers: {} });
  });

  it('keeps a fully-populated token verbatim', () => {
    const full: StoredMcpToken = {
      accessToken: 'AT',
      refreshToken: 'RT',
      expiresAt: 123456,
      tokenType: 'Bearer',
      scope: 'read write',
      savedAt: 999,
      tokenEndpoint: 'https://auth.example.com/token',
      clientId: 'cid',
      clientSecret: 'secret',
      authServerIssuer: 'https://auth.example.com',
      redirectUri: 'https://cb.example.com',
      resourceUrl: 'https://mcp.example.com',
    };
    expect(sanitizeTokensFile({ servers: { s1: full } })).toEqual({ servers: { s1: full } });
  });

  it('applies defaults, drops falsy optionals, trims, and rejects bad entries', () => {
    const raw = JSON.parse(
      JSON.stringify({
        servers: {
          minimal: { accessToken: 'tok' },
          empties: {
            accessToken: '  a  ',
            tokenType: '   ',
            refreshToken: '  ',
            scope: '',
            expiresAt: 'nope',
            savedAt: 'x',
            tokenEndpoint: '',
            clientId: '  ',
            clientSecret: '',
            authServerIssuer: '',
            redirectUri: '',
            resourceUrl: '',
          },
          noaccess: { tokenType: 'Bearer' },
          notobject: 5,
          '__proto__': { accessToken: 'p' },
          constructor: { accessToken: 'c' },
        },
      }),
    );
    const out = sanitizeTokensFile(raw);
    expect(out.servers.minimal).toEqual({ accessToken: 'tok', tokenType: 'Bearer', savedAt: expect.any(Number) });
    expect(out.servers.empties).toEqual({ accessToken: 'a', tokenType: 'Bearer', savedAt: expect.any(Number) });
    expect(out.servers).not.toHaveProperty('noaccess');
    expect(out.servers).not.toHaveProperty('notobject');
    expect(Object.keys(out.servers).sort()).toEqual(['empties', 'minimal']);
  });
});

describe('readTokensFile', () => {
  it('returns an empty store when the file is missing', async () => {
    await expect(readTokensFile(tmp())).resolves.toEqual({ servers: {} });
  });
  it('returns an empty store on corrupt JSON', async () => {
    const dir = tmp();
    writeRaw(dir, '{ broken');
    await expect(readTokensFile(dir)).resolves.toEqual({ servers: {} });
  });
  it('rethrows unexpected read errors (EISDIR)', async () => {
    const dir = tmp();
    fs.mkdirSync(path.join(dir, 'mcp-tokens.json'));
    await expect(readTokensFile(dir)).rejects.toThrow();
  });
});

describe('token store mutations', () => {
  const tok: StoredMcpToken = { accessToken: 'AT', tokenType: 'Bearer', savedAt: 1 };

  it('sets, gets, bulk-reads, and clears a token', async () => {
    const dir = tmp();
    expect(await getToken(dir, 's1')).toBeNull();
    await setToken(dir, 's1', tok);
    expect(await getToken(dir, 's1')).toEqual(tok);
    expect(await readAllTokens(dir)).toEqual({ s1: tok });
    await clearToken(dir, 's1');
    expect(await getToken(dir, 's1')).toBeNull();
  });

  it('clearToken is a no-op when the server is absent', async () => {
    const dir = tmp();
    await setToken(dir, 's1', tok);
    await clearToken(dir, 'missing');
    expect(await getToken(dir, 's1')).toEqual(tok);
  });

  it('serializes concurrent writes on the same dataDir', async () => {
    const dir = tmp();
    await Promise.all([
      setToken(dir, 'a', { accessToken: 'A', tokenType: 'Bearer', savedAt: 1 }),
      setToken(dir, 'b', { accessToken: 'B', tokenType: 'Bearer', savedAt: 2 }),
    ]);
    const all = await readAllTokens(dir);
    expect(Object.keys(all).sort()).toEqual(['a', 'b']);
  });

  it('swallows an unsupported chmod (ENOTSUP/EPERM) without warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const mode of ['enotsup', 'eperm'] as const) {
      hoisted.chmodMode = mode;
      const dir = tmp();
      await setToken(dir, 's1', tok);
      expect(await getToken(dir, 's1')).toEqual(tok);
    }
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('warns but still persists when chmod fails for another reason', async () => {
    hoisted.chmodMode = 'error';
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const dir = tmp();
    await setToken(dir, 's1', tok);
    expect(warn).toHaveBeenCalledWith('[mcp-tokens] could not chmod 0600', expect.any(String), 'chmod refused');
    expect(await getToken(dir, 's1')).toEqual(tok);
    warn.mockRestore();
  });

  it('falls back to the raw error when the chmod failure carries no message', async () => {
    hoisted.chmodMode = 'nomsg';
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const dir = tmp();
    await setToken(dir, 's1', tok);
    expect(warn).toHaveBeenCalledWith('[mcp-tokens] could not chmod 0600', expect.any(String), { code: 'EIO' });
    expect(await getToken(dir, 's1')).toEqual(tok);
    warn.mockRestore();
  });
});

describe('isTokenExpired', () => {
  it('never expires a token without expiresAt', () => {
    expect(isTokenExpired({ accessToken: 'x', tokenType: 'Bearer', savedAt: 1 })).toBe(false);
  });
  it('expires when past expiry (accounting for skew) and not before', () => {
    const t: StoredMcpToken = { accessToken: 'x', tokenType: 'Bearer', savedAt: 1, expiresAt: 1000 };
    expect(isTokenExpired(t, 500, 0)).toBe(false); // 1000 <= 500 -> not expired
    expect(isTokenExpired(t, 2000, 0)).toBe(true); // 1000 <= 2000 -> expired
    expect(isTokenExpired(t, 980, 30_000)).toBe(true); // -29000 <= 980 -> expired via skew
  });
  it('uses default now/skew when omitted', () => {
    expect(isTokenExpired({ accessToken: 'x', tokenType: 'Bearer', savedAt: 1, expiresAt: 1 })).toBe(true);
  });
});
