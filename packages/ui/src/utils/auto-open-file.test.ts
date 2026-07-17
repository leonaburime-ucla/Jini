import { describe, expect, it } from 'vitest';
import { decideAutoOpenAfterWrite, selectAutoOpenProducedArtifact } from './auto-open-file.js';

describe('decideAutoOpenAfterWrite', () => {
  const files = [
    { name: 'App.jsx', path: 'src/App.jsx' },
    { name: 'index.html', path: 'index.html' },
  ];

  it('opens on an exact path match', () => {
    expect(decideAutoOpenAfterWrite('src/App.jsx', files)).toEqual({
      shouldOpen: true,
      fileName: 'App.jsx',
    });
  });

  it('opens on a full-segment suffix match', () => {
    expect(decideAutoOpenAfterWrite('/abs/project/src/App.jsx', files)).toEqual({
      shouldOpen: true,
      fileName: 'App.jsx',
    });
  });

  it('declines a partial-segment suffix match (notsubdir vs subdir)', () => {
    const withSubdir = [{ name: 'App.jsx', path: 'subdir/App.jsx' }];
    expect(decideAutoOpenAfterWrite('/abs/notsubdir/App.jsx', withSubdir)).toEqual({
      shouldOpen: false,
      fileName: null,
    });
  });

  it('declines when multiple files share a path suffix', () => {
    // Both an exact match and a shorter suffix match resolve against the
    // same filePath — genuinely ambiguous, so neither should win.
    const ambiguous = [
      { name: 'a', path: 'a/b/App.jsx' },
      { name: 'b', path: 'b/App.jsx' },
    ];
    expect(decideAutoOpenAfterWrite('a/b/App.jsx', ambiguous).shouldOpen).toBe(false);
  });

  it('falls back to a unique basename match when filePath has no slash', () => {
    expect(decideAutoOpenAfterWrite('index.html', files)).toEqual({
      shouldOpen: true,
      fileName: 'index.html',
    });
  });

  it('declines a basename-only match when filePath has a slash but no suffix match', () => {
    expect(decideAutoOpenAfterWrite('/some/external/App.jsx', files).shouldOpen).toBe(false);
  });

  it('declines an empty filePath', () => {
    expect(decideAutoOpenAfterWrite('', files)).toEqual({ shouldOpen: false, fileName: null });
  });

  it('declines a resolved candidate that is a module file', () => {
    expect(
      decideAutoOpenAfterWrite('src/App.jsx', files, { moduleFileNames: new Set(['App.jsx']) }),
    ).toEqual({ shouldOpen: false, fileName: null });
  });
});

describe('selectAutoOpenProducedArtifact', () => {
  it('returns null when nothing is previewable', () => {
    expect(selectAutoOpenProducedArtifact([{ name: 'data.json' }])).toBeNull();
  });

  it('prefers html over markdown', () => {
    const files = [
      { name: 'README.md', mtime: 2 },
      { name: 'index.html', mtime: 1 },
    ];
    expect(selectAutoOpenProducedArtifact(files)).toBe('index.html');
  });

  it('breaks ties within the same rank by newest mtime', () => {
    const files = [
      { name: 'a.html', mtime: 1 },
      { name: 'b.html', mtime: 5 },
    ];
    expect(selectAutoOpenProducedArtifact(files)).toBe('b.html');
  });

  it('with preferSiteEntry, picks the shallowest index.html', () => {
    const files = [
      { name: 'sub', path: 'zh/index.html', mtime: 5 },
      { name: 'root', path: 'index.html', mtime: 1 },
    ];
    expect(
      selectAutoOpenProducedArtifact(files, { preferSiteEntry: true }),
    ).toBe('root');
  });

  it('preferSiteEntry falls back to standard rank/mtime when no index.html exists', () => {
    const files = [{ name: 'page.html', mtime: 1 }];
    expect(selectAutoOpenProducedArtifact(files, { preferSiteEntry: true })).toBe('page.html');
  });
});
