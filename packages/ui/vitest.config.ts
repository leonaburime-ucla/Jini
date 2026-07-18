import { coverageConfigDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Package-wide default is jsdom (most tests in this package touch the
    // DOM). The few tests that assert real SSR/no-DOM behavior (e.g.
    // utils/dom-subscriptions, utils/zip) opt back into Node per-file via a
    // `// @vitest-environment node` pragma — see packages/ui/source-map.md.
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    server: {
      // @excalidraw/excalidraw's dev build ships extensionless deep imports
      // (e.g. `roughjs/bin/rough`) that assume a bundler's resolver — Vitest's
      // default SSR path hands externalized deps straight to Node's loader,
      // which requires exact extensions and fails to resolve them. Routing it
      // (and its own dependency tree) through Vite's transform pipeline
      // instead resolves those imports correctly.
      deps: {
        inline: [/@excalidraw\/excalidraw/, /roughjs/],
      },
    },
    coverage: {
      provider: 'v8',
      // The v8 text table silently drops rows once there are many files —
      // json-summary/json are what a coverage-driven pass should actually
      // read (see docs/jini-port's Phase 9.5 method).
      reporter: ['text', 'json-summary', 'json'],
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
        // Same carve-out for source-config-list: types.ts is interface-only,
        // and ports.ts here is ALSO interface-only (unlike
        // features/observability/ports.ts above, it has no runtime binding
        // helper) — verified with the same grep before excluding.
        'src/features/source-config-list/types.ts',
        'src/features/source-config-list/ports.ts',
        // Same carve-out for resource-dashboard: types.ts and ports.ts are
        // both interface-only (two separate port interfaces, ResourceBoardPort
        // and ResourceRowListPort, but no runtime binding helper lives in
        // ports.ts itself — that's dependencies.ts, which IS covered) —
        // verified with the same grep before excluding.
        'src/features/resource-dashboard/types.ts',
        'src/features/resource-dashboard/ports.ts',
      ],
    },
  },
});
