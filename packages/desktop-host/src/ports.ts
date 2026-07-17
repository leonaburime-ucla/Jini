/**
 * The shared port set both backends compose against — scope 1's shell
 * primitives plus scope 3's `RenderService`. `createElectronDesktopHost`/
 * `createTauriDesktopHost` each build one of these from their own native
 * surfaces, following the same "compose bound implementations behind one
 * object" shape as `createDaemon({ packs, bindings })`
 * (`packages/core/src/daemon.ts`) — simpler here because a desktop host
 * has a fixed, small port set rather than an open-ended set of packs, so
 * a plain factory function stands in for the pack/bindings machinery.
 */
import type { SingleInstanceLockPort } from './single-instance.js';
import type { WindowLifecyclePort } from './window-lifecycle.js';
import type { ProtocolHandlerPort } from './protocol.js';
import type { SidecarLauncherPort } from './sidecar.js';
import type { RenderService } from './render-service.js';
import type { ShellPort } from './shell.js';

export interface DesktopHostPorts {
  singleInstance: SingleInstanceLockPort;
  windowLifecycle: WindowLifecyclePort;
  protocolHandler: ProtocolHandlerPort;
  sidecarLauncher: SidecarLauncherPort;
  renderService: RenderService;
  shell: ShellPort;
}

export interface DesktopHost {
  readonly backend: 'electron' | 'tauri';
  readonly ports: DesktopHostPorts;
}
