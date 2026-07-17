import { createNodeSidecarLauncher } from '../sidecar.js';
import type { DesktopHost, DesktopHostPorts } from '../ports.js';
import { createElectronSingleInstanceLockPort } from './electron-single-instance.js';
import { createElectronWindowLifecyclePort } from './electron-window-lifecycle.js';
import { createElectronProtocolHandlerPort } from './electron-protocol.js';
import { createElectronRenderService } from './electron-render-service.js';
import { createElectronShellPort } from './electron-shell.js';
import type { ElectronAppLike, ElectronBrowserWindowFactory, ElectronProtocolLike, ElectronShellLike } from './electron-surfaces.js';

export interface ElectronDesktopHostSurfaces {
  app: ElectronAppLike;
  createBrowserWindow: ElectronBrowserWindowFactory;
  protocol: ElectronProtocolLike;
  shell: ElectronShellLike;
}

export function createElectronDesktopHost(
  surfaces: ElectronDesktopHostSurfaces,
  overrides: Partial<DesktopHostPorts> = {},
): DesktopHost {
  const ports: DesktopHostPorts = {
    singleInstance: overrides.singleInstance ?? createElectronSingleInstanceLockPort(surfaces.app),
    windowLifecycle: overrides.windowLifecycle ?? createElectronWindowLifecyclePort(surfaces.createBrowserWindow),
    protocolHandler: overrides.protocolHandler ?? createElectronProtocolHandlerPort(surfaces.protocol),
    sidecarLauncher: overrides.sidecarLauncher ?? createNodeSidecarLauncher(),
    renderService: overrides.renderService ?? createElectronRenderService(surfaces.createBrowserWindow),
    shell: overrides.shell ?? createElectronShellPort(surfaces.shell),
  };
  return { backend: 'electron', ports };
}
