/**
 * `RenderService` backed by a hidden `BrowserWindow` and Electron's native
 * `webContents.printToPDF`/`capturePage` — per the task brief, this
 * package must NOT reimplement PDF/PNG rendering, only wire up what
 * Electron already does natively. Not a port of OD's `deck-capture.ts`/
 * `pdf-export.ts` (those are design/slide-specific business logic that
 * would layer on top of this same port OD-side).
 */
import {
  RenderServiceError,
  htmlToDataUrl,
  isOriginAllowed,
  withRenderTimeout,
  type CaptureOptions,
  type RenderOptions,
  type RenderService,
  type RenderToPdfOptions,
} from '../render-service.js';
import type { ElectronBrowserWindowFactory, ElectronBrowserWindowLike, ElectronWebContentsLike } from './electron-surfaces.js';

function waitForLoad(webContents: ElectronWebContentsLike): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    webContents.once('did-finish-load', () => resolve());
    webContents.once('did-fail-load', (_event, errorCode, errorDescription) => {
      reject(new RenderServiceError(`failed to load render document: ${errorDescription} (${errorCode})`, 'load-failed'));
    });
  });
}

function attachResourcePolicy(webContents: ElectronWebContentsLike, policy: RenderOptions['resourcePolicy']): void {
  if (policy?.allowNavigation !== true) {
    webContents.on('will-navigate', (event) => event.preventDefault());
  }
  if (policy?.allowedOrigins != null) {
    const allowedOrigins = policy.allowedOrigins;
    webContents.session.webRequest.onBeforeRequest((details, callback) => {
      callback({ cancel: !isOriginAllowed(details.url, allowedOrigins) });
    });
  }
}

async function withRenderWindow<T>(
  createBrowserWindow: ElectronBrowserWindowFactory,
  html: string,
  options: RenderOptions,
  run: (win: ElectronBrowserWindowLike) => Promise<T>,
): Promise<T> {
  const win = createBrowserWindow({
    show: false,
    width: options.viewport?.width ?? 1024,
    height: options.viewport?.height ?? 768,
    webPreferences: { javascript: options.resourcePolicy?.javascript ?? true },
  });
  try {
    const task = (async () => {
      attachResourcePolicy(win.webContents, options.resourcePolicy);
      const loaded = waitForLoad(win.webContents);
      await win.loadURL(htmlToDataUrl(html));
      await loaded;
      return await run(win);
    })();
    return await withRenderTimeout(task, options.timeoutMs, options.signal);
  } finally {
    if (!win.isDestroyed()) win.destroy();
  }
}

export function createElectronRenderService(createBrowserWindow: ElectronBrowserWindowFactory): RenderService {
  return {
    async renderToPdf(html: string, options: RenderToPdfOptions = {}): Promise<Uint8Array> {
      const buffer = await withRenderWindow(createBrowserWindow, html, options, (win) =>
        win.webContents.printToPDF({
          landscape: options.landscape ?? false,
          printBackground: options.printBackground ?? true,
          ...(options.pageWidth != null && options.pageHeight != null
            ? { pageSize: { width: options.pageWidth, height: options.pageHeight } }
            : {}),
          ...(options.margins == null ? {} : { margins: options.margins }),
        }),
      );
      return new Uint8Array(buffer);
    },

    async capture(html: string, options: CaptureOptions = {}): Promise<Uint8Array> {
      const image = await withRenderWindow(createBrowserWindow, html, options, (win) => win.webContents.capturePage(options.clip));
      return new Uint8Array(image.toPNG());
    },

    async exportArtifact(_html, options): Promise<unknown> {
      throw new RenderServiceError(`exportArtifact format "${options.format}" is not implemented by the Electron adapter`, 'not-implemented');
    },
  };
}
