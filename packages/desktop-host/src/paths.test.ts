import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DesktopHostPathError, resolveDesktopHostPathRoots } from './paths.js';

describe('resolveDesktopHostPathRoots', () => {
  it('derives the standard subroots under namespaceBaseRoot/namespace', () => {
    const roots = resolveDesktopHostPathRoots({ namespace: 'stable', namespaceBaseRoot: '/base', env: {} });
    expect(roots.namespaceRoot).toBe(join('/base', 'stable'));
    expect(roots.dataRoot).toBe(join('/base', 'stable', 'data'));
    expect(roots.cacheRoot).toBe(join('/base', 'stable', 'cache'));
    expect(roots.logsRoot).toBe(join('/base', 'stable', 'logs'));
    expect(roots.runtimeRoot).toBe(join('/base', 'stable', 'runtime'));
    expect(roots.userDataRoot).toBe(join('/base', 'stable', 'user-data'));
    expect(roots.sessionDataRoot).toBe(join('/base', 'stable', 'user-data', 'session'));
  });

  it('honors an absolute data-dir override env var', () => {
    const roots = resolveDesktopHostPathRoots({
      namespace: 'stable',
      namespaceBaseRoot: '/base',
      dataDirOverrideEnvVar: 'JINI_DATA_DIR',
      env: { JINI_DATA_DIR: '/custom/data' },
    });
    expect(roots.dataRoot).toBe(join('/custom/data', 'namespaces', 'stable', 'data'));
  });

  it('throws when the override is not absolute', () => {
    expect(() =>
      resolveDesktopHostPathRoots({
        namespace: 'stable',
        namespaceBaseRoot: '/base',
        dataDirOverrideEnvVar: 'JINI_DATA_DIR',
        env: { JINI_DATA_DIR: 'relative/path' },
      }),
    ).toThrow(DesktopHostPathError);
  });

  it('throws when a namespace-scoped override targets a different namespace', () => {
    expect(() =>
      resolveDesktopHostPathRoots({
        namespace: 'stable',
        namespaceBaseRoot: '/base',
        dataDirOverrideEnvVar: 'JINI_DATA_DIR',
        env: { JINI_DATA_DIR: join('/x', 'namespaces', 'beta', 'data') },
      }),
    ).toThrow(/targets namespace "beta"/);
  });

  it('accepts a namespace-scoped override that matches the active namespace', () => {
    const scoped = join('/x', 'namespaces', 'stable', 'data');
    const roots = resolveDesktopHostPathRoots({
      namespace: 'stable',
      namespaceBaseRoot: '/base',
      dataDirOverrideEnvVar: 'JINI_DATA_DIR',
      env: { JINI_DATA_DIR: scoped },
    });
    expect(roots.dataRoot).toBe(scoped);
  });
});
