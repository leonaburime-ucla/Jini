import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Package-wide default is jsdom (most tests in this package touch the
    // DOM). The few tests that assert real SSR/no-DOM behavior (e.g.
    // utils/dom-subscriptions, utils/zip) opt back into Node per-file via a
    // `// @vitest-environment node` pragma — see packages/ui/source-map.md.
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    server: {
      // @excalidraw/excalidraw's dev build ships extensionless deep imports
      // (e.g. `roughjs/bin/rough`) that assume a bundler's resolver — Vitest's
      // default SSR path hands externalized deps straight to Node's loader,
      // which requires exact extensions and fails to resolve them. Routing it
      // (and its own dependency tree) through Vite's transform pipeline
      // instead resolves those imports correctly.
      deps: {
        inline: [/@excalidraw\/excalidraw/, /roughjs/],
      },
    },
  },
});
