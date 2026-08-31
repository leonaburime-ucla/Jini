/**
 * `SANDBOX_PROXY_HTML` is a page whose entire job is to `document.write` HTML it receives over
 * `postMessage` — i.e. to execute script on whatever origin a host serves it from. The guard on
 * that listener IS the trust boundary (see the module's own doc), and it is a string constant no
 * type checker or linter looks inside, so these tests pin the guard's exact source text. The first
 * version of this file shipped with no guard at all.
 */
import { describe, expect, it } from 'vitest';

import { SANDBOX_PROXY_HTML } from '../sandbox-proxy.js';

describe('SANDBOX_PROXY_HTML', () => {
  it('accepts a resource message only from the embedding window, on the serving origin', () => {
    expect(SANDBOX_PROXY_HTML).toContain('return event.source === host && event.origin === hostOrigin;');
    expect(SANDBOX_PROXY_HTML).toContain('if (!isFromHost(event)) return;');
  });

  it('registers nothing at all when it is not framed, closing the window.open path', () => {
    expect(SANDBOX_PROXY_HTML).toContain('var host = window.parent;\n  var hostOrigin = window.location.origin;\n  if (host === window) return;');
  });

  it('addresses the ready notification to the serving origin instead of broadcasting it', () => {
    expect(SANDBOX_PROXY_HTML).toContain(
      'host.postMessage({ method: "ui/notifications/sandbox-proxy-ready", params: {} }, hostOrigin);',
    );
    expect(SANDBOX_PROXY_HTML).not.toContain('params: {} }, "*")');
  });

  it('still writes the guest HTML into this same document — the single-hop shape every surface bridge assumes', () => {
    expect(SANDBOX_PROXY_HTML).toContain('document.open();\n    document.write(html);\n    document.close();');
  });
});
