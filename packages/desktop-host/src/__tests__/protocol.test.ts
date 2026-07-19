import { describe, expect, it } from 'vitest';
import {
  buildProtocolProxyTargetUrl,
  handleProtocolProxyRequest,
  schemeEntryUrl,
  type ProtocolProxyErrorBody,
} from '../protocol.js';

describe('buildProtocolProxyTargetUrl', () => {
  it('rewrites the incoming scheme/host onto the target base url, keeping path/search/hash', () => {
    const target = buildProtocolProxyTargetUrl('http://127.0.0.1:4000/', 'jini://app/foo/bar?x=1#y');
    expect(target).toBe('http://127.0.0.1:4000/foo/bar?x=1#y');
  });
});

describe('handleProtocolProxyRequest', () => {
  it('proxies the request to the rewritten target url', async () => {
    let sawUrl: string | null = null;
    const response = await handleProtocolProxyRequest(
      new Request('jini://app/hello'),
      'http://127.0.0.1:4000/',
      async (req) => {
        sawUrl = req.url;
        return new Response('ok');
      },
    );
    expect(sawUrl).toBe('http://127.0.0.1:4000/hello');
    expect(await response.text()).toBe('ok');
  });

  it('returns a generic 502 JSON error, never OD-branded, on fetch failure', async () => {
    const response = await handleProtocolProxyRequest(new Request('jini://app/hello'), 'http://127.0.0.1:4000/', async () => {
      throw new Error('boom');
    });
    expect(response.status).toBe(502);
    const body = (await response.json()) as ProtocolProxyErrorBody;
    expect(body.error).toBe('JINI_PROTOCOL_PROXY_FAILED');
    expect(body.message).toBe('boom');
  });

  it('includes the error code when the thrown Error carries a string `code` (e.g. an errno-style failure)', async () => {
    const response = await handleProtocolProxyRequest(new Request('jini://app/hello'), 'http://127.0.0.1:4000/', async () => {
      throw Object.assign(new Error('connect failed'), { code: 'ECONNREFUSED' });
    });
    expect(response.status).toBe(502);
    const body = (await response.json()) as ProtocolProxyErrorBody;
    expect(body.message).toBe('connect failed');
    expect(body.code).toBe('ECONNREFUSED');
  });

  it('stringifies a non-Error throw and omits `code` entirely', async () => {
    const response = await handleProtocolProxyRequest(new Request('jini://app/hello'), 'http://127.0.0.1:4000/', async () => {
      // eslint-disable-next-line @typescript-eslint/no-throw-literal
      throw 'raw string failure';
    });
    expect(response.status).toBe(502);
    const body = (await response.json()) as ProtocolProxyErrorBody;
    expect(body.message).toBe('raw string failure');
    expect(body.code).toBeUndefined();
  });
});

describe('schemeEntryUrl', () => {
  it('builds an entry url for the given scheme', () => {
    expect(schemeEntryUrl('jini')).toBe('jini://app/');
  });
});
