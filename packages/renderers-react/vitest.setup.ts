import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Unmounts every React tree rendered by @testing-library/react between
// tests so DOM assertions never see leftover markup from a previous test.
afterEach(() => {
  cleanup();
});

// jsdom does not implement `window.matchMedia`. `shiki.ts`'s `isDarkMode`
// calls it unconditionally as part of its light/dark theme detection; this
// stub always reports "no preference" so tests can exercise `highlightCode`
// without a real browser.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

// jsdom does not implement `URL.createObjectURL`/`revokeObjectURL`.
// `annotation-canvas`'s `useAnnotationCanvas` hook calls these to build
// thumbnail previews for attached images; this stub returns a stable fake
// URL per call so tests can exercise that flow without a real browser.
let fakeObjectUrlCounter = 0;
if (typeof URL !== 'undefined' && !URL.createObjectURL) {
  URL.createObjectURL = () => `blob:jini-fake-${(fakeObjectUrlCounter += 1)}`;
}
if (typeof URL !== 'undefined' && !URL.revokeObjectURL) {
  URL.revokeObjectURL = () => {};
}

// jsdom implements zero canvas rendering by design (real 2D drawing needs the
// native `canvas` npm package, a heavy Cairo/Pango-backed addon this repo
// deliberately doesn't take on). `annotation-canvas`'s drawing/redraw logic
// (`drawing.ts`, `useAnnotationCanvas`'s `redraw`/`compositeWithBackground`)
// is unit-tested against a hand-rolled fake `CanvasRenderingContext2D`
// passed in directly (see `drawing.test.ts`'s `fakeCtx()`), but the *hook's
// own* browser-capability guard (`typeof window.CanvasRenderingContext2D ===
// 'undefined'`) and its calls to `canvas.getContext('2d')`/`canvas.toBlob`
// need real global stubs to exercise end-to-end through a mounted
// `<AnnotationCanvas>` or a hook test with a real canvas ref assigned. These
// stubs support exactly the drawing calls this package's own code makes —
// they are not a general canvas polyfill.
if (typeof window !== 'undefined' && typeof window.CanvasRenderingContext2D === 'undefined') {
  (window as unknown as { CanvasRenderingContext2D: unknown }).CanvasRenderingContext2D = class FakeCanvasRenderingContext2D {};
}
if (typeof HTMLCanvasElement !== 'undefined') {
  const context2d = {
    save: () => {},
    restore: () => {},
    clearRect: () => {},
    fillRect: () => {},
    strokeRect: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    fillText: () => {},
    setLineDash: () => {},
    measureText: () => ({ width: 0 }),
    drawImage: () => {},
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 0,
    lineCap: '',
    lineJoin: '',
    font: '',
    textBaseline: '',
    shadowColor: '',
    shadowBlur: 0,
  } as unknown as CanvasRenderingContext2D;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (HTMLCanvasElement.prototype as any).getContext = () => context2d;
  // jsdom *does* define `toBlob` (so a feature-detection `if (!...)` guard
  // would never fire), it just throws "Not implemented" when called — always
  // override it outright.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (HTMLCanvasElement.prototype as any).toBlob = (callback: (blob: Blob | null) => void, type?: string) => {
    callback(new Blob(['fake-png-bytes'], { type: type || 'image/png' }));
  };
}

// jsdom never actually loads image resources (no network fetching of `src`),
// so a real `new Image()`'s `onload`/`onerror` never fire. `compositeWithBackground`
// awaits exactly that event to rasterize the captured snapshot's data URL —
// this stub fires `onload` on the next microtask for any `src` starting with
// `data:`/`blob:` (what this package ever assigns) so the await resolves
// deterministically, and `onerror` otherwise.
if (typeof window !== 'undefined') {
  class FakeImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    width = 100;
    height = 100;
    private _src = '';
    get src() {
      return this._src;
    }
    set src(value: string) {
      this._src = value;
      queueMicrotask(() => {
        if (value.startsWith('data:') || value.startsWith('blob:')) this.onload?.();
        else this.onerror?.();
      });
    }
  }
  (window as unknown as { Image: unknown }).Image = FakeImage;
  (globalThis as unknown as { Image: unknown }).Image = FakeImage;
}
