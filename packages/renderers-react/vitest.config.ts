import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // This package's only content so far (annotation-canvas) is DOM-heavy
    // (canvas, pointer events, portals) — jsdom package-wide, same
    // precedent as @jini/ui's vitest.config.ts.
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
  },
});
