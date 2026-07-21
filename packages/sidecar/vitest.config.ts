import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      // The v8 text table silently drops rows once there are many files —
      // json-summary/json are what a coverage-driven pass should actually
      // read (see docs/jini-port's Phase 6.5 method).
      reporter: ['text', 'json-summary', 'json'],
      // CR-R4: this package had no committed coverage gate at all (see
      // ADS-memory/reports/code-review/CR-backend-coverage-push-2026-07-20.md, R4).
      // `src/types.ts` is a genuinely zero-executable-statement file
      // (`export type`/`export interface` only, verified via
      // `grep -nE '^(export )?(const|function|class|let|var) '` finding no
      // runtime declarations) — left in `include` rather than excluded so a
      // future non-type addition to that file is still gated, same
      // reasoning as packages/core/vitest.config.ts's principal.ts carve-out.
      include: ['src/**'],
      exclude: ['src/**/*.test.ts'],
      thresholds: {
        // Ratchet baseline, NOT a final target (CR-R4): measured 2026-07-21
        // package-wide honest coverage is ~97.9/89.6/98/97.9 (statements/
        // branches/functions/lines). The sidecar port-exhaustion
        // determinism fix (CR-R5) and json-ipc frame/idle/concurrency/error
        // hardening (SEC-004) already closed several gaps (net.ts is now
        // 100%); the remainder in json-ipc.ts/port.ts is either tied to
        // running tests as root in this sandbox — chmod(0o000)-based
        // permission-denial tests can't actually deny access to root, so
        // those branches don't execute here even though the tests exist —
        // or a defensively-unreachable non-Error-throw branch in a helper
        // whose only real caller always throws a real Error. Raise these
        // numbers as that remainder is closed — do not lower them.
        statements: 97,
        branches: 89,
        functions: 98,
        lines: 97,
      },
    },
  },
});
