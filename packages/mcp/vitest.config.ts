import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      // The v8 text table silently drops rows once there are many files —
      // json-summary/json are what a coverage-driven pass should actually
      // read (see docs/jini-port/skills/fixing-open-design.md Phase 6.5).
      reporter: ['text', 'json-summary', 'json'],
      include: ['src/**'],
      exclude: ['src/**/*.test.ts'],
      thresholds: {
        // The package-wide aggregate can never actually reach a literal 100 while
        // `src/core/oauth.ts` (95.59% branches; pre-existing, untouched by the 2026-07-21
        // MCP tool-hosting-mechanism addition below) is included in it — vitest's global
        // threshold is always computed over every file, regardless of any per-glob override.
        // Measured 2026-07-21 package-wide honest coverage is 99.73/99.07/100/99.73
        // (statements/branches/functions/lines); set with a small safety margin below that,
        // matching `packages/http/vitest.config.ts`'s identical convention.
        statements: 99.5,
        branches: 98.8,
        functions: 100,
        lines: 99.5,
        // Every file under `src/server/**` (the 2026-07-21 addition: `daemon-client.ts`,
        // `tool-protocol.ts`, `tool-server.ts`, `tools/run-tools.ts`) is held to a literal,
        // no-exceptions 100 as its own separately-checked threshold set — this is the part of
        // the package this pass is actually responsible for and it is genuinely at 100/100/100/100.
        'src/server/**': {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
      },
    },
  },
});
