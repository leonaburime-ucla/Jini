import { app, BrowserWindow, dialog, protocol, shell } from 'electron';
import {
  createElectronDesktopHost,
  type ElectronDesktopHostSurfaces,
} from '@jini/desktop-host';

const rendererUrl = process.env.JINI_PLAYGROUND_URL ?? 'http://127.0.0.1:4173/?shell=desktop';

const surfaces = {
  app,
  protocol,
  shell,
  dialog,
  createBrowserWindow: (options: ElectronDesktopHostSurfaces['createBrowserWindow'] extends (
    value: infer Options,
  ) => unknown
    ? Options
    : never) =>
    new BrowserWindow({
      ...options,
      title: 'Jini Playground',
      minWidth: 840,
      minHeight: 620,
      backgroundColor: '#f4f2ed',
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
      webPreferences: {
        ...options.webPreferences,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    }),
} as unknown as ElectronDesktopHostSurfaces;

const host = createElectronDesktopHost(surfaces);
const ownsLock = host.ports.singleInstance.claim(() => host.ports.windowLifecycle.showMainWindow());

async function openMainWindow(): Promise<void> {
  if (host.ports.windowLifecycle.getMainWindow()) {
    host.ports.windowLifecycle.showMainWindow();
    return;
  }
  await host.ports.windowLifecycle.createWindow({
    url: rendererUrl,
    width: 1320,
    height: 820,
    show: true,
  });
}

if (ownsLock) {
  app.whenReady().then(() => openMainWindow());

  app.on('activate', () => {
    void openMainWindow();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
