import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMcpIdleExitController, extractRelativeRefs, isTextualMime } from '../client.js';

describe('createMcpIdleExitController', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires onIdle once after the idle window elapses', () => {
    vi.useFakeTimers();
    const onIdle = vi.fn();
    const c = createMcpIdleExitController({ idleMs: 1000, onIdle });
    vi.advanceTimersByTime(999);
    expect(onIdle).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onIdle).toHaveBeenCalledTimes(1);
    c.dispose();
  });

  it('noteActivity resets the idle timer', () => {
    vi.useFakeTimers();
    const onIdle = vi.fn();
    const c = createMcpIdleExitController({ idleMs: 1000, onIdle });
    vi.advanceTimersByTime(600);
    c.noteActivity();
    vi.advanceTimersByTime(600);
    expect(onIdle).not.toHaveBeenCalled();
    vi.advanceTimersByTime(400);
    expect(onIdle).toHaveBeenCalledTimes(1);
    c.dispose();
  });

  it('defers idle while a request is in flight, then re-arms once it settles', async () => {
    vi.useFakeTimers();
    const onIdle = vi.fn();
    const c = createMcpIdleExitController({ idleMs: 1000, onIdle });
    let resolveFn!: (v: string) => void;
    const p = c.trackRequest(() => new Promise<string>((r) => { resolveFn = r; }));
    // Timer fires while the request is still in flight -> re-schedule, no idle.
    vi.advanceTimersByTime(1000);
    expect(onIdle).not.toHaveBeenCalled();
    resolveFn('done');
    await expect(p).resolves.toBe('done');
    // Now idle again from a clean re-arm.
    vi.advanceTimersByTime(1000);
    expect(onIdle).toHaveBeenCalledTimes(1);
    c.dispose();
  });

  it('does not re-arm while other requests remain in flight', async () => {
    vi.useFakeTimers();
    const onIdle = vi.fn();
    const c = createMcpIdleExitController({ idleMs: 1000, onIdle });
    let r1!: (v: string) => void;
    let r2!: (v: string) => void;
    const p1 = c.trackRequest(() => new Promise<string>((r) => { r1 = r; }));
    const p2 = c.trackRequest(() => new Promise<string>((r) => { r2 = r; }));
    r1('a');
    await expect(p1).resolves.toBe('a');
    // One request still in flight, so no idle should be scheduled/fire yet.
    vi.advanceTimersByTime(1000);
    expect(onIdle).not.toHaveBeenCalled();
    r2('b');
    await expect(p2).resolves.toBe('b');
    c.dispose();
  });

  it('after dispose, trackRequest runs directly, noteActivity is a no-op, and re-dispose is safe', async () => {
    vi.useFakeTimers();
    const onIdle = vi.fn();
    const c = createMcpIdleExitController({ idleMs: 1000, onIdle });
    c.dispose();
    await expect(c.trackRequest(() => 'direct')).resolves.toBe('direct');
    c.noteActivity();
    c.dispose();
    vi.advanceTimersByTime(5000);
    expect(onIdle).not.toHaveBeenCalled();
  });
});

describe('isTextualMime', () => {
  it('classifies textual mimes across the pattern set', () => {
    for (const mime of [
      'text/html',
      'text/css',
      'application/json',
      'application/javascript',
      'application/typescript',
      'application/xml',
      'application/x-yaml',
      'application/vnd.api+json',
      'application/xhtml+xml',
      'image/svg+xml',
    ]) {
      expect(isTextualMime(mime)).toBe(true);
    }
  });

  it('rejects binary and absent mimes', () => {
    expect(isTextualMime('application/octet-stream')).toBe(false);
    expect(isTextualMime('image/png')).toBe(false);
    expect(isTextualMime(undefined)).toBe(false);
  });
});

describe('extractRelativeRefs', () => {
  it('returns [] for empty text', () => {
    expect(extractRelativeRefs('', 'index.html', 'text/html')).toEqual([]);
  });

  it('extracts HTML/CSS refs, resolves against a nested dir, and dedupes', () => {
    const html = [
      '<script src="app.js"></script>',
      '<link href="styles/site.css">',
      '<img src="/img/logo.png">',
      '<img srcset="a.png 1x, b.png 2x, ">',
      '<source src="v.mp4">',
      '<video src="v2.mp4">',
      '<audio src="a.mp3">',
      '<iframe src="frame.html">',
      '<a href="https://cdn.example.com/x.js">',
      '<img src="data:image/png;base64,xxx">',
      '<img src="   ">',
      '<script src="./dup.js"></script>',
      '<script src="dup.js"></script>',
    ].join('\n');
    const refs = extractRelativeRefs(html, 'pages/index.html', 'text/html');
    expect(refs).toContain('pages/app.js');
    expect(refs).toContain('pages/styles/site.css');
    expect(refs).toContain('img/logo.png'); // rooted "/img/logo.png"
    expect(refs).toContain('pages/a.png');
    expect(refs).toContain('pages/b.png');
    expect(refs).toContain('pages/v.mp4');
    expect(refs).toContain('pages/frame.html');
    expect(refs).toContain('pages/dup.js');
    // skipped: cdn, data:, whitespace-only
    expect(refs).not.toContain('https://cdn.example.com/x.js');
    // deduped
    expect(refs.filter((r) => r === 'pages/dup.js')).toHaveLength(1);
  });

  it('handles CSS url()/@import, parent traversal, root-rooted refs, and dot-only refs', () => {
    const css = [
      '@import url("base.css");',
      ".a { background: url('img/bg.png'); }",
      '.b { background: url(../shared/x.png); }',
      '.c { background: url(/root.png); }',
      '.d { background: url(../../escape.png); }',
      '.e { background: url(.); }',
    ].join('\n');
    const refs = extractRelativeRefs(css, 'styles/main.css', 'text/css');
    expect(refs).toContain('styles/base.css');
    expect(refs).toContain('styles/img/bg.png');
    expect(refs).toContain('shared/x.png'); // ../shared/x.png from styles/
    expect(refs).toContain('root.png'); // /root.png
    expect(refs).not.toContain('escape.png'); // ../../ escapes the root
  });

  it('extracts JS/TS import/require/dynamic-import specifiers', () => {
    const js = [
      "import a from './a.js';",
      'import { b } from "b/mod.js";',
      "const c = require('./c.js');",
      'const d = await import("d.js");',
      "export { x } from './x.js';",
      "import 'https://cdn/y.js';",
    ].join('\n');
    const refs = extractRelativeRefs(js, 'src/index.js', 'application/javascript');
    expect(refs).toEqual(expect.arrayContaining(['src/a.js', 'src/b/mod.js', 'src/c.js', 'src/d.js', 'src/x.js']));
    expect(refs).not.toContain('https://cdn/y.js');
  });

  it('falls back to url() extraction for unknown textual types and a root-level file (empty dir)', () => {
    const refs = extractRelativeRefs('body { background: url(only.css) }', 'notes.txt', 'text/plain');
    expect(refs).toEqual(['only.css']);
  });

  it('selects pattern sets by extension when the mime is blank', () => {
    expect(extractRelativeRefs('<img src="a.png">', 'page.htm', '')).toEqual(['a.png']);
    expect(extractRelativeRefs('.a{background:url(a.png)}', 'a.css', '')).toEqual(['a.png']);
    expect(extractRelativeRefs("import x from './m.tsx'", 'a.tsx', '')).toEqual(['m.tsx']);
  });

  it('recognizes typescript mime as JS-like', () => {
    expect(extractRelativeRefs("import x from './m.ts'", 'a.unknownext', 'application/typescript')).toEqual(['m.ts']);
  });
});
