import { coverageConfigDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      // The v8 text table silently drops rows once there are many files —
      // json-summary/json are what a coverage-driven pass should actually
      // read (see docs/jini-port's Phase 9.5 method).
      reporter: ['text', 'json-summary', 'json'],
      include: ['src/**'],
      exclude: [
        ...coverageConfigDefaults.exclude,
        // `src/craft/*` and `src/skills/*` are the vendored, product-neutral
        // craft-knowledge docs and Skill packages ported per
        // `source-map.md`'s "craft/" and "skills/" sections — markdown
        // content plus a handful of example/asset scripts bundled inside
        // individual skill directories (e.g. a Remotion template's React
        // components, a web-clone skill's recon scripts). None of it is
        // `@jini/agent-runtime`'s own TypeScript source (that's
        // `src/*.ts` + `src/defs/*.ts`, documented in source-map.md's
        // "runtimes/ -> agent-runtime TypeScript source" section) and none
        // of it is imported by this package's own code, so it has no
        // meaningful test surface here — excluded from the denominator
        // rather than silently dragging the real source's percentage down.
        'src/craft/**',
        'src/skills/**',
        // Pure `export type`/`export interface` file with zero runtime
        // declarations (verified via
        // `grep -nE '^(export )?(const|function|class|let|var) ' src/types.ts`
        // finding no matches). A file with nothing to execute is never
        // loaded by any test, so v8 reports it as 0% rather than N/A —
        // documented carve-out, not a coverage dodge (same reasoning as
        // packages/ui/vitest.config.ts's settings-dialog types.ts excludes).
        'src/types.ts',
        // Same carve-out as `src/types.ts` above: pure `export type`/
        // `export interface` file, zero runtime declarations (verified via
        // the same grep). Vendored provider-connectivity shapes only.
        'src/providers/types.ts',
      ],
      thresholds: {
        statements: 99.9,
        branches: 99.9,
        functions: 99.9,
        lines: 99.9,
      },
    },
  },
});
