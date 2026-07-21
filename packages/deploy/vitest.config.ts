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
      include: ['src/**'],
      exclude: ['src/**/*.test.ts'],
      thresholds: {
        // Ratchet baseline, NOT a final target (CR-R4): measured 2026-07-21
        // package-wide honest coverage is ~99.7/79.9/100/99.7 (statements/
        // branches/functions/lines). branches sits well below the 98%
        // unit-profile target almost entirely because of
        // cloudflare-pages.ts (~82 uncovered branch outcomes across
        // validation/DNS/polling/response-shape paths) and, to a lesser
        // degree, vercel.ts (~15 branches) — both explicitly named as
        // stretch goals in the coverage-gate task, not closed here.
        // reachability.ts's own remaining gaps were reviewed directly: most
        // are either defensively-unreachable (e.g. a non-Error throw from a
        // function whose only production caller always throws a real Error)
        // or thin `||` fallback branches in waitForReachableDeploymentUrl's
        // polling loop, not a live security or correctness gap. Raise these
        // numbers as cloudflare-pages.ts/vercel.ts gain real branch coverage
        // — do not lower them.
        statements: 98,
        branches: 78,
        functions: 98,
        lines: 98,
      },
    },
  },
});
