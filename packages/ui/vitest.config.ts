import { coverageConfigDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Package-wide default is jsdom (most tests in this package touch the
    // DOM). The few tests that assert real SSR/no-DOM behavior (e.g.
    // utils/dom-subscriptions, utils/zip) opt back into Node per-file via a
    // `// @vitest-environment node` pragma — see packages/ui/source-map.md.
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      exclude: [
        ...coverageConfigDefaults.exclude,
        // Genuinely zero-executable-statement files: pure `interface`/`type`
        // declarations that fully erase at compile time (verified via
        // `grep -nE '^(export )?(const|function|class|let|var) '` finding no
        // runtime declarations in any of these — see `settings-dialog`'s
        // extraction audit). A file with nothing to execute is never loaded
        // by any test, so v8 reports it as 0% rather than N/A; excluding it
        // here is the documented-reason carve-out, not a coverage dodge.
        // Scoped to `settings-dialog`'s own `types.ts` files (not a
        // package-wide glob) because at least one other feature's
        // `ports.ts` (`features/observability/ports.ts`) DOES carry a real
        // runtime declaration and must stay covered.
        'src/features/settings-dialog/types.ts',
        'src/features/settings-dialog/tabs/*/types.ts',
        'src/features/settings-dialog/tabs/integrations/ports.ts',
      ],
    },
  },
});
