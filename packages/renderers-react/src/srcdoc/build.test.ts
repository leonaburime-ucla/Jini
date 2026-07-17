import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SRC_DOC_CSP,
  buildLazySrcDocTransport,
  buildSrcDoc,
  canActivateSrcDocTransport,
  injectAfterHeadOpen,
  injectBeforeBodyEnd,
  injectBeforeHeadEnd,
  sanitizePreviewTitle,
  sanitizeTitleInDoc,
} from './build.js';
import type { SrcDocBridge } from './bridge.js';

describe('sanitizePreviewTitle', () => {
  it('replaces filesystem-unsafe characters with a hyphen', () => {
    expect(sanitizePreviewTitle('Q3: Report / Draft')).toBe('Q3- Report - Draft');
  });

  it('strips a leading ~$ lock-file prefix, including doubled prefixes', () => {
    expect(sanitizePreviewTitle('~$~$Invoice')).toBe('Invoice');
  });

  it('leaves an already-safe title untouched', () => {
    expect(sanitizePreviewTitle('Weekly Update')).toBe('Weekly Update');
  });
});

describe('sanitizeTitleInDoc', () => {
  it('sanitizes the real <title> in the head', () => {
    const doc = '<!doctype html><html><head><title>Bad: Title?</title></head><body></body></html>';
    expect(sanitizeTitleInDoc(doc)).toContain('<title>Bad- Title-</title>');
  });

  it('ignores a <title>-like string inside a <script> block', () => {
    const doc =
      '<!doctype html><html><head><script>var s = "<title>fake</title>";</script></head><body></body></html>';
    expect(sanitizeTitleInDoc(doc)).toBe(doc);
  });

  it('decodes HTML entities, then re-sanitizes the decoded result (& is itself a disallowed filename character)', () => {
    const doc = '<html><head><title>Caf&eacute; &amp; Bar</title></head><body></body></html>';
    expect(sanitizeTitleInDoc(doc)).toContain('<title>Café - Bar</title>');
  });

  it('returns the input unchanged when there is no <title>', () => {
    const doc = '<html><head></head><body>hi</body></html>';
    expect(sanitizeTitleInDoc(doc)).toBe(doc);
  });
});

describe('splice helpers', () => {
  it('injectAfterHeadOpen splices right after <head>', () => {
    expect(injectAfterHeadOpen('<html><head><meta/></head></html>', '<X/>')).toBe(
      '<html><head><X/><meta/></head></html>',
    );
  });

  it('injectAfterHeadOpen prepends when there is no <head>', () => {
    expect(injectAfterHeadOpen('<div/>', '<X/>')).toBe('<X/><div/>');
  });

  it('injectBeforeHeadEnd splices right before the real </head>', () => {
    expect(injectBeforeHeadEnd('<html><head><meta/></head><body></body></html>', '<X/>')).toBe(
      '<html><head><meta/><X/></head><body></body></html>',
    );
  });

  it('injectBeforeHeadEnd ignores a </head> literal inside a <script>', () => {
    const doc = '<html><head><script>"</head>"</script></head><body></body></html>';
    expect(injectBeforeHeadEnd(doc, '<X/>')).toBe(
      '<html><head><script>"</head>"</script><X/></head><body></body></html>',
    );
  });

  it('injectBeforeBodyEnd splices right before the real </body>', () => {
    expect(injectBeforeBodyEnd('<html><body><p>hi</p></body></html>', '<X/>')).toBe(
      '<html><body><p>hi</p><X/></body></html>',
    );
  });
});

describe('buildSrcDoc', () => {
  it('wraps a bare fragment in a minimal document', () => {
    const doc = buildSrcDoc('<p>hi</p>');
    expect(doc).toContain('<!doctype html>');
    expect(doc).toContain('<p>hi</p>');
  });

  it('passes a full document through without re-wrapping', () => {
    const doc = buildSrcDoc('<!doctype html><html><head></head><body><p>hi</p></body></html>');
    expect(doc.match(/<html>/g)).toHaveLength(1);
  });

  it('injects the default strict CSP by default', () => {
    const doc = buildSrcDoc('<p>hi</p>');
    expect(doc).toContain('Content-Security-Policy');
    expect(doc).toContain(DEFAULT_SRC_DOC_CSP);
  });

  it('skips CSP injection when csp is false', () => {
    const doc = buildSrcDoc('<p>hi</p>', { csp: false });
    expect(doc).not.toContain('Content-Security-Policy');
  });

  it('accepts a custom CSP string', () => {
    const doc = buildSrcDoc('<p>hi</p>', { csp: "default-src 'self'" });
    expect(doc).toContain("default-src 'self'");
  });

  it('always injects the same-origin sandbox shim', () => {
    expect(buildSrcDoc('<p>hi</p>')).toContain('data-jini-sandbox-shim');
  });

  it('injects the focus guard only when requested', () => {
    expect(buildSrcDoc('<p>hi</p>')).not.toContain('data-jini-preview-focus-guard');
    expect(buildSrcDoc('<p>hi</p>', { previewFocusGuard: true })).toContain('data-jini-preview-focus-guard');
  });

  it('injects a <base href> when provided', () => {
    expect(buildSrcDoc('<p>hi</p>', { baseHref: 'https://example.com/artifact/' })).toContain(
      '<base href="https://example.com/artifact/">',
    );
  });

  it('runs registered bridges in order and tolerates a throwing bridge', () => {
    const ok: SrcDocBridge = { id: 'ok', inject: (doc) => doc.replace('</body>', '<div id="ok"></div></body>') };
    const broken: SrcDocBridge = {
      id: 'broken',
      inject: () => {
        throw new Error('nope');
      },
    };
    const doc = buildSrcDoc('<p>hi</p>', { bridges: [ok, broken] });
    expect(doc).toContain('<div id="ok"></div>');
  });

  it('always ends with the srcdoc-transport-activation listener', () => {
    expect(buildSrcDoc('<p>hi</p>')).toContain('data-jini-srcdoc-transport-activation');
  });

  it('returns the lazy transport shell when lazyTransport is set', () => {
    expect(buildSrcDoc('<p>hi</p>', { lazyTransport: true })).toBe(buildLazySrcDocTransport());
  });
});

describe('buildLazySrcDocTransport', () => {
  it('builds a shell that listens for the activation message and announces readiness', () => {
    const shell = buildLazySrcDocTransport();
    expect(shell).toContain('jini:srcdoc-transport-activate');
    expect(shell).toContain('jini:srcdoc-transport-ready');
  });
});

describe('canActivateSrcDocTransport', () => {
  const base = { srcDoc: '<p>hi</p>', useUrlLoadPreview: false, useLazyTransport: true, shellReady: true, activatedHtml: null };

  it('activates when every condition is met', () => {
    expect(canActivateSrcDocTransport(base)).toBe(true);
  });

  it('refuses with no srcDoc', () => {
    expect(canActivateSrcDocTransport({ ...base, srcDoc: '' })).toBe(false);
  });

  it('refuses while the URL-load preview is showing', () => {
    expect(canActivateSrcDocTransport({ ...base, useUrlLoadPreview: true })).toBe(false);
  });

  it('refuses when not using the lazy transport', () => {
    expect(canActivateSrcDocTransport({ ...base, useLazyTransport: false })).toBe(false);
  });

  it('refuses before the shell announces readiness', () => {
    expect(canActivateSrcDocTransport({ ...base, shellReady: false })).toBe(false);
  });

  it('refuses to re-activate the same HTML twice', () => {
    expect(canActivateSrcDocTransport({ ...base, activatedHtml: base.srcDoc })).toBe(false);
  });
});
