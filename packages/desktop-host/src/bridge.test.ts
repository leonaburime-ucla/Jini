import { afterEach, describe, expect, it } from 'vitest';
import {
  checkJiniHostUpdaterAvailability,
  detectJiniHostClientType,
  getJiniHost,
  isJiniHostAvailable,
  isJiniHostBridge,
  JINI_HOST_GLOBAL,
  JINI_HOST_VERSION,
  openHostExternalUrl,
  openHostPath,
  type JiniHostGlobalScope,
} from './bridge.js';
import { createMockJiniHost, installMockJiniHost } from './bridge-testing.js';

describe('isJiniHostBridge', () => {
  it('accepts a well-formed bridge', () => {
    expect(isJiniHostBridge(createMockJiniHost())).toBe(true);
  });

  it('rejects a bridge with the wrong version', () => {
    expect(isJiniHostBridge({ ...createMockJiniHost(), version: 99 })).toBe(false);
  });

  it('rejects an unknown client type', () => {
    const host = createMockJiniHost();
    expect(isJiniHostBridge({ ...host, client: { ...host.client, type: 'carrier-pigeon' } })).toBe(false);
  });

  it('rejects a bridge missing shell methods', () => {
    const host = createMockJiniHost();
    expect(isJiniHostBridge({ ...host, shell: {} })).toBe(false);
  });

  it('accepts a bridge with no updater namespace (extension point, not required)', () => {
    const host = createMockJiniHost();
    expect(host.updater).toBeUndefined();
    expect(isJiniHostBridge(host)).toBe(true);
  });

  it('rejects a malformed updater namespace when one is present', () => {
    const host = createMockJiniHost();
    expect(isJiniHostBridge({ ...host, updater: {} })).toBe(false);
    expect(isJiniHostBridge({ ...host, updater: { checkAvailability: async () => ({ available: true }) } })).toBe(true);
  });

  it('rejects non-objects', () => {
    expect(isJiniHostBridge(null)).toBe(false);
    expect(isJiniHostBridge('nope')).toBe(false);
  });
});

describe('getJiniHost / isJiniHostAvailable / detectJiniHostClientType', () => {
  it('finds the bridge directly on the scope or nested under scope.window', () => {
    const host = createMockJiniHost();
    const directScope = { [JINI_HOST_GLOBAL]: host } as JiniHostGlobalScope;
    expect(getJiniHost(directScope)).toEqual(host);

    const nestedScope = { window: { [JINI_HOST_GLOBAL]: host } } as JiniHostGlobalScope;
    expect(getJiniHost(nestedScope)).toEqual(host);
  });

  it('returns null and reports unavailable when nothing is installed', () => {
    const emptyScope = {} as JiniHostGlobalScope;
    expect(getJiniHost(emptyScope)).toBeNull();
    expect(isJiniHostAvailable(emptyScope)).toBe(false);
    expect(detectJiniHostClientType(emptyScope)).toBe('web');
  });

  it('detects the client type of an installed bridge', () => {
    const scope = { [JINI_HOST_GLOBAL]: createMockJiniHost({ client: { type: 'tauri' } }) } as JiniHostGlobalScope;
    expect(detectJiniHostClientType(scope)).toBe('tauri');
  });
});

describe('installMockJiniHost', () => {
  afterEach(() => {
    delete (globalThis as Record<string, unknown>)[JINI_HOST_GLOBAL];
  });

  it('installs and uninstalls a mock host on globalThis', async () => {
    expect(isJiniHostAvailable()).toBe(false);
    const uninstall = installMockJiniHost();
    expect(isJiniHostAvailable()).toBe(true);
    expect((getJiniHost() as { version: number }).version).toBe(JINI_HOST_VERSION);

    const result = await openHostExternalUrl('https://example.test');
    expect(result).toEqual({ ok: true });

    uninstall();
    expect(isJiniHostAvailable()).toBe(false);
  });

  it('action wrappers report unavailable when no host is installed', async () => {
    expect(await openHostExternalUrl('https://example.test')).toMatchObject({ ok: false });
    expect(await openHostPath('/tmp/x')).toMatchObject({ ok: false });
    expect(await checkJiniHostUpdaterAvailability()).toMatchObject({ ok: false });
  });

  it('checkJiniHostUpdaterAvailability calls through when the extension point is wired', async () => {
    const uninstall = installMockJiniHost({
      host: { updater: { checkAvailability: async () => ({ available: true }) } },
    });
    expect(await checkJiniHostUpdaterAvailability()).toEqual({ available: true });
    uninstall();
  });
});
