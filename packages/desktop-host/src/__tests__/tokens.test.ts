import { describe, expect, it } from 'vitest';
import {
  ProtocolHandlerToken,
  RenderServiceToken,
  ShellToken,
  SidecarLauncherToken,
  SingleInstanceLockToken,
  WindowLifecycleToken,
} from '../tokens.js';

describe('desktop-host DI tokens', () => {
  it('defines one token per DesktopHostPorts entry, each with a stable jini.desktopHost.* id', () => {
    expect(SingleInstanceLockToken).toEqual({ id: 'jini.desktopHost.singleInstanceLock', version: 1, cardinality: 'one' });
    expect(WindowLifecycleToken).toEqual({ id: 'jini.desktopHost.windowLifecycle', version: 1, cardinality: 'one' });
    expect(ProtocolHandlerToken).toEqual({ id: 'jini.desktopHost.protocolHandler', version: 1, cardinality: 'one' });
    expect(SidecarLauncherToken).toEqual({ id: 'jini.desktopHost.sidecarLauncher', version: 1, cardinality: 'one' });
    expect(RenderServiceToken).toEqual({ id: 'jini.desktopHost.renderService', version: 1, cardinality: 'one' });
    expect(ShellToken).toEqual({ id: 'jini.desktopHost.shell', version: 1, cardinality: 'one' });
  });

  it('gives every token a distinct id', () => {
    const ids = [
      SingleInstanceLockToken,
      WindowLifecycleToken,
      ProtocolHandlerToken,
      SidecarLauncherToken,
      RenderServiceToken,
      ShellToken,
    ].map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
