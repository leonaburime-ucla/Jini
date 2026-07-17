import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeployError } from './types.js';
import {
  CloudflarePagesDeployTarget,
  chunkCloudflarePagesAssetUploads,
  cloudflarePagesAssetHash,
  listCloudflarePagesZones,
} from './cloudflare-pages.js';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
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
