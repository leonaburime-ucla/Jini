import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeployError } from '../types.js';
import { VercelDeployTarget, isVercelProtectedResponse } from '../vercel.js';

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
}

describe('isVercelProtectedResponse', () => {
  it('detects Vercel SSO nonce cookie as a protected-link signal', () => {
    const resp = new Response('', { headers: { 'set-cookie': '_vercel_sso_nonce=abc; Path=/' } });
    expect(isVercelProtectedResponse(resp)).toBe(true);
  });

  it('detects the Vercel Authentication body text as a protected-link signal', () => {
    const resp = new Response('', {});
    expect(isVercelProtectedResponse(resp, 'Vercel Authentication required to view this deployment')).toBe(true);
  });

  it('returns false for a plain unrelated 401', () => {
    const resp = new Response('', {});
    expect(isVercelProtectedResponse(resp, 'unauthorized')).toBe(false);
  });
});

describe('VercelDeployTarget.publish', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('throws DeployError without making a network call when token is missing', async () => {
    const target = new VercelDeployTarget({ token: '' });
    await expect(target.publish({ files: [], projectName: 'demo' })).rejects.toThrow(DeployError);
  });

  it('creates a deployment, polls until READY, and returns the reachable URL', async () => {
    const createBody = { id: 'dpl_1', readyState: 'QUEUED', url: 'demo-abc123.vercel.app' };
    const readyBody = { id: 'dpl_1', readyState: 'READY', url: 'demo-abc123.vercel.app' };

    const fetchSpy = vi.fn(async (input: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        // Assert the deployment name was sanitized from the caller's projectName.
        const parsed = JSON.parse(String(init.body));
        expect(parsed.name).toBe('my-demo-site');
        return jsonResponse(200, createBody);
      }
      if (String(input).includes('/v13/deployments/dpl_1')) {
        return jsonResponse(200, readyBody);
      }
      // Reachability probe against the deployment URL.
      return new Response('', { status: 200 });
    });
    vi.stubGlobal('fetch', fetchSpy);

    const target = new VercelDeployTarget({ token: 'tok' });
    const result = await target.publish({
      files: [{ file: 'index.html', data: '<html></html>', contentType: 'text/html' }],
      projectName: 'My Demo Site!!',
    });

    expect(result.targetId).toBe('vercel');
    expect(result.deploymentId).toBe('dpl_1');
    expect(result.status).toBe('ready');
    expect(result.url).toBe('https://demo-abc123.vercel.app');
  });

  it('throws DeployError when Vercel reports readyState ERROR', async () => {
    const createBody = { id: 'dpl_2', readyState: 'QUEUED', url: 'demo.vercel.app' };
    const errorBody = { id: 'dpl_2', readyState: 'ERROR', error: { message: 'Build failed' } };

    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: string, init?: RequestInit) => {
        if (init?.method === 'POST') return jsonResponse(200, createBody);
        return jsonResponse(200, errorBody);
      }),
    );

    const target = new VercelDeployTarget({ token: 'tok' });
    await expect(
      target.publish({ files: [{ file: 'index.html', data: 'x' }], projectName: 'demo' }),
    ).rejects.toThrow('Build failed');
  });

  it('surfaces a permission-denied Vercel error with a friendly message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(403, { error: { code: 'forbidden', message: 'no access' } })),
    );

    const target = new VercelDeployTarget({ token: 'tok' });
    await expect(
      target.publish({ files: [{ file: 'index.html', data: 'x' }], projectName: 'demo' }),
    ).rejects.toThrow("You don't have permission to create a project.");
  });
});
