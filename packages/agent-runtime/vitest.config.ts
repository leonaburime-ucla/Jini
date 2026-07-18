import { coverageConfigDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      // The v8 text table silently drops rows once there are many files —
      // json-summary/json are what a coverage-driven pass should actually
      // read (see docs/jini-port's Phase 6.5 method).
      reporter: ['text', 'json-summary', 'json'],
      // Scoped to the ported agent-protocol/ tree — src/craft and src/skills
      // are markdown-only (no TypeScript), so this exclusion isn't strictly
      // load-bearing today, but keeps the coverage gate explicit about what
      // it covers as the package grows.
      include: ['src/agent-protocol/**'],
      exclude: [
        ...coverageConfigDefaults.exclude,
        'src/agent-protocol/**/*.test.ts',
        // Genuinely zero-executable-statement file: pure `type`/`interface`
        // declarations that fully erase at compile time (verified via
        // `grep -nE '^(export )?(const|function|class|let|var) '` finding no
        // runtime declarations) — same documented carve-out convention as
        // packages/ui/vitest.config.ts uses for its own types-only files.
        'src/agent-protocol/acp/types.ts',
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
