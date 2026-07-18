import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      // The v8 text table silently drops rows once there are many files —
      // json-summary/json are what a coverage-driven pass should actually
      // read (see docs/jini-port's Phase 6.5 method).
      reporter: ['text', 'json-summary', 'json'],
      // Scoped to this task's ported/added files (the
      // agent-protocol/ToolExecutor/daemon-core port, Parts 2-3) rather than
      // the whole package — pre-existing files (token.ts, pack.ts,
      // bindings.ts, daemon.ts, compose.typecheck.ts) predate this coverage
      // gate and are out of this task's scope; compose.typecheck.ts in
      // particular is a typecheck-only compile-time proof (see its own
      // docblock) never exercised by vitest, so a package-wide include would
      // tank the aggregate on a file this gate was never meant to cover.
      // principal.ts (an `interface` only) and tool-tokens.ts (a single
      // `token()` call, itself covered by token.ts's own existing test
      // coverage — not independently meaningful here) are genuinely
      // zero-new-executable-statement files and simply omitted from this
      // explicit allow-list rather than test-padded for their own sake.
      include: [
        'src/redact.ts',
        'src/api-token-auth.ts',
        'src/origin-validation.ts',
        'src/tool-registry.ts',
        'src/internal.ts',
      ],
      thresholds: {
        statements: 99,
        branches: 99,
        functions: 99,
        lines: 99,
      },
    },
  },
});
