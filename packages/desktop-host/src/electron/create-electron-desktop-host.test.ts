import { describe, expect, it } from 'vitest';
import { createElectronDesktopHost } from './create-electron-desktop-host.js';
import { createFakeBrowserWindowFactory, createFakeElectronApp, createFakeElectronProtocol } from './testing.js';

describe('createElectronDesktopHost', () => {
  it('composes all DesktopHostPorts from fake Electron surfaces', () => {
    const { factory } = createFakeBrowserWindowFactory();
    const host = createElectronDesktopHost({
      app: createFakeElectronApp(),
      createBrowserWindow: factory,
      protocol: createFakeElectronProtocol(),
    });

    expect(host.backend).toBe('electron');
    expect(host.ports.singleInstance.claim).toBeTypeOf('function');
    expect(host.ports.windowLifecycle.createWindow).toBeTypeOf('function');
    expect(host.ports.protocolHandler.registerSchemeProxy).toBeTypeOf('function');
    expect(host.ports.sidecarLauncher.launch).toBeTypeOf('function');
    expect(host.ports.renderService.renderToPdf).toBeTypeOf('function');
    expect(host.ports.renderService.capture).toBeTypeOf('function');
    expect(host.ports.renderService.exportArtifact).toBeTypeOf('function');
  });

  it('accepts port overrides', () => {
    const { factory } = createFakeBrowserWindowFactory();
    const customSidecarLauncher = { launch: async () => { throw new Error('unused'); } };
    const host = createElectronDesktopHost(
      { app: createFakeElectronApp(), createBrowserWindow: factory, protocol: createFakeElectronProtocol() },
      { sidecarLauncher: customSidecarLauncher },
    );
    expect(host.ports.sidecarLauncher).toBe(customSidecarLauncher);
  });
});
