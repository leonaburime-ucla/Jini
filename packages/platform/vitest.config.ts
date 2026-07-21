import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      // The v8 text table silently drops rows once there are many files —
      // json-summary/json are what a coverage-driven pass should actually
      // read (see docs/jini-port's Phase 6.5 method).
      reporter: ['text', 'json-summary', 'json'],
      // CR-R4: widened to the whole package (matching packages/core and
      // packages/agent-runtime's package-wide convention) — the prior config
      // measured only 4 files, silently excluding command.ts/http.ts/
      // process.ts/proxy-env.ts/toolchain.ts/asset-cache.ts and everything
      // else, which hid this package's real coverage from CI (see
      // ADS-memory/reports/code-review/CR-backend-coverage-push-2026-07-20.md, R4).
      include: ['src/**'],
      exclude: ['src/**/*.test.ts'],
      thresholds: {
        // Ratchet baseline, NOT a final target (CR-R4): measured 2026-07-21
        // package-wide honest coverage is ~98.8/92.0/99.1/98.8 (statements/
        // branches/functions/lines). branches sits below the 98% unit-profile
        // target primarily because of two large files with unclosed gaps —
        // asset-cache.ts (~36 branches, SSRF/DNS-rebinding/streaming edge
        // cases) and download.ts (~52 branches, resume/retry/prune edge
        // cases) — both explicitly named as stretch goals in the coverage-
        // gate task, not closed here. A small residual gap in fs.ts is tied
        // to running tests as root in this sandbox: chmod(0o000)-based
        // permission-denial tests can't actually deny access to root, so
        // those branches don't execute here even though the tests exist (see
        // TR-backend-coverage-push-2026-07-20.md and the sidecar/json-ipc
        // tests' own note on the same limitation). Raise these numbers as
        // asset-cache.ts/download.ts gain real branch coverage — do not
        // lower them.
        statements: 98,
        branches: 91,
        functions: 98,
        lines: 98,
      },
    },
  },
});
