import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import {
  CATALOGUE,
  applicableForPlatform,
  currentPlatform,
  hostEditorsRoute,
  launchHostTool,
  listAvailableEditors,
  pathDirs,
  probeCommandOnPath,
  probeMacBundle,
  registerHostToolsRoutes,
  resolveEntry,
  resolveHostToolLaunchPlan,
  type CatalogueEntry,
  type HostToolProbeEnv,
} from '../host-tools.js';

interface MockApp {
  get: (path: string, handler: any) => void;
  handlers: Record<string, (req: any, res: any) => Promise<void> | void>;
}

function makeApp(): MockApp {
  const handlers: MockApp['handlers'] = {};
  return { get: (path, handler) => { handlers[`GET ${path}`] = handler; }, handlers };
}

function makeRes() {
  return { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
}

/** Narrows a `resolveEntry` result to its `available: true` variant, or fails the test. */
function expectAvailable<T extends { available: boolean }>(result: T): Extract<T, { available: true }> {
  if (!result.available) throw new Error('expected an available ResolvedEntry, got unavailable');
  return result as Extract<T, { available: true }>;
}

/** Builds a probe env whose `access` succeeds only for paths in `exists`. */
function probeEnv(overrides: Partial<HostToolProbeEnv> & { exists?: readonly string[] } = {}): HostToolProbeEnv {
  const exists = new Set(overrides.exists ?? []);
  return {
    access: overrides.access ?? (async (path: string) => {
      if (!exists.has(path)) throw new Error(`ENOENT: ${path}`);
    }),
    env: overrides.env ?? {},
    platform: overrides.platform ?? 'linux',
  };
}

describe('currentPlatform', () => {
  it.each([
    ['darwin', 'darwin'],
    ['win32', 'win32'],
    ['linux', 'linux'],
    ['aix', 'unknown'],
    ['freebsd', 'unknown'],
  ] as const)('maps process.platform %s to %s', (nodePlatform, expected) => {
    expect(currentPlatform(nodePlatform)).toBe(expected);
  });
});

describe('applicableForPlatform', () => {
  const base: CatalogueEntry = { id: 'x', label: 'X', icon: 'x' };

  it('is false for the unknown platform regardless of entry restrictions', () => {
    expect(applicableForPlatform(base, 'unknown')).toBe(false);
  });

  it('is false when the entry restricts to platforms that do not include this one', () => {
    expect(applicableForPlatform({ ...base, platforms: ['darwin'] }, 'linux')).toBe(false);
  });

  it('is true when the entry restricts to platforms that include this one', () => {
    expect(applicableForPlatform({ ...base, platforms: ['darwin', 'linux'] }, 'linux')).toBe(true);
  });

  it('is false when this platform is explicitly excluded', () => {
    expect(applicableForPlatform({ ...base, excludedPlatforms: ['linux'] }, 'linux')).toBe(false);
  });

  it('is true for an entry with no platform restriction at all', () => {
    expect(applicableForPlatform(base, 'linux')).toBe(true);
  });
});

describe('pathDirs', () => {
  it('splits PATH on ":" and appends darwin extras including HOME/.local/bin', () => {
    const dirs = pathDirs(probeEnv({ platform: 'darwin', env: { PATH: '/a:/b', HOME: '/home/me' } }));
    expect(dirs).toContain('/a');
    expect(dirs).toContain('/b');
    expect(dirs).toContain('/opt/homebrew/bin');
    expect(dirs).toContain('/home/me/.local/bin');
  });

  it('splits PATH on ":" and appends linux extras', () => {
    const dirs = pathDirs(probeEnv({ platform: 'linux', env: { PATH: '/a' } }));
    expect(dirs).toContain('/a');
    expect(dirs).toContain('/usr/local/bin');
    expect(dirs).not.toContain('/opt/homebrew/bin');
  });

  it('splits PATH on ";" on win32 and adds no extras', () => {
    const dirs = pathDirs(probeEnv({ platform: 'win32', env: { PATH: 'C:\\a;C:\\b' } }));
    expect(dirs).toEqual(['C:\\a', 'C:\\b']);
  });

  it('filters out empty segments (no PATH set, no HOME set)', () => {
    const dirs = pathDirs(probeEnv({ platform: 'win32', env: {} }));
    expect(dirs.every((d) => d.length > 0)).toBe(true);
  });
});

describe('probeCommandOnPath', () => {
  it('checks an absolute command path directly and returns it when accessible', async () => {
    const env = probeEnv({ exists: ['/usr/bin/open'] });
    expect(await probeCommandOnPath('/usr/bin/open', env)).toBe('/usr/bin/open');
  });

  it('returns null for an absolute command path that is not accessible', async () => {
    const env = probeEnv({ exists: [] });
    expect(await probeCommandOnPath('/usr/bin/open', env)).toBeNull();
  });

  it('finds a bare command in one of the PATH directories', async () => {
    const env = probeEnv({ platform: 'linux', env: { PATH: '/a:/b' }, exists: ['/b/cursor'] });
    expect(await probeCommandOnPath('cursor', env)).toBe('/b/cursor');
  });

  it('returns null when a bare command is in none of the PATH directories', async () => {
    const env = probeEnv({ platform: 'linux', env: { PATH: '/a:/b' }, exists: [] });
    expect(await probeCommandOnPath('cursor', env)).toBeNull();
  });

  it('tries windows suffixes (.exe/.cmd/.bat) on win32', async () => {
    const env = probeEnv({ platform: 'win32', env: { PATH: 'C:\\a' }, exists: ['C:\\a/code.cmd'] });
    expect(await probeCommandOnPath('code', env)).toBe('C:\\a/code.cmd');
  });
});

describe('probeMacBundle', () => {
  it('returns null immediately on a non-darwin platform', async () => {
    const env = probeEnv({ platform: 'linux' });
    expect(await probeMacBundle('Cursor', env)).toBeNull();
  });

  it('finds a single-name bundle at the first candidate location', async () => {
    const env = probeEnv({ platform: 'darwin', exists: ['/Applications/Cursor.app'] });
    expect(await probeMacBundle('Cursor', env)).toEqual({ name: 'Cursor', path: '/Applications/Cursor.app' });
  });

  it('finds the second name in an array of candidate bundle names', async () => {
    const env = probeEnv({ platform: 'darwin', exists: ['/Applications/QoderWork.app'] });
    expect(await probeMacBundle(['Qoder', 'QoderWork'], env)).toEqual({ name: 'QoderWork', path: '/Applications/QoderWork.app' });
  });

  it('returns null when no candidate name/location matches', async () => {
    const env = probeEnv({ platform: 'darwin', exists: [] });
    expect(await probeMacBundle(['Qoder', 'QoderWork'], env)).toBeNull();
  });
});

describe('resolveEntry', () => {
  it('resolves via the CLI shim when present on PATH', async () => {
    const entry: CatalogueEntry = { id: 'cursor', label: 'Cursor', icon: 'x', command: 'cursor' };
    const env = probeEnv({ platform: 'linux', env: { PATH: '/a' }, exists: ['/a/cursor'] });
    const result = expectAvailable(await resolveEntry(entry, env));
    expect(result.resolvedPath).toBe('/a/cursor');
    expect(result.launch.argsForDir('/work')).toEqual(['/work']);
  });

  it('uses a custom commandArgs function when the entry provides one', async () => {
    const entry: CatalogueEntry = { id: 'finder', label: 'Finder', icon: 'x', command: '/usr/bin/open', commandArgs: (dir) => ['-R', dir] };
    const env = probeEnv({ platform: 'darwin', exists: ['/usr/bin/open'] });
    const result = expectAvailable(await resolveEntry(entry, env));
    expect(result.launch.argsForDir('/work')).toEqual(['-R', '/work']);
  });

  it('is unavailable when the command is missing and there is no mac bundle fallback', async () => {
    const entry: CatalogueEntry = { id: 'cursor', label: 'Cursor', icon: 'x', command: 'cursor' };
    const env = probeEnv({ platform: 'linux', env: {}, exists: [] });
    expect(await resolveEntry(entry, env)).toEqual({ available: false });
  });

  it('is unavailable when the mac bundle fallback exists but the platform is not darwin', async () => {
    const entry: CatalogueEntry = { id: 'cursor', label: 'Cursor', icon: 'x', command: 'cursor', macOpenBundle: 'Cursor' };
    const env = probeEnv({ platform: 'linux', exists: [] });
    expect(await resolveEntry(entry, env)).toEqual({ available: false });
  });

  it('falls back to the mac bundle when the CLI shim is missing on darwin', async () => {
    const entry: CatalogueEntry = { id: 'cursor', label: 'Cursor', icon: 'x', command: 'cursor', macOpenBundle: 'Cursor' };
    const env = probeEnv({ platform: 'darwin', exists: ['/usr/bin/open', '/Applications/Cursor.app'] });
    const result = expectAvailable(await resolveEntry(entry, env));
    expect(result.resolvedPath).toBe('/Applications/Cursor.app');
    expect(result.launch.command).toBe('/usr/bin/open');
    expect(result.launch.argsForDir('/work')).toEqual(['-a', 'Cursor', '/work']);
  });

  it('falls back to probing PATH for "open" when /usr/bin/open itself is inaccessible', async () => {
    const entry: CatalogueEntry = { id: 'cursor', label: 'Cursor', icon: 'x', command: 'cursor', macOpenBundle: 'Cursor' };
    const env = probeEnv({ platform: 'darwin', env: { PATH: '/opt/bin' }, exists: ['/opt/bin/open', '/Applications/Cursor.app'] });
    const result = expectAvailable(await resolveEntry(entry, env));
    expect(result.launch.command).toBe('/opt/bin/open');
  });

  it('falls back to the hardcoded /usr/bin/open path when neither direct access nor a PATH probe finds "open"', async () => {
    const entry: CatalogueEntry = { id: 'cursor', label: 'Cursor', icon: 'x', command: 'cursor', macOpenBundle: 'Cursor' };
    const env = probeEnv({ platform: 'darwin', env: { PATH: '/opt/bin' }, exists: ['/Applications/Cursor.app'] });
    const result = expectAvailable(await resolveEntry(entry, env));
    expect(result.launch.command).toBe('/usr/bin/open');
  });

  it('uses macOpenArgs when the entry provides a custom one', async () => {
    const entry: CatalogueEntry = {
      id: 'cursor',
      label: 'Cursor',
      icon: 'x',
      macOpenBundle: 'Cursor',
      macOpenArgs: (bundleName, dir) => ['--custom', bundleName, dir],
    };
    const env = probeEnv({ platform: 'darwin', exists: ['/usr/bin/open', '/Applications/Cursor.app'] });
    const result = expectAvailable(await resolveEntry(entry, env));
    expect(result.launch.argsForDir('/work')).toEqual(['--custom', 'Cursor', '/work']);
  });

  it('is unavailable when the mac bundle fallback is not found either', async () => {
    const entry: CatalogueEntry = { id: 'cursor', label: 'Cursor', icon: 'x', command: 'cursor', macOpenBundle: 'Cursor' };
    const env = probeEnv({ platform: 'darwin', exists: [] });
    expect(await resolveEntry(entry, env)).toEqual({ available: false });
  });

  it('is unavailable for an entry with neither a command nor a mac bundle', async () => {
    const entry: CatalogueEntry = { id: 'mystery', label: 'Mystery', icon: 'x' };
    expect(await resolveEntry(entry, probeEnv())).toEqual({ available: false });
  });
});

describe('resolveHostToolLaunchPlan', () => {
  it('is unavailable for an unknown editor id', async () => {
    expect(await resolveHostToolLaunchPlan('nonexistent', '/work', probeEnv())).toEqual({ available: false });
  });

  it('resolves a concrete command/args plan for a known, installed editor', async () => {
    const env = probeEnv({ platform: 'linux', env: { PATH: '/a' }, exists: ['/a/code'] });
    const plan = await resolveHostToolLaunchPlan('vscode', '/work', env);
    expect(plan).toEqual({ available: true, resolvedPath: '/a/code', command: '/a/code', args: ['/work'] });
  });

  it('is unavailable (no resolvedPath leaking through) for a known but uninstalled editor', async () => {
    const env = probeEnv({ platform: 'linux', env: {}, exists: [] });
    expect(await resolveHostToolLaunchPlan('vscode', '/work', env)).toEqual({ available: false });
  });
});

describe('CATALOGUE', () => {
  it('has a unique id for every entry', () => {
    const ids = CATALOGUE.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("the real 'finder' entry's own commandArgs reveals rather than opens its target directory", async () => {
    const finder = CATALOGUE.find((e) => e.id === 'finder')!;
    const env = probeEnv({ platform: 'darwin', exists: ['/usr/bin/open'] });
    const result = expectAvailable(await resolveEntry(finder, env));
    expect(result.launch.argsForDir('/work')).toEqual(['-R', '/work']);
  });
});

describe('listAvailableEditors', () => {
  it('filters to entries applicable for the platform and reports availability', async () => {
    const env = probeEnv({ platform: 'win32', env: { PATH: 'C:\\a' }, exists: ['C:\\a/explorer'] });
    const result = await listAvailableEditors(env);
    expect(result.platform).toBe('win32');
    // darwin-only entries (finder/terminal/warp/xcode) must not appear on win32.
    expect(result.editors.some((e) => e.id === 'finder')).toBe(false);
    const explorer = result.editors.find((e) => e.id === 'explorer');
    expect(explorer).toEqual({ id: 'explorer', label: 'Explorer', icon: 'folder', available: true, resolvedPath: 'C:\\a/explorer', platforms: ['win32'] });
    const cursor = result.editors.find((e) => e.id === 'cursor');
    expect(cursor?.available).toBe(false);
    expect(cursor).not.toHaveProperty('resolvedPath');
  });
});

describe('launchHostTool', () => {
  function fakeSpawn(behavior: 'spawn' | 'error', errorMessage = 'ENOENT') {
    return vi.fn(() => {
      const child = new EventEmitter() as any;
      child.unref = vi.fn();
      queueMicrotask(() => {
        if (behavior === 'spawn') child.emit('spawn');
        else child.emit('error', new Error(errorMessage));
      });
      return child;
    });
  }

  it('resolves ok:true once the OS confirms the process actually started', async () => {
    const spawnImpl = fakeSpawn('spawn');
    const result = await launchHostTool('/bin/echo', ['hi'], spawnImpl as any);
    expect(result).toEqual({ ok: true });
    expect(spawnImpl).toHaveBeenCalledTimes(1);
  });

  it('resolves ok:false with the error message when the OS refuses the launch', async () => {
    const spawnImpl = fakeSpawn('error', 'EACCES');
    const result = await launchHostTool('/bin/nope', [], spawnImpl as any);
    expect(result).toEqual({ ok: false, error: 'EACCES' });
  });

  it('ignores a second "error" event after "spawn" has already settled the promise', async () => {
    const spawnImpl = vi.fn(() => {
      const child = new EventEmitter() as any;
      child.unref = vi.fn();
      queueMicrotask(() => {
        child.emit('spawn');
        child.emit('error', new Error('too late'));
      });
      return child;
    });
    const result = await launchHostTool('/bin/echo', [], spawnImpl as any);
    expect(result).toEqual({ ok: true });
  });

  it('ignores a second "spawn" event after "error" has already settled the promise', async () => {
    const spawnImpl = vi.fn(() => {
      const child = new EventEmitter() as any;
      child.unref = vi.fn();
      queueMicrotask(() => {
        child.emit('error', new Error('refused'));
        child.emit('spawn');
      });
      return child;
    });
    const result = await launchHostTool('/bin/echo', [], spawnImpl as any);
    expect(result).toEqual({ ok: false, error: 'refused' });
  });

  it('stringifies a non-Error value emitted on "error"', async () => {
    const spawnImpl = vi.fn(() => {
      const child = new EventEmitter() as any;
      child.unref = vi.fn();
      queueMicrotask(() => child.emit('error', 'plain string failure'));
      return child;
    });
    const result = await launchHostTool('/bin/echo', [], spawnImpl as any);
    expect(result).toEqual({ ok: false, error: 'plain string failure' });
  });
});

describe('hostEditorsRoute', () => {
  it('parses with no input required', () => {
    expect(hostEditorsRoute.parse({ body: {}, query: {}, params: {} })).toEqual({ ok: true, value: undefined });
  });

  it('handle() returns the real listAvailableEditors() result shape', async () => {
    const result = await hostEditorsRoute.handle(undefined, {});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Array.isArray(result.value.editors)).toBe(true);
      expect(typeof result.value.platform).toBe('string');
    }
  });
});

describe('registerHostToolsRoutes', () => {
  it('mounts exactly GET /api/editors', async () => {
    const app = makeApp();
    registerHostToolsRoutes(app as any, { resolvedPortRef: { current: 0 } } as any);
    expect(Object.keys(app.handlers)).toEqual(['GET /api/editors']);
    const res = makeRes();
    await app.handlers['GET /api/editors']!({ body: {}, query: {}, params: {} }, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
