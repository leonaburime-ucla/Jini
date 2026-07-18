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
        // Same carve-out: `features/html-viewer/types.ts` (plain
        // `DeckSlideState`/`DeckNavigateAction` type shapes) and its
        // `ports.ts` (`FullscreenPort`/`NewTabPreviewPort`/
        // `HtmlViewerDependencies` — interfaces only, unlike
        // `features/observability/ports.ts` which carries a real
        // `noopSafetyEventReporter` runtime export) both verified
        // zero-runtime-declaration.
        'src/features/html-viewer/types.ts',
        'src/features/html-viewer/ports.ts',
        // list-detail-panel/types.ts is pure `interface` declarations, zero
        // runtime statements (verified via the same
        // `grep -nE '^(export )?(const|function|class|let|var) '` check).
        'src/features/list-detail-panel/types.ts',
        // iframe-pool/types.ts is likewise pure `interface` declarations,
        // zero runtime statements (same verification grep).
        'src/features/iframe-pool/types.ts',
        // command-palette/{types,ports}.ts are likewise pure `interface`
        // declarations, zero runtime statements (same verification grep).
        'src/features/command-palette/types.ts',
        'src/features/command-palette/ports.ts',
        // tab-launcher-menu/types.ts is likewise pure `interface`/`type`
        // declarations, zero runtime statements (same verification grep).
        'src/features/tab-launcher-menu/types.ts',
        // revision-review/types.ts is likewise pure `interface`/`type`
        // declarations, zero runtime statements (same verification grep).
        'src/features/revision-review/types.ts',
      ],
    },
  },
});
