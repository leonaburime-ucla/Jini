import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      // The v8 text table silently drops rows once there are many files —
      // json-summary/json are what a coverage-driven pass should actually
      // read (see docs/jini-port's Phase 6.5 method).
      reporter: ['text', 'json-summary', 'json'],
      // Scoped to this task's ported files (Part 2 of the
      // agent-protocol/ToolExecutor/daemon-core port) rather than the whole
      // package — pre-existing files (token.ts, pack.ts, bindings.ts,
      // daemon.ts, compose.typecheck.ts) predate this coverage gate and are
      // out of this task's scope; compose.typecheck.ts in particular is a
      // typecheck-only compile-time proof (see its own docblock) never
      // exercised by vitest, so a package-wide include would tank the
      // aggregate on a file this gate was never meant to cover.
      include: ['src/redact.ts', 'src/api-token-auth.ts', 'src/origin-validation.ts'],
      thresholds: {
        statements: 99,
        branches: 99,
        functions: 99,
        lines: 99,
      },
    },
  },
});
