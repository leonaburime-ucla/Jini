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
        // `src/core/oauth.ts` (98.77% branches as of the 2026-07-21 `cf20726dc` coverage pass;
        // pre-existing, untouched by either the 2026-07-21 MCP tool-hosting mechanism addition or
        // the same-day MCP resource-surface addition below) is included in it — vitest's global
        // threshold is always computed over every file, regardless of any per-glob override.
        // Measured 2026-07-21 (resource-surface pass) package-wide honest coverage is
        // 100/99.74/100/100 (statements/branches/functions/lines); set with a small safety margin
        // below the branches figure (the only one not already a literal 100), matching
        // `packages/http/vitest.config.ts`'s identical convention.
        statements: 100,
        branches: 99.4,
        functions: 100,
        lines: 100,
        // Every file under `src/server/**` (the 2026-07-21 tool-hosting-mechanism addition —
        // `daemon-client.ts`, `tool-protocol.ts`, `tool-server.ts`, `tools/run-tools.ts` — plus the
        // same-day resource-surface addition: `resource-protocol.ts`, `resources/*.ts`, and
        // `tool-server.ts`'s resource wiring) is held to a literal, no-exceptions 100 as its own
        // separately-checked threshold set — this is the part of the package this pass is actually
        // responsible for and it is genuinely at 100/100/100/100.
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
