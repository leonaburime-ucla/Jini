import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'json'],
      include: ['src/**'],
      exclude: ['src/**/*.test.ts'],
      thresholds: {
        // Measured 2026-07-22: genuine 100/100/100/100 (audit fix — the two remaining gaps,
        // note-store.ts:107 and :170-171, were closed with real fixes/tests, not by lowering
        // this margin). Set at the real number, not a margin below it.
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
});
