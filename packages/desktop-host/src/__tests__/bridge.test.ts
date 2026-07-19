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
} from '../bridge.js';
import { createMockJiniHost, installMockJiniHost } from '../bridge-testing.js';

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

  it('rejects a bridge whose client is not a record', () => {
    const host = createMockJiniHost();
    expect(isJiniHostBridge({ ...host, client: 'electron' })).toBe(false);
    expect(isJiniHostBridge({ ...host, client: null })).toBe(false);
  });

  it('rejects a non-string client.platform', () => {
    const host = createMockJiniHost();
    expect(isJiniHostBridge({ ...host, client: { ...host.client, platform: 123 } })).toBe(false);
  });

  it('accepts a string client.osLocale and rejects a non-string one', () => {
    const host = createMockJiniHost();
    expect(isJiniHostBridge({ ...host, client: { ...host.client, osLocale: 'en-US' } })).toBe(true);
    expect(isJiniHostBridge({ ...host, client: { ...host.client, osLocale: 42 } })).toBe(false);
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

  it('the default mock shell.openPath resolves ok without an override', async () => {
    const uninstall = installMockJiniHost();
    expect(await openHostPath('/tmp/default-open-path')).toEqual({ ok: true });
    uninstall();
  });

  it('installs on both a custom scope and a distinct nested scope.window', () => {
    const windowObject: Record<string, unknown> = {};
    const scope = { window: windowObject } as JiniHostGlobalScope;
    const uninstall = installMockJiniHost({ scope });
    expect(Object.prototype.hasOwnProperty.call(scope, JINI_HOST_GLOBAL)).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(windowObject, JINI_HOST_GLOBAL)).toBe(true);
    uninstall();
    expect(Object.prototype.hasOwnProperty.call(scope, JINI_HOST_GLOBAL)).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(windowObject, JINI_HOST_GLOBAL)).toBe(false);
  });

  it('uninstall restores a value that existed on the target before install, rather than deleting it', () => {
    const previousHost = { marker: 'pre-existing' };
    (globalThis as Record<string, unknown>)[JINI_HOST_GLOBAL] = previousHost;
    const uninstall = installMockJiniHost();
    expect(isJiniHostAvailable()).toBe(true);
    uninstall();
    expect((globalThis as Record<string, unknown>)[JINI_HOST_GLOBAL]).toBe(previousHost);
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

  it('openHostPath succeeds against an installed host and reports unavailable when the bridge throws', async () => {
    const uninstall = installMockJiniHost({
      host: { shell: { openPath: async () => ({ ok: true }) } },
    });
    expect(await openHostPath('/tmp/x')).toEqual({ ok: true });
    uninstall();

    const uninstallThrowingError = installMockJiniHost({
      host: {
        shell: {
          openPath: async () => {
            throw new Error('path does not exist');
          },
        },
      },
    });
    expect(await openHostPath('/tmp/missing')).toEqual({ ok: false, reason: 'path does not exist' });
    uninstallThrowingError();

    const uninstallThrowingNonError = installMockJiniHost({
      host: {
        shell: {
          openPath: async () => {
            throw 'permission denied';
          },
        },
      },
    });
    expect(await openHostPath('/root/x')).toEqual({ ok: false, reason: 'permission denied' });
    uninstallThrowingNonError();
  });

  it('openHostExternalUrl reports unavailable when the bridge throws (Error and non-Error)', async () => {
    const uninstallError = installMockJiniHost({
      host: {
        shell: {
          openExternal: async () => {
            throw new Error('no default browser configured');
          },
        },
      },
    });
    expect(await openHostExternalUrl('https://example.test')).toEqual({ ok: false, reason: 'no default browser configured' });
    uninstallError();

    const uninstallNonError = installMockJiniHost({
      host: {
        shell: {
          openExternal: async () => {
            throw 'not a URL';
          },
        },
      },
    });
    expect(await openHostExternalUrl('not-a-url')).toEqual({ ok: false, reason: 'not a URL' });
    uninstallNonError();
  });

  it('checkJiniHostUpdaterAvailability reports unavailable when the host build has no updater extension point', async () => {
    const uninstall = installMockJiniHost();
    expect(await checkJiniHostUpdaterAvailability()).toEqual({
      ok: false,
      reason: 'host build does not support the updater extension point',
    });
    uninstall();
  });

  it('checkJiniHostUpdaterAvailability reports unavailable when the bridge throws (Error and non-Error)', async () => {
    const uninstallError = installMockJiniHost({
      host: {
        updater: {
          checkAvailability: async () => {
            throw new Error('updater channel unreachable');
          },
        },
      },
    });
    expect(await checkJiniHostUpdaterAvailability()).toEqual({ ok: false, reason: 'updater channel unreachable' });
    uninstallError();

    const uninstallNonError = installMockJiniHost({
      host: {
        updater: {
          checkAvailability: async () => {
            throw 'updater unreachable';
          },
        },
      },
    });
    expect(await checkJiniHostUpdaterAvailability()).toEqual({ ok: false, reason: 'updater unreachable' });
    uninstallNonError();
  });
});
