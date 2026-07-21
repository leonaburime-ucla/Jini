import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeployError } from '../types.js';
import {
  CloudflarePagesDeployTarget,
  chunkCloudflarePagesAssetUploads,
  cloudflarePagesAssetHash,
  listCloudflarePagesZones,
} from '../cloudflare-pages.js';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

/**
 * Mirrors `cloudflarePagesDnsMarker`'s derivation (`shortHash` = sha256,
 * hex, sliced to 12 chars) so tests can predict the marker `canPatch...`
 * needs to match, rather than assume the reuse-patch path is unreachable.
 */
function expectedCloudflareDnsMarker(projectName: string, pagesTarget: string): string {
  const shortHash = (value: string) => createHash('sha256').update(value).digest('hex').slice(0, 12);
  return `jini-deploy:${shortHash(projectName)}:${shortHash(pagesTarget)}`;
}

describe('cloudflarePagesAssetHash', () => {
  it('is deterministic for the same file/data pair', () => {
    const file = { file: 'index.html', data: '<html></html>' };
    expect(cloudflarePagesAssetHash(file)).toBe(cloudflarePagesAssetHash(file));
  });

  it('is a 32-character lowercase hex string', () => {
    const hash = cloudflarePagesAssetHash({ file: 'a.css', data: 'body{}' });
    expect(hash).toMatch(/^[0-9a-f]{32}$/);
  });

  it('differs for the same bytes under a different file extension', () => {
    const a = cloudflarePagesAssetHash({ file: 'a.css', data: 'x' });
    const b = cloudflarePagesAssetHash({ file: 'a.js', data: 'x' });
    expect(a).not.toBe(b);
  });
});

describe('chunkCloudflarePagesAssetUploads', () => {
  it('keeps a single small batch under the file-count cap in one chunk', () => {
    const files = Array.from({ length: 5 }, (_, i) => ({ hash: `h${i}`, data: 'x', contentType: 'text/plain' }));
    const chunks = chunkCloudflarePagesAssetUploads(files);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toHaveLength(5);
  });

  it('splits into multiple batches once the file-count cap is exceeded', () => {
    const files = Array.from({ length: 10 }, (_, i) => ({ hash: `h${i}`, data: 'x', contentType: 'text/plain' }));
    const chunks = chunkCloudflarePagesAssetUploads(files, { maxFiles: 4 });
    expect(chunks.map((c) => c.length)).toEqual([4, 4, 2]);
  });

  it('splits into multiple batches once the byte-size cap is exceeded', () => {
    const bigData = 'x'.repeat(1000);
    const files = Array.from({ length: 5 }, (_, i) => ({ hash: `h${i}`, data: bigData, contentType: 'text/plain' }));
    // Each file's estimated payload is ~1000*4/3 + overhead; cap tight enough to force 1-per-batch.
    const chunks = chunkCloudflarePagesAssetUploads(files, { maxBytes: 1500 });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.length >= 1)).toBe(true);
  });

  it('gives an over-cap single file its own batch rather than dropping it', () => {
    const hugeData = 'x'.repeat(10_000);
    const files = [{ hash: 'solo', data: hugeData, contentType: 'text/plain' }];
    const chunks = chunkCloudflarePagesAssetUploads(files, { maxBytes: 10 });
    expect(chunks).toEqual([[files[0]]]);
  });

  it('returns no chunks for an empty file list', () => {
    expect(chunkCloudflarePagesAssetUploads([])).toEqual([]);
  });
});

describe('listCloudflarePagesZones', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects with DeployError when accountId is missing, without a network call', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    await expect(listCloudflarePagesZones({ token: 'tok', accountId: '' })).rejects.toThrow(DeployError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('filters out zones missing an id or name and stops pagination when a page returns fewer items than per_page', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(200, {
          success: true,
          result: [
            { id: 'z1', name: 'Example.com', status: 'active', type: 'full' },
            { id: '', name: 'missing-id.com' },
            { id: 'z2', name: '' },
          ],
          result_info: { count: 3, per_page: 100 },
        }),
      ),
    );

    const { zones } = await listCloudflarePagesZones({ token: 'tok', accountId: 'acct' });
    expect(zones).toEqual([{ id: 'z1', name: 'example.com', status: 'active', type: 'full' }]);
  });
});

describe('CloudflarePagesDeployTarget.publish', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('throws DeployError without a network call when accountId is missing', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const target = new CloudflarePagesDeployTarget({ token: 'tok', accountId: '' });
    await expect(target.publish({ files: [], projectName: 'demo' })).rejects.toThrow(DeployError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('ensures the project, uploads assets, deploys, and returns the reachable pages.dev URL', async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        const url = String(input);
        calls.push(`${init?.method ?? 'GET'} ${url}`);

        if (url.includes('/pages/projects/') && url.endsWith('jini-demo-site') && (!init?.method || init.method === 'GET')) {
          return jsonResponse(404, { success: false });
        }
        if (url.endsWith('/pages/projects') && init?.method === 'POST') {
          return jsonResponse(200, { success: true, result: { name: 'jini-demo-site' } });
        }
        if (url.endsWith('/upload-token')) {
          return jsonResponse(200, { success: true, result: { jwt: 'upload-jwt' } });
        }
        if (url.endsWith('/pages/assets/check-missing')) {
          const body = JSON.parse(String(init?.body));
          return jsonResponse(200, { success: true, result: body.hashes });
        }
        if (url.endsWith('/pages/assets/upload')) {
          return jsonResponse(200, { success: true });
        }
        if (url.endsWith('/pages/assets/upsert-hashes')) {
          return jsonResponse(200, { success: true });
        }
        if (url.endsWith('/deployments') && init?.method === 'POST') {
          return jsonResponse(200, { success: true, result: { id: 'depl_1', url: 'jini-demo-site.pages.dev' } });
        }
        // Reachability HEAD probe against the pages.dev production URL.
        if (url === 'https://jini-demo-site.pages.dev/' || url === 'https://jini-demo-site.pages.dev') {
          return new Response('', { status: 200 });
        }
        throw new Error(`Unexpected fetch call in test: ${init?.method ?? 'GET'} ${url}`);
      }),
    );

    const target = new CloudflarePagesDeployTarget({ token: 'tok', accountId: 'acct' });
    const result = await target.publish({
      files: [{ file: 'index.html', data: '<html></html>', contentType: 'text/html' }],
      projectName: 'Demo Site!!',
    });

    expect(result.targetId).toBe('cloudflare-pages');
    expect(result.deploymentId).toBe('depl_1');
    expect(result.url).toBe('https://jini-demo-site.pages.dev');
    expect(result.status).toBe('ready');
    expect(result.providerMetadata?.projectName).toBe('jini-demo-site');
    // Derives the same project name deterministically across the whole flow.
    expect(calls.some((c) => c.includes('jini-demo-site'))).toBe(true);
  });

  it('reuses an existing Cloudflare Pages project when the initial GET already finds it (no 404/create round-trip)', async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        const url = String(input);
        calls.push(`${init?.method ?? 'GET'} ${url}`);
        if (/\/pages\/projects\/[^/]+$/.test(url) && (!init?.method || init.method === 'GET')) {
          return jsonResponse(200, { success: true, result: { name: 'jini-demo' } });
        }
        if (url.endsWith('/upload-token')) return jsonResponse(200, { success: true, result: { jwt: 'jwt' } });
        if (url.endsWith('/pages/assets/check-missing')) return jsonResponse(200, { success: true, result: [] });
        if (url.endsWith('/pages/assets/upsert-hashes')) return jsonResponse(200, { success: true });
        if (url.endsWith('/deployments') && init?.method === 'POST') {
          return jsonResponse(200, { success: true, result: { id: 'd1', url: 'jini-demo.pages.dev' } });
        }
        if (url.startsWith('https://jini-demo.pages.dev')) return new Response('', { status: 200 });
        throw new Error(`Unexpected fetch call: ${init?.method ?? 'GET'} ${url}`);
      }),
    );
    const target = new CloudflarePagesDeployTarget({ token: 'tok', accountId: 'acct' });
    const result = await target.publish({ files: [], projectName: 'demo' });
    expect(result.status).toBe('ready');
    // No POST to /pages/projects — the project already existed.
    expect(calls.some((c) => c.startsWith('POST') && c.endsWith('/pages/projects'))).toBe(false);
  });

  it('retries the project lookup and succeeds when project creation races into an "already exists" response', async () => {
    let projectLookups = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        const url = String(input);
        if (/\/pages\/projects\/[^/]+$/.test(url) && (!init?.method || init.method === 'GET')) {
          // First GET (before create) 404s; the retry GET (after the raced create) succeeds.
          projectLookups += 1;
          return projectLookups === 1 ? jsonResponse(404, { success: false }) : jsonResponse(200, { success: true, result: { name: 'jini-demo' } });
        }
        if (url.endsWith('/pages/projects') && init?.method === 'POST') {
          return jsonResponse(409, { success: false, errors: [{ message: 'a project with this name already exists' }] });
        }
        if (url.endsWith('/upload-token')) return jsonResponse(200, { success: true, result: { jwt: 'jwt' } });
        if (url.endsWith('/pages/assets/check-missing')) return jsonResponse(200, { success: true, result: [] });
        if (url.endsWith('/pages/assets/upsert-hashes')) return jsonResponse(200, { success: true });
        if (url.endsWith('/deployments') && init?.method === 'POST') {
          return jsonResponse(200, { success: true, result: { id: 'd1', url: 'jini-demo.pages.dev' } });
        }
        if (url.startsWith('https://jini-demo.pages.dev')) return new Response('', { status: 200 });
        throw new Error(`Unexpected fetch call: ${init?.method ?? 'GET'} ${url}`);
      }),
    );
    const target = new CloudflarePagesDeployTarget({ token: 'tok', accountId: 'acct' });
    const result = await target.publish({ files: [], projectName: 'demo' });
    expect(result.status).toBe('ready');
  });

  it('throws the underlying error when project creation fails for a reason other than "already exists"', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/pages/projects/') && (!init?.method || init.method === 'GET')) return jsonResponse(404, { success: false });
        if (url.endsWith('/pages/projects') && init?.method === 'POST') {
          return jsonResponse(500, { success: false, errors: [{ message: 'internal error' }] });
        }
        throw new Error(`Unexpected fetch call: ${url}`);
      }),
    );
    const target = new CloudflarePagesDeployTarget({ token: 'tok', accountId: 'acct' });
    await expect(target.publish({ files: [], projectName: 'demo' })).rejects.toThrow('internal error');
  });

  it('throws DeployError when Cloudflare returns a non-JSON body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/pages/projects/') && (!init?.method || init.method === 'GET')) return new Response('not json', { status: 200 });
        throw new Error(`Unexpected fetch call: ${url}`);
      }),
    );
    const target = new CloudflarePagesDeployTarget({ token: 'tok', accountId: 'acct' });
    await expect(target.publish({ files: [], projectName: 'demo' })).rejects.toThrow(DeployError);
  });

  it('falls back through the message/messages/generic chain when a Cloudflare error body has no errors[].message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/pages/projects/') && (!init?.method || init.method === 'GET')) return jsonResponse(404, { success: false });
        if (url.endsWith('/pages/projects') && init?.method === 'POST') {
          return jsonResponse(500, { success: false, messages: [{ message: 'from messages array' }] });
        }
        throw new Error(`Unexpected fetch call: ${url}`);
      }),
    );
    const target = new CloudflarePagesDeployTarget({ token: 'tok', accountId: 'acct' });
    await expect(target.publish({ files: [], projectName: 'demo' })).rejects.toThrow('from messages array');
  });

  it('falls back to the caller-supplied fallback message when the error body is empty (no errors[]/messages[]/message)', async () => {
    // `cloudflareError`'s own final `Cloudflare request failed (${status}).` default is unreachable
    // through this module's actual call sites — every call passes its own non-empty fallback text
    // (see the "Flagged for human review" note) — so this exercises the `fallback` disjunct instead.
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/pages/projects/') && (!init?.method || init.method === 'GET')) return jsonResponse(404, { success: false });
        if (url.endsWith('/pages/projects') && init?.method === 'POST') return jsonResponse(503, {});
        throw new Error(`Unexpected fetch call: ${url}`);
      }),
    );
    const target = new CloudflarePagesDeployTarget({ token: 'tok', accountId: 'acct' });
    await expect(target.publish({ files: [], projectName: 'demo' })).rejects.toThrow('Cloudflare Pages project creation failed.');
  });

  it('rejects an asset over the Cloudflare Pages per-asset size cap before any upload call', async () => {
    const fetchSpy = vi.fn(async (input: string, init?: RequestInit) => {
      const url = String(input);
      if (/\/pages\/projects\/[^/]+$/.test(url) && (!init?.method || init.method === 'GET')) {
        return jsonResponse(404, { success: false });
      }
      if (url.endsWith('/pages/projects') && init?.method === 'POST') {
        return jsonResponse(200, { success: true, result: {} });
      }
      if (url.endsWith('/upload-token')) {
        return jsonResponse(200, { success: true, result: { jwt: 'upload-jwt' } });
      }
      throw new Error(`Unexpected fetch call: ${url}`);
    });
    vi.stubGlobal('fetch', fetchSpy);

    const oversized = Buffer.alloc(26 * 1024 * 1024, 1);
    const target = new CloudflarePagesDeployTarget({ token: 'tok', accountId: 'acct' });
    await expect(
      target.publish({ files: [{ file: 'big.bin', data: oversized }], projectName: 'demo' }),
    ).rejects.toThrow(/25\.00 MiB or smaller/);
  });
});

describe('CloudflarePagesDeployTarget.publish — custom domain', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function baseHandlers(url: string, init: RequestInit | undefined, calls: string[]): Response | undefined {
    calls.push(`${init?.method ?? 'GET'} ${url}`);
    // Bare project lookup: `.../pages/projects/<name>` with nothing after it.
    if (/\/pages\/projects\/[^/]+$/.test(url) && (!init?.method || init.method === 'GET')) {
      return jsonResponse(200, { success: true, result: { name: 'jini-demo' } });
    }
    if (url.endsWith('/upload-token')) return jsonResponse(200, { success: true, result: { jwt: 'jwt' } });
    if (url.endsWith('/pages/assets/check-missing')) return jsonResponse(200, { success: true, result: [] });
    if (url.endsWith('/pages/assets/upsert-hashes')) return jsonResponse(200, { success: true });
    if (url.endsWith('/deployments') && init?.method === 'POST') {
      return jsonResponse(200, { success: true, result: { id: 'd1', url: 'jini-demo.pages.dev' } });
    }
    if (url.startsWith('https://jini-demo.pages.dev')) return new Response('', { status: 200 });
    return undefined;
  }

  it('sets up a brand-new custom domain end to end: zone validation, CNAME creation, Pages domain creation, and reachability', async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        const url = String(input);
        const base = baseHandlers(url, init, calls);
        if (base) return base;
        if (url.includes('/zones/zone1') && !url.includes('dns_records')) {
          return jsonResponse(200, { success: true, result: { name: 'example.com', status: 'active', type: 'full' } });
        }
        if (url.includes('/zones/zone1/dns_records') && (!init?.method || init.method === 'GET')) {
          return jsonResponse(200, { success: true, result: [] });
        }
        if (url.includes('/zones/zone1/dns_records') && init?.method === 'POST') {
          return jsonResponse(200, { success: true, result: { id: 'dns-1' } });
        }
        if (url.includes('/domains/demo.example.com')) return jsonResponse(404, { success: false });
        if (url.endsWith('/domains') && init?.method === 'POST') {
          return jsonResponse(200, { success: true, result: { name: 'demo.example.com', status: 'active' } });
        }
        if (url.startsWith('https://demo.example.com')) return new Response('', { status: 200 });
        throw new Error(`Unexpected fetch call: ${init?.method ?? 'GET'} ${url}`);
      }),
    );

    const target = new CloudflarePagesDeployTarget({ token: 'tok', accountId: 'acct' });
    const result = await target.publish({
      files: [],
      projectName: 'demo',
      metadata: { customDomain: { zoneId: 'zone1', zoneName: 'example.com', domainPrefix: 'demo' } },
    });

    expect(result.status).toBe('ready');
    expect(result.providerMetadata?.customDomain).toMatchObject({
      hostname: 'demo.example.com',
      status: 'ready',
      dnsStatus: 'created',
      dnsOwnership: 'marked',
      domainStatus: 'active',
    });
  });

  it('reuses an existing exact CNAME record and an already-active Pages domain (idempotent republish)', async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        const url = String(input);
        const base = baseHandlers(url, init, calls);
        if (base) return base;
        if (url.includes('/zones/zone1') && !url.includes('dns_records')) {
          return jsonResponse(200, { success: true, result: { name: 'example.com', status: 'active', type: 'full' } });
        }
        if (url.includes('/zones/zone1/dns_records')) {
          return jsonResponse(200, {
            success: true,
            result: [{ id: 'dns-1', type: 'CNAME', name: 'demo.example.com', content: 'jini-demo.pages.dev', comment: 'existing-marker' }],
          });
        }
        if (url.includes('/domains/demo.example.com')) {
          return jsonResponse(200, { success: true, result: { name: 'demo.example.com', status: 'active' } });
        }
        if (url.startsWith('https://demo.example.com')) return new Response('', { status: 200 });
        throw new Error(`Unexpected fetch call: ${init?.method ?? 'GET'} ${url}`);
      }),
    );

    const target = new CloudflarePagesDeployTarget({ token: 'tok', accountId: 'acct' });
    const result = await target.publish({
      files: [],
      projectName: 'demo',
      metadata: { customDomain: { zoneId: 'zone1', zoneName: 'example.com', domainPrefix: 'demo' } },
    });

    expect(result.providerMetadata?.customDomain).toMatchObject({ dnsStatus: 'reused', domainStatus: 'active', status: 'ready' });
  });

  it('reports a DNS conflict when an unrelated record already occupies the hostname', async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        const url = String(input);
        const base = baseHandlers(url, init, calls);
        if (base) return base;
        if (url.includes('/zones/zone1') && !url.includes('dns_records')) {
          return jsonResponse(200, { success: true, result: { name: 'example.com', status: 'active', type: 'full' } });
        }
        if (url.includes('/zones/zone1/dns_records')) {
          return jsonResponse(200, {
            success: true,
            result: [{ id: 'other-1', type: 'A', name: 'demo.example.com', content: '1.2.3.4' }],
          });
        }
        throw new Error(`Unexpected fetch call: ${init?.method ?? 'GET'} ${url}`);
      }),
    );

    const target = new CloudflarePagesDeployTarget({ token: 'tok', accountId: 'acct' });
    const result = await target.publish({
      files: [],
      projectName: 'demo',
      metadata: { customDomain: { zoneId: 'zone1', zoneName: 'example.com', domainPrefix: 'demo' } },
    });

    // Custom-domain failure is captured into providerMetadata, not thrown — the base pages.dev
    // result still comes back (see the publish() @tradeoffs doc).
    expect(result.status).toBe('ready');
    expect(result.providerMetadata?.customDomain).toMatchObject({ status: 'conflict', errorCode: 'cloudflare_dns_record_conflict' });
  });

  it('rejects an invalid custom-domain selection (missing prefix) before making any zone-validation network call', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const target = new CloudflarePagesDeployTarget({ token: 'tok', accountId: 'acct' });
    await expect(
      target.publish({ files: [], projectName: 'demo', metadata: { customDomain: { zoneId: 'zone1', zoneName: 'example.com', domainPrefix: '' } } }),
    ).rejects.toThrow(/subdomain prefix/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects a syntactically invalid zone name before making any zone-validation network call', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const target = new CloudflarePagesDeployTarget({ token: 'tok', accountId: 'acct' });
    await expect(
      target.publish({
        files: [],
        projectName: 'demo',
        metadata: { customDomain: { zoneId: 'zone1', zoneName: 'not_a_valid_zone!!', domainPrefix: 'demo' } },
      }),
    ).rejects.toThrow(/valid Cloudflare domain/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects when the resolved zone no longer matches the selected zone name', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) => {
        const url = String(input);
        if (url.includes('/zones/zone1')) return jsonResponse(200, { success: true, result: { name: 'different.com', status: 'active', type: 'full' } });
        throw new Error(`Unexpected fetch call: ${url}`);
      }),
    );
    const target = new CloudflarePagesDeployTarget({ token: 'tok', accountId: 'acct' });
    await expect(
      target.publish({ files: [], projectName: 'demo', metadata: { customDomain: { zoneId: 'zone1', zoneName: 'example.com', domainPrefix: 'demo' } } }),
    ).rejects.toThrow(/no longer matches/);
  });

  it('rejects when the zone is not active', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) => {
        const url = String(input);
        if (url.includes('/zones/zone1')) return jsonResponse(200, { success: true, result: { name: 'example.com', status: 'pending', type: 'full' } });
        throw new Error(`Unexpected fetch call: ${url}`);
      }),
    );
    const target = new CloudflarePagesDeployTarget({ token: 'tok', accountId: 'acct' });
    await expect(
      target.publish({ files: [], projectName: 'demo', metadata: { customDomain: { zoneId: 'zone1', zoneName: 'example.com', domainPrefix: 'demo' } } }),
    ).rejects.toThrow(/active zone/);
  });

  it('rejects when the zone is not a full DNS zone', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) => {
        const url = String(input);
        if (url.includes('/zones/zone1')) return jsonResponse(200, { success: true, result: { name: 'example.com', status: 'active', type: 'partial' } });
        throw new Error(`Unexpected fetch call: ${url}`);
      }),
    );
    const target = new CloudflarePagesDeployTarget({ token: 'tok', accountId: 'acct' });
    await expect(
      target.publish({ files: [], projectName: 'demo', metadata: { customDomain: { zoneId: 'zone1', zoneName: 'example.com', domainPrefix: 'demo' } } }),
    ).rejects.toThrow(/full DNS zone/);
  });
});

describe('CloudflarePagesDeployTarget.checkReachability', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('probes the given URL with the shared reachability checker', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 200 })));
    const target = new CloudflarePagesDeployTarget({ token: 'tok', accountId: 'acct' });
    const result = await target.checkReachability('https://demo.example.com');
    expect(result.reachable).toBe(true);
  });
});

describe('listCloudflarePagesZones — pagination', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('follows multiple pages using total_pages when the API reports it', async () => {
    let page = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        page += 1;
        return jsonResponse(200, {
          success: true,
          result: [{ id: `z${page}`, name: `zone${page}.com`, status: 'active', type: 'full' }],
          result_info: { total_pages: 2 },
        });
      }),
    );
    const { zones } = await listCloudflarePagesZones({ token: 'tok', accountId: 'acct' });
    expect(zones.map((z) => z.id)).toEqual(['z1', 'z2']);
  });

  it('throws a DeployError when a page response reports success:false', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(500, { success: false, errors: [{ message: 'zones lookup broke' }] })));
    await expect(listCloudflarePagesZones({ token: 'tok', accountId: 'acct' })).rejects.toThrow('zones lookup broke');
  });
});

describe('CloudflarePagesDeployTarget.publish — custom domain conflict/pending states', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function baseHandlers2(url: string, init: RequestInit | undefined): Response | undefined {
    if (/\/pages\/projects\/[^/]+$/.test(url) && (!init?.method || init.method === 'GET')) {
      return jsonResponse(200, { success: true, result: { name: 'jini-demo' } });
    }
    if (url.endsWith('/upload-token')) return jsonResponse(200, { success: true, result: { jwt: 'jwt' } });
    if (url.endsWith('/pages/assets/check-missing')) return jsonResponse(200, { success: true, result: [] });
    if (url.endsWith('/pages/assets/upsert-hashes')) return jsonResponse(200, { success: true });
    if (url.endsWith('/deployments') && init?.method === 'POST') {
      return jsonResponse(200, { success: true, result: { id: 'd1', url: 'jini-demo.pages.dev' } });
    }
    if (url.startsWith('https://jini-demo.pages.dev')) return new Response('', { status: 200 });
    if (url.includes('/zones/zone1') && !url.includes('dns_records')) {
      return jsonResponse(200, { success: true, result: { name: 'example.com', status: 'active', type: 'full' } });
    }
    if (url.includes('/zones/zone1/dns_records') && (!init?.method || init.method === 'GET')) {
      return jsonResponse(200, { success: true, result: [] });
    }
    if (url.includes('/zones/zone1/dns_records') && init?.method === 'POST') {
      return jsonResponse(200, { success: true, result: { id: 'dns-1' } });
    }
    return undefined;
  }

  it('reports a domain conflict when Cloudflare says the hostname is already bound to another project, with no matching domain on retry', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        const url = String(input);
        const base = baseHandlers2(url, init);
        if (base) return base;
        if (url.includes('/domains/demo.example.com') && (!init?.method || init.method === 'GET')) {
          return jsonResponse(404, { success: false });
        }
        if (url.endsWith('/domains') && init?.method === 'POST') {
          return jsonResponse(409, { success: false, errors: [{ message: 'already bound to another project' }] });
        }
        throw new Error(`Unexpected fetch call: ${init?.method ?? 'GET'} ${url}`);
      }),
    );
    const target = new CloudflarePagesDeployTarget({ token: 'tok', accountId: 'acct' });
    const result = await target.publish({
      files: [],
      projectName: 'demo',
      metadata: { customDomain: { zoneId: 'zone1', zoneName: 'example.com', domainPrefix: 'demo' } },
    });
    expect(result.providerMetadata?.customDomain).toMatchObject({ status: 'conflict', errorCode: 'cloudflare_domain_already_bound' });
    // The base pages.dev deployment is still reported ready even though the custom domain failed.
    expect(result.status).toBe('ready');
  });

  it('reports the custom domain as pending (not ready) while Cloudflare is still verifying it, and reflects that in the aggregate status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        const url = String(input);
        const base = baseHandlers2(url, init);
        if (base) return base;
        if (url.includes('/domains/demo.example.com') && (!init?.method || init.method === 'GET')) return jsonResponse(404, { success: false });
        if (url.endsWith('/domains') && init?.method === 'POST') {
          return jsonResponse(200, { success: true, result: { name: 'demo.example.com', status: 'pending' } });
        }
        throw new Error(`Unexpected fetch call: ${init?.method ?? 'GET'} ${url}`);
      }),
    );
    const target = new CloudflarePagesDeployTarget({ token: 'tok', accountId: 'acct' });
    const result = await target.publish({
      files: [],
      projectName: 'demo',
      metadata: { customDomain: { zoneId: 'zone1', zoneName: 'example.com', domainPrefix: 'demo' } },
    });
    expect(result.providerMetadata?.customDomain).toMatchObject({ domainStatus: 'pending', status: 'pending' });
    // pages.dev itself is ready, but the aggregate must reflect the still-pending custom domain.
    expect(result.status).toBe('link-delayed');
  });
});

describe('CloudflarePagesDeployTarget.publish — core flow failures', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function coreHandlers(url: string, init: RequestInit | undefined): Response | undefined {
    if (/\/pages\/projects\/[^/]+$/.test(url) && (!init?.method || init.method === 'GET')) {
      return jsonResponse(200, { success: true, result: { name: 'jini-demo' } });
    }
    return undefined;
  }

  it('throws when the upload-token request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        const url = String(input);
        const base = coreHandlers(url, init);
        if (base) return base;
        if (url.endsWith('/upload-token')) return jsonResponse(500, { success: false, errors: [{ message: 'upload token unavailable' }] });
        throw new Error(`Unexpected fetch call: ${init?.method ?? 'GET'} ${url}`);
      }),
    );
    const target = new CloudflarePagesDeployTarget({ token: 'tok', accountId: 'acct' });
    await expect(target.publish({ files: [], projectName: 'demo' })).rejects.toThrow('upload token unavailable');
  });

  it('throws when the upload-token response has no jwt', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        const url = String(input);
        const base = coreHandlers(url, init);
        if (base) return base;
        if (url.endsWith('/upload-token')) return jsonResponse(200, { success: true, result: {} });
        throw new Error(`Unexpected fetch call: ${init?.method ?? 'GET'} ${url}`);
      }),
    );
    const target = new CloudflarePagesDeployTarget({ token: 'tok', accountId: 'acct' });
    await expect(target.publish({ files: [], projectName: 'demo' })).rejects.toThrow('Cloudflare Pages upload token request failed.');
  });

  it('throws when a missing-asset upload batch fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        const url = String(input);
        const base = coreHandlers(url, init);
        if (base) return base;
        if (url.endsWith('/upload-token')) return jsonResponse(200, { success: true, result: { jwt: 'jwt' } });
        if (url.endsWith('/pages/assets/check-missing')) {
          const body = JSON.parse(String(init?.body));
          return jsonResponse(200, { success: true, result: body.hashes });
        }
        if (url.endsWith('/pages/assets/upload')) {
          return jsonResponse(502, { success: false, errors: [{ message: 'asset upload broke' }] });
        }
        throw new Error(`Unexpected fetch call: ${init?.method ?? 'GET'} ${url}`);
      }),
    );
    const target = new CloudflarePagesDeployTarget({ token: 'tok', accountId: 'acct' });
    await expect(
      target.publish({ files: [{ file: 'index.html', data: '<html></html>' }], projectName: 'demo' }),
    ).rejects.toThrow('asset upload broke');
  });

  it('throws when upsert-hashes fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        const url = String(input);
        const base = coreHandlers(url, init);
        if (base) return base;
        if (url.endsWith('/upload-token')) return jsonResponse(200, { success: true, result: { jwt: 'jwt' } });
        if (url.endsWith('/pages/assets/check-missing')) return jsonResponse(200, { success: true, result: [] });
        if (url.endsWith('/pages/assets/upsert-hashes')) {
          return jsonResponse(502, { success: false, errors: [{ message: 'hash upsert broke' }] });
        }
        throw new Error(`Unexpected fetch call: ${init?.method ?? 'GET'} ${url}`);
      }),
    );
    const target = new CloudflarePagesDeployTarget({ token: 'tok', accountId: 'acct' });
    await expect(target.publish({ files: [], projectName: 'demo' })).rejects.toThrow('hash upsert broke');
  });

  it('throws when the deployment creation call fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        const url = String(input);
        const base = coreHandlers(url, init);
        if (base) return base;
        if (url.endsWith('/upload-token')) return jsonResponse(200, { success: true, result: { jwt: 'jwt' } });
        if (url.endsWith('/pages/assets/check-missing')) return jsonResponse(200, { success: true, result: [] });
        if (url.endsWith('/pages/assets/upsert-hashes')) return jsonResponse(200, { success: true });
        if (url.endsWith('/deployments') && init?.method === 'POST') {
          return jsonResponse(502, { success: false, errors: [{ message: 'deployment creation broke' }] });
        }
        throw new Error(`Unexpected fetch call: ${init?.method ?? 'GET'} ${url}`);
      }),
    );
    const target = new CloudflarePagesDeployTarget({ token: 'tok', accountId: 'acct' });
    await expect(target.publish({ files: [], projectName: 'demo' })).rejects.toThrow('deployment creation broke');
  });
});

describe('listCloudflarePagesZones — pagination fallback', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('falls back to comparing itemCount against perPage when result_info has no total_pages/total_count/count', async () => {
    let calls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        calls += 1;
        // A full page (itemCount === perPage) with no pagination hints at all
        // must still be treated as "there might be more" (line 267's
        // fallback), while a short final page stops.
        const items =
          calls === 1
            ? Array.from({ length: 5 }, (_, i) => ({ id: `z${i}`, name: `zone${i}.com`, status: 'active', type: 'full' }))
            : [{ id: 'z-last', name: 'last.com', status: 'active', type: 'full' }];
        return jsonResponse(200, { success: true, result: items, result_info: {} });
      }, ),
    );
    const { zones } = await listCloudflarePagesZones({ token: 'tok', accountId: 'acct' });
    // First page returned perPage(=100)? No — 5 < 100, so the fallback
    // `itemCount >= perPage` is false and pagination stops after page 1.
    expect(calls).toBe(1);
    expect(zones).toHaveLength(5);
  });

  it('keeps paginating via the itemCount-vs-perPage fallback when a page comes back exactly full', async () => {
    let calls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        calls += 1;
        if (calls === 1) {
          // Exactly perPage (100, the default) items with no pagination
          // hints: `itemCount >= perPage` is true, so it must fetch page 2.
          const items = Array.from({ length: 100 }, (_, i) => ({ id: `z${i}`, name: `zone${i}.com`, status: 'active', type: 'full' }));
          return jsonResponse(200, { success: true, result: items, result_info: {} });
        }
        // A short second page stops pagination (itemCount(1) < perPage(100)).
        return jsonResponse(200, { success: true, result: [{ id: 'z-last', name: 'last.com', status: 'active', type: 'full' }], result_info: {} });
      }),
    );
    const { zones } = await listCloudflarePagesZones({ token: 'tok', accountId: 'acct' });
    expect(calls).toBe(2);
    expect(zones).toHaveLength(101);
  });
});

describe('CloudflarePagesDeployTarget.publish — custom domain: DNS record reuse-by-patch and races', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function baseHandlers3(url: string, init: RequestInit | undefined): Response | undefined {
    if (/\/pages\/projects\/[^/]+$/.test(url) && (!init?.method || init.method === 'GET')) {
      return jsonResponse(200, { success: true, result: { name: 'jini-demo' } });
    }
    if (url.endsWith('/upload-token')) return jsonResponse(200, { success: true, result: { jwt: 'jwt' } });
    if (url.endsWith('/pages/assets/check-missing')) return jsonResponse(200, { success: true, result: [] });
    if (url.endsWith('/pages/assets/upsert-hashes')) return jsonResponse(200, { success: true });
    if (url.endsWith('/deployments') && init?.method === 'POST') {
      return jsonResponse(200, { success: true, result: { id: 'd1', url: 'jini-demo.pages.dev' } });
    }
    if (url.startsWith('https://jini-demo.pages.dev')) return new Response('', { status: 200 });
    if (url.includes('/zones/zone1') && !url.includes('dns_records')) {
      return jsonResponse(200, { success: true, result: { name: 'example.com', status: 'active', type: 'full' } });
    }
    return undefined;
  }

  it('patches a prior-owned CNAME record in place when its id/marker match this run\'s prior metadata', async () => {
    // publish({projectName:'demo'}) always derives config.projectName === 'jini-demo'
    // (asserted throughout this file's other tests), and the pages.dev target
    // is always `${config.projectName}.pages.dev` — both deterministic, so the
    // marker `canPatchCloudflarePagesCname` requires is computable up front.
    const marker = expectedCloudflareDnsMarker('jini-demo', 'jini-demo.pages.dev');
    let patchedBody: unknown;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        const url = String(input);
        const base = baseHandlers3(url, init);
        if (base) return base;
        if (url.includes('/zones/zone1/dns_records') && (!init?.method || init.method === 'GET')) {
          return jsonResponse(200, {
            success: true,
            result: [
              {
                id: 'prior-record-id',
                type: 'CNAME',
                name: 'demo.example.com',
                content: 'stale-target.pages.dev', // NOT the current target — no exact match
                comment: marker,
              },
            ],
          });
        }
        if (url.includes('/zones/zone1/dns_records/prior-record-id') && init?.method === 'PATCH') {
          patchedBody = JSON.parse(String(init.body));
          return jsonResponse(200, { success: true, result: { id: 'prior-record-id' } });
        }
        if (url.includes('/domains/demo.example.com')) return jsonResponse(404, { success: false });
        if (url.endsWith('/domains') && init?.method === 'POST') {
          return jsonResponse(200, { success: true, result: { name: 'demo.example.com', status: 'active' } });
        }
        if (url.startsWith('https://demo.example.com')) return new Response('', { status: 200 });
        throw new Error(`Unexpected fetch call: ${init?.method ?? 'GET'} ${url}`);
      }),
    );

    const target = new CloudflarePagesDeployTarget({ token: 'tok', accountId: 'acct' });
    const result = await target.publish({
      files: [],
      projectName: 'demo',
      metadata: {
        customDomain: { zoneId: 'zone1', zoneName: 'example.com', domainPrefix: 'demo' },
        priorCustomDomain: { dnsRecordId: 'prior-record-id', marker },
      },
    });

    expect(result.providerMetadata?.customDomain).toMatchObject({
      dnsStatus: 'patched',
      dnsRecordId: 'prior-record-id',
      dnsOwnership: 'marked',
      status: 'ready',
    });
    expect(patchedBody).toMatchObject({ type: 'CNAME', name: 'demo.example.com', content: 'jini-demo.pages.dev', comment: marker });
  });

  it('reports a conflict (not a patch) when a same-name record exists but its id/marker do not match prior metadata', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        const url = String(input);
        const base = baseHandlers3(url, init);
        if (base) return base;
        if (url.includes('/zones/zone1/dns_records') && (!init?.method || init.method === 'GET')) {
          return jsonResponse(200, {
            success: true,
            result: [{ id: 'someone-elses-record', type: 'CNAME', name: 'demo.example.com', content: 'unrelated.pages.dev', comment: 'not-ours' }],
          });
        }
        throw new Error(`Unexpected fetch call: ${init?.method ?? 'GET'} ${url}`);
      }),
    );
    const target = new CloudflarePagesDeployTarget({ token: 'tok', accountId: 'acct' });
    const result = await target.publish({
      files: [],
      projectName: 'demo',
      metadata: { customDomain: { zoneId: 'zone1', zoneName: 'example.com', domainPrefix: 'demo' } },
    });
    expect(result.providerMetadata?.customDomain).toMatchObject({ status: 'conflict', errorCode: 'cloudflare_dns_record_conflict' });
  });

  it('reuses a CNAME created by a racing publish when creation 409s as "already exists" and a re-list finds the exact match', async () => {
    let listCalls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        const url = String(input);
        const base = baseHandlers3(url, init);
        if (base) return base;
        if (url.includes('/zones/zone1/dns_records') && (!init?.method || init.method === 'GET')) {
          listCalls += 1;
          // First list (before create): nothing there yet.
          if (listCalls === 1) return jsonResponse(200, { success: true, result: [] });
          // Second list (after the raced create): the other publish's record now exists.
          return jsonResponse(200, {
            success: true,
            result: [{ id: 'raced-in-record', type: 'CNAME', name: 'demo.example.com', content: 'jini-demo.pages.dev', comment: 'other-run-marker' }],
          });
        }
        if (url.includes('/zones/zone1/dns_records') && init?.method === 'POST') {
          return jsonResponse(409, { success: false, errors: [{ message: 'record already exists' }] });
        }
        if (url.includes('/domains/demo.example.com')) return jsonResponse(404, { success: false });
        if (url.endsWith('/domains') && init?.method === 'POST') {
          return jsonResponse(200, { success: true, result: { name: 'demo.example.com', status: 'active' } });
        }
        if (url.startsWith('https://demo.example.com')) return new Response('', { status: 200 });
        throw new Error(`Unexpected fetch call: ${init?.method ?? 'GET'} ${url}`);
      }),
    );
    const target = new CloudflarePagesDeployTarget({ token: 'tok', accountId: 'acct' });
    const result = await target.publish({
      files: [],
      projectName: 'demo',
      metadata: { customDomain: { zoneId: 'zone1', zoneName: 'example.com', domainPrefix: 'demo' } },
    });
    expect(result.providerMetadata?.customDomain).toMatchObject({ dnsStatus: 'reused', status: 'ready' });
  });

  it('reports a conflict when creation races into "already exists" but the re-list finds a different, unrelated record', async () => {
    let listCalls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        const url = String(input);
        const base = baseHandlers3(url, init);
        if (base) return base;
        if (url.includes('/zones/zone1/dns_records') && (!init?.method || init.method === 'GET')) {
          listCalls += 1;
          if (listCalls === 1) return jsonResponse(200, { success: true, result: [] });
          return jsonResponse(200, {
            success: true,
            result: [{ id: 'unrelated', type: 'A', name: 'demo.example.com', content: '9.9.9.9' }],
          });
        }
        if (url.includes('/zones/zone1/dns_records') && init?.method === 'POST') {
          return jsonResponse(409, { success: false, errors: [{ message: 'record already exists' }] });
        }
        throw new Error(`Unexpected fetch call: ${init?.method ?? 'GET'} ${url}`);
      }),
    );
    const target = new CloudflarePagesDeployTarget({ token: 'tok', accountId: 'acct' });
    const result = await target.publish({
      files: [],
      projectName: 'demo',
      metadata: { customDomain: { zoneId: 'zone1', zoneName: 'example.com', domainPrefix: 'demo' } },
    });
    expect(result.providerMetadata?.customDomain).toMatchObject({ status: 'conflict', errorCode: 'cloudflare_dns_record_conflict' });
  });

  it('rethrows the original "already exists" error when a race is suspected but the re-list finds nothing at all', async () => {
    let listCalls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        const url = String(input);
        const base = baseHandlers3(url, init);
        if (base) return base;
        if (url.includes('/zones/zone1/dns_records') && (!init?.method || init.method === 'GET')) {
          listCalls += 1;
          return jsonResponse(200, { success: true, result: [] }); // still nothing, even on re-list
        }
        if (url.includes('/zones/zone1/dns_records') && init?.method === 'POST') {
          return jsonResponse(409, { success: false, errors: [{ message: 'record already exists, somehow' }] });
        }
        throw new Error(`Unexpected fetch call: ${init?.method ?? 'GET'} ${url}`);
      }),
    );
    const target = new CloudflarePagesDeployTarget({ token: 'tok', accountId: 'acct' });
    const result = await target.publish({
      files: [],
      projectName: 'demo',
      metadata: { customDomain: { zoneId: 'zone1', zoneName: 'example.com', domainPrefix: 'demo' } },
    });
    // The re-list found no record at all — the original DeployError propagates
    // as the DNS-setup failure captured into providerMetadata.
    expect(result.providerMetadata?.customDomain).toMatchObject({ status: 'failed', statusMessage: expect.stringContaining('already exists') });
  });

  it('retries without the comment field when Cloudflare rejects the comment field itself, and succeeds unmarked', async () => {
    let createAttempts = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        const url = String(input);
        const base = baseHandlers3(url, init);
        if (base) return base;
        if (url.includes('/zones/zone1/dns_records') && (!init?.method || init.method === 'GET')) {
          return jsonResponse(200, { success: true, result: [] });
        }
        if (url.includes('/zones/zone1/dns_records') && init?.method === 'POST') {
          createAttempts += 1;
          const body = JSON.parse(String(init.body));
          if (createAttempts === 1) {
            expect(body.comment).toBeDefined();
            return jsonResponse(400, { success: false, errors: [{ message: 'comment field is not supported on this plan' }] });
          }
          expect(body.comment).toBeUndefined();
          return jsonResponse(200, { success: true, result: { id: 'created-unmarked' } });
        }
        if (url.includes('/domains/demo.example.com')) return jsonResponse(404, { success: false });
        if (url.endsWith('/domains') && init?.method === 'POST') {
          return jsonResponse(200, { success: true, result: { name: 'demo.example.com', status: 'active' } });
        }
        if (url.startsWith('https://demo.example.com')) return new Response('', { status: 200 });
        throw new Error(`Unexpected fetch call: ${init?.method ?? 'GET'} ${url}`);
      }),
    );
    const target = new CloudflarePagesDeployTarget({ token: 'tok', accountId: 'acct' });
    const result = await target.publish({
      files: [],
      projectName: 'demo',
      metadata: { customDomain: { zoneId: 'zone1', zoneName: 'example.com', domainPrefix: 'demo' } },
    });
    expect(createAttempts).toBe(2);
    expect(result.providerMetadata?.customDomain).toMatchObject({ dnsStatus: 'created', dnsOwnership: 'unmarked', status: 'ready' });
  });

  it('reuses the racing record when the comment-field retry itself races into "already exists"', async () => {
    let createAttempts = 0;
    let listCalls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        const url = String(input);
        const base = baseHandlers3(url, init);
        if (base) return base;
        if (url.includes('/zones/zone1/dns_records') && (!init?.method || init.method === 'GET')) {
          listCalls += 1;
          if (listCalls === 1) return jsonResponse(200, { success: true, result: [] });
          return jsonResponse(200, {
            success: true,
            result: [{ id: 'raced-record-2', type: 'CNAME', name: 'demo.example.com', content: 'jini-demo.pages.dev', comment: '' }],
          });
        }
        if (url.includes('/zones/zone1/dns_records') && init?.method === 'POST') {
          createAttempts += 1;
          if (createAttempts === 1) {
            return jsonResponse(400, { success: false, errors: [{ message: 'comment field is not supported on this plan' }] });
          }
          return jsonResponse(409, { success: false, errors: [{ message: 'record already exists' }] });
        }
        if (url.includes('/domains/demo.example.com')) return jsonResponse(404, { success: false });
        if (url.endsWith('/domains') && init?.method === 'POST') {
          return jsonResponse(200, { success: true, result: { name: 'demo.example.com', status: 'active' } });
        }
        if (url.startsWith('https://demo.example.com')) return new Response('', { status: 200 });
        throw new Error(`Unexpected fetch call: ${init?.method ?? 'GET'} ${url}`);
      }),
    );
    const target = new CloudflarePagesDeployTarget({ token: 'tok', accountId: 'acct' });
    const result = await target.publish({
      files: [],
      projectName: 'demo',
      metadata: { customDomain: { zoneId: 'zone1', zoneName: 'example.com', domainPrefix: 'demo' } },
    });
    expect(createAttempts).toBe(2);
    expect(result.providerMetadata?.customDomain).toMatchObject({ dnsStatus: 'reused', status: 'ready' });
  });

  it('rethrows the comment-retry failure as-is when it is neither a duplicate nor a comment error', async () => {
    let createAttempts = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        const url = String(input);
        const base = baseHandlers3(url, init);
        if (base) return base;
        if (url.includes('/zones/zone1/dns_records') && (!init?.method || init.method === 'GET')) {
          return jsonResponse(200, { success: true, result: [] });
        }
        if (url.includes('/zones/zone1/dns_records') && init?.method === 'POST') {
          createAttempts += 1;
          if (createAttempts === 1) {
            return jsonResponse(400, { success: false, errors: [{ message: 'comment field is not supported on this plan' }] });
          }
          // The comment-retry's own failure is unrelated to duplicates or
          // comments — maybeReuseCloudflarePagesCnameAfterDuplicate bails out
          // (line 527) rather than rethrowing itself, so the outer catch's
          // own `throw retryErr` (line 593) is what actually surfaces it.
          return jsonResponse(500, { success: false, errors: [{ message: 'totally unrelated internal error' }] });
        }
        throw new Error(`Unexpected fetch call: ${init?.method ?? 'GET'} ${url}`);
      }),
    );
    const target = new CloudflarePagesDeployTarget({ token: 'tok', accountId: 'acct' });
    const result = await target.publish({
      files: [],
      projectName: 'demo',
      metadata: { customDomain: { zoneId: 'zone1', zoneName: 'example.com', domainPrefix: 'demo' } },
    });
    expect(createAttempts).toBe(2);
    expect(result.providerMetadata?.customDomain).toMatchObject({
      status: 'failed',
      statusMessage: expect.stringContaining('totally unrelated internal error'),
    });
  });

  it('throws the underlying DeployError when creation fails for a reason unrelated to duplicates or comments', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        const url = String(input);
        const base = baseHandlers3(url, init);
        if (base) return base;
        if (url.includes('/zones/zone1/dns_records') && (!init?.method || init.method === 'GET')) {
          return jsonResponse(200, { success: true, result: [] });
        }
        if (url.includes('/zones/zone1/dns_records') && init?.method === 'POST') {
          return jsonResponse(500, { success: false, errors: [{ message: 'internal server explosion' }] });
        }
        throw new Error(`Unexpected fetch call: ${init?.method ?? 'GET'} ${url}`);
      }),
    );
    const target = new CloudflarePagesDeployTarget({ token: 'tok', accountId: 'acct' });
    const result = await target.publish({
      files: [],
      projectName: 'demo',
      metadata: { customDomain: { zoneId: 'zone1', zoneName: 'example.com', domainPrefix: 'demo' } },
    });
    expect(result.providerMetadata?.customDomain).toMatchObject({ status: 'failed', statusMessage: expect.stringContaining('internal server explosion') });
  });

  it('captures a generic Cloudflare Pages domain-setup failure (not "already bound") into providerMetadata', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        const url = String(input);
        const base = baseHandlers3(url, init);
        if (base) return base;
        if (url.includes('/zones/zone1/dns_records') && (!init?.method || init.method === 'GET')) {
          return jsonResponse(200, { success: true, result: [] });
        }
        if (url.includes('/zones/zone1/dns_records') && init?.method === 'POST') {
          return jsonResponse(200, { success: true, result: { id: 'dns-ok' } });
        }
        if (url.includes('/domains/demo.example.com')) return jsonResponse(404, { success: false });
        if (url.endsWith('/domains') && init?.method === 'POST') {
          return jsonResponse(500, { success: false, errors: [{ message: 'domain setup exploded' }] });
        }
        throw new Error(`Unexpected fetch call: ${init?.method ?? 'GET'} ${url}`);
      }),
    );
    const target = new CloudflarePagesDeployTarget({ token: 'tok', accountId: 'acct' });
    const result = await target.publish({
      files: [],
      projectName: 'demo',
      metadata: { customDomain: { zoneId: 'zone1', zoneName: 'example.com', domainPrefix: 'demo' } },
    });
    expect(result.providerMetadata?.customDomain).toMatchObject({ status: 'failed', statusMessage: expect.stringContaining('domain setup exploded') });
  });

  it('reports the custom domain as failed when Cloudflare marks it error/blocked/deactivated', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        const url = String(input);
        const base = baseHandlers3(url, init);
        if (base) return base;
        if (url.includes('/zones/zone1/dns_records') && (!init?.method || init.method === 'GET')) {
          return jsonResponse(200, { success: true, result: [] });
        }
        if (url.includes('/zones/zone1/dns_records') && init?.method === 'POST') {
          return jsonResponse(200, { success: true, result: { id: 'dns-ok' } });
        }
        if (url.includes('/domains/demo.example.com')) return jsonResponse(404, { success: false });
        if (url.endsWith('/domains') && init?.method === 'POST') {
          return jsonResponse(200, { success: true, result: { name: 'demo.example.com', status: 'error' } });
        }
        throw new Error(`Unexpected fetch call: ${init?.method ?? 'GET'} ${url}`);
      }),
    );
    const target = new CloudflarePagesDeployTarget({ token: 'tok', accountId: 'acct' });
    const result = await target.publish({
      files: [],
      projectName: 'demo',
      metadata: { customDomain: { zoneId: 'zone1', zoneName: 'example.com', domainPrefix: 'demo' } },
    });
    expect(result.providerMetadata?.customDomain).toMatchObject({
      domainStatus: 'failed',
      status: 'failed',
      statusMessage: 'Cloudflare Pages reported a custom-domain error.',
    });
  });
});

describe('CloudflarePagesDeployTarget.publish — custom domain ready before pages.dev itself', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('reflects a not-yet-reachable pages.dev link even once the custom domain is ready (aggregate stays link-delayed)', async () => {
    // waitForReachableDeploymentUrl's pages.dev poll has no caller-exposed
    // timeout override from CloudflarePagesDeployTarget.publish(), so
    // forcing pages.dev to never become reachable means riding out its real
    // default 60s/2s poll — done here with fake timers instead of a real
    // 60-second test.
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        const url = String(input);
        if (/\/pages\/projects\/[^/]+$/.test(url) && (!init?.method || init.method === 'GET')) {
          return jsonResponse(200, { success: true, result: { name: 'jini-demo' } });
        }
        if (url.endsWith('/upload-token')) return jsonResponse(200, { success: true, result: { jwt: 'jwt' } });
        if (url.endsWith('/pages/assets/check-missing')) return jsonResponse(200, { success: true, result: [] });
        if (url.endsWith('/pages/assets/upsert-hashes')) return jsonResponse(200, { success: true });
        if (url.endsWith('/deployments') && init?.method === 'POST') {
          return jsonResponse(200, { success: true, result: { id: 'd1', url: 'jini-demo.pages.dev' } });
        }
        // The pages.dev link never comes up — every probe 500s.
        if (url.startsWith('https://jini-demo.pages.dev')) return new Response('', { status: 500 });
        if (url.includes('/zones/zone1') && !url.includes('dns_records')) {
          return jsonResponse(200, { success: true, result: { name: 'example.com', status: 'active', type: 'full' } });
        }
        if (url.includes('/zones/zone1/dns_records') && (!init?.method || init.method === 'GET')) {
          return jsonResponse(200, { success: true, result: [] });
        }
        if (url.includes('/zones/zone1/dns_records') && init?.method === 'POST') {
          return jsonResponse(200, { success: true, result: { id: 'dns-1' } });
        }
        if (url.includes('/domains/demo.example.com')) return jsonResponse(404, { success: false });
        if (url.endsWith('/domains') && init?.method === 'POST') {
          return jsonResponse(200, { success: true, result: { name: 'demo.example.com', status: 'active' } });
        }
        // The custom domain itself is reachable right away.
        if (url.startsWith('https://demo.example.com')) return new Response('', { status: 200 });
        throw new Error(`Unexpected fetch call: ${init?.method ?? 'GET'} ${url}`);
      }),
    );

    const target = new CloudflarePagesDeployTarget({ token: 'tok', accountId: 'acct' });
    const publishPromise = target.publish({
      files: [],
      projectName: 'demo',
      metadata: { customDomain: { zoneId: 'zone1', zoneName: 'example.com', domainPrefix: 'demo' } },
    });
    // Drive the pages.dev reachability poll (default 60s timeout, 2s
    // interval) to exhaustion without a real wall-clock wait.
    await vi.advanceTimersByTimeAsync(65_000);
    const result = await publishPromise;

    expect(result.status).toBe('link-delayed');
    expect(result.providerMetadata?.pagesDev).toMatchObject({ status: 'link-delayed' });
    expect(result.providerMetadata?.customDomain).toMatchObject({ status: 'ready', domainStatus: 'active' });
  }, 20_000);
});
