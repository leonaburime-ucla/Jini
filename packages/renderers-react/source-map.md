# `@jini/renderers-react` — provenance

## Section: sandboxed-iframe rendering core (2026-07-18)

Origin: **not an extraction** — this is a fresh, minimal design, per
`packages/ui/source-map.md`'s `html-viewer` classification section (dated
2026-07-18, same day). That classification read `HtmlViewer`
(`FileViewer.tsx`, 5248–11323 in the real OD fork) and its `runtime/srcdoc.ts`
(2,689 lines) in full and concluded the real bridge — 31 message types
across 3 overlapping naming conventions (`od:*`, `od-edit-*`, legacy
`__dc_*`), one shared listener, gated on a cross-feature state machine
(`manualEditMode`/`boardMode`/`drawOverlayOpen`/`inspectMode`) — **cannot be
sliced out in place**; porting it verbatim would drag OD's entire annotation
stack along with it. Both deep-read passes that produced that classification
concluded the generic pieces worth keeping (sandboxed rendering, a
postMessage transport, deck navigation, the manual-edit patch model, the
DOM-pinned comment overlay, the CSS inspector) need "a real,
deliberately-simpler … core in `@jini/renderers-react`" built fresh, not
lifted — this package was an empty placeholder (`package.json` + a one-line
`index.ts` comment) before this section.

This section ships the first, foundational layer of that core: wrapping
arbitrary HTML for safe sandboxed-iframe rendering, and a generic
(vocabulary-free) `postMessage` transport a consuming feature can register
its own message types on. It does **not** ship deck navigation, comment
pinning, manual editing, or CSS inspection — those are future consumers of
this core, each defining their own message shapes (see
`packages/ui/source-map.md`'s `html-viewer` section for the deferred list).

### What shipped

| File | Contents |
|---|---|
| `src/types.ts` | `SandboxedDocumentOptions`, `SandboxedDocumentResult`, `SandboxBridgeMessage`, `SandboxBridgeHandler`. Zero runtime declarations (verified via the standard `grep -nE '^(export )?(const\|function\|class\|let\|var) '` check) — excluded from the coverage run per the documented `@jini/ui` carve-out for the same shape of file, not a coverage dodge. |
| `src/html-utils.ts` | `escapeHtmlAttribute`, `injectAfterHeadOpen`, `injectBeforeHeadEnd`, `injectBeforeBodyEnd` — generic string splices for inserting markup into an HTML document without a full parse/re-serialize round-trip. Ported near-verbatim from the *shape* of OD's own `injectBeforeHeadEnd`/`injectBeforeBodyEnd` in `runtime/srcdoc.ts` (finding the *last* `</head>`/`</body>` before the next structural boundary, so a same-named tag inside an earlier `<script>`/`<style>` literal isn't mistaken for the real one) — this exact technique is already reused across many of OD's own bridge injectors, i.e. already treated as generic infrastructure by the source itself. |
| `src/sandboxed-document.ts` | `isFullHtmlDocument`, `wrapFragmentAsDocument` (OD's `buildSrcdoc` full-doc-vs-fragment decision, isolated), `injectBaseHref`, `buildStorageShimScript`, `buildFocusGuardScript`, `buildSandboxedDocument` (composes all of the above). `buildStorageShimScript`'s in-memory `localStorage`/`sessionStorage` fallback and click-interception logic (hash-scroll, safe-scheme `target="_blank"` open) is OD's `injectSandboxShim` logic verbatim, renamed (`data-od-sandbox-shim` → `data-jini-sandbox-shim`) — a `sandbox="allow-scripts"` iframe without `allow-same-origin` throws `SecurityError` on first Storage access, and this is genuinely artifact-shape-agnostic browser-compat code, not an OD business rule. `buildFocusGuardScript` is OD's `injectPreviewFocusGuard` verbatim, renamed (`data-od-preview-focus-guard` → `data-jini-focus-guard`). **Not ported**: `injectSelectionBridge` (comment/inspect element-picking — OD-message-type-coupled), `injectPaletteBridge` (OD's 5 named brand palettes), `injectManualEditBridge`/`annotateManualEditSourcePaths` (manual-edit patch model), `injectSnapshotBridge`/`injectExportCaptureBridge` (export pipeline), `annotateMissingOdIds` (OD's `data-od-id` annotation convention for the selection bridge), the deck bridge (`injectDeckBridge`, referenced in `buildSrcdoc`'s own doc comment but not shown in the excerpt read for this task — deferred to the eventual deck-navigation feature, which will register its own message types against `useSandboxBridge` rather than receiving them for free from this core). |
| `src/sandbox-bridge.ts` | `useSandboxBridge` — a React hook wiring one `window` `message` listener scoped to a single iframe (`event.source === iframe.contentWindow`), dispatching by `message.type` to a caller-registered handler map, plus a `post()` that sends to that iframe. Deliberately carries **no message vocabulary** — this is transport only, unlike OD's `injectSelectionBridge`-style bridges which hard-code their own protocol inside the injected script. The listener attaches once per mount; `handlers`/`targetOrigin` are read through a ref on every message rather than listed as effect deps, both avoiding needless re-attachment on every render and sidestepping the `useT()`-in-deps infinite-loop gotcha documented in `docs/jini-port/skills/fixing-open-design-web.md` Phase 6 for any handler that closes over translated strings. |
| `src/new-tab-preview.ts` | `buildSandboxedPreviewPage` + `openSandboxedPreviewInNewTab` — ported from OD's `runtime/exports.ts` `buildSandboxedPreviewDocument`/`openSandboxedPreviewInNewTab` (a tiny full-viewport host page wrapping the real artifact as a nested `srcdoc` iframe, opened via a `Blob` URL revoked after 60s). Logic verbatim; dropped the OD-specific `deck`/PDF-export-only parameters (`sandboxedPreview`, the deck print-stylesheet injection) that live in the surrounding `exportAsPdf` caller, not in this function itself. |
| `src/index.ts` | Public barrel. |

### i18n

None of this file's strings are user-facing — every string literal is
either a `data-*` attribute name, a `postMessage` protocol key, or DOM API
usage inside an injected sandboxed script (a different JS realm entirely,
not this package's own render output). No `useT()` call site exists here;
the first user-facing strings will belong to whichever `@jini/ui` feature
consumes this core (e.g. a future deck-navigation slice's toolbar labels).

### Purity grep

`grep -rn "Open Design\|OD_\|--od-stamp\|/tmp/open-design\|open-design\.ai\|openDesignDesktop\|@open-design/"` across `packages/renderers-react/src/`: **clean, zero matches.** A stricter case-insensitive pass for the bare `od-` prefix (catching the class/data-attribute convention, not just the literal banned-list regex): also clean — every renamed data attribute uses `data-jini-*`.

### Test / typecheck / guard results

- `pnpm --filter @jini/renderers-react run typecheck`: clean, zero errors.
- `npx vitest run --coverage` (whole package, 5 files, 65 tests, all green): **100% on all 4 metrics (statements/branches/functions/lines)**, `src/types.ts` excluded per the zero-executable-statement carve-out above. Reached via the Phase 9.5 classify-then-fix loop: one genuinely-reachable branch was found missing a test (`injectBeforeHeadEnd`'s "no `<body>` at all" case) and got a real test rather than being ignored or refactored away; `index.ts`'s 0%-before-fix was closed with a barrel-completeness smoke test (same pattern as `packages/ui/src/features/viewer-shell/index.test.ts`), not a coverage-suppression comment. `buildStorageShimScript`/`buildFocusGuardScript`'s returned JS is exercised functionally (not just string-contains assertions) by extracting the script body and evaluating it via `new Function(...)` against hand-built fake `window`/`document`/`location`/`history`/`Element`/`HTMLElement` objects — proving the actual runtime logic (storage fallback, anchor/hash handling, safe-scheme `target="_blank"` gating, trusted-input-gated focus suppression) works, not just that the string contains an expected marker.
- `pnpm guard` (repo root): `[guard] ok (skeleton — rules pending implementation during extraction)` — unchanged, no boundary violations introduced.
