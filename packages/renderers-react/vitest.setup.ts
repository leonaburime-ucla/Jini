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
