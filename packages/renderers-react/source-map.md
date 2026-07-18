# `@jini/renderers-react` — provenance

Origin: `leonaburime-ucla/open-design`, branch `main`, commit
`0b88ef56144b5a42dc427c1292ae22676d698a34` (2026-07-02), cloned fresh for this
task (not the vendored `integrations/open-design/reference/` snapshot, which
is a frozen 2026-07-16 copy — see that directory's README for the caveat).

Per `docs/jini-port/recon/r4b-webui-design.md` §1 ("`@jini/artifacts-react` —
RendererRegistry", the pre-lock name for this package — the locked name per
`extraction-plan.md` §3 is `@jini/renderers-react`) and
`docs/jini-port/god-components-extraction-plan.md`'s "Consolidation map"
(`features/annotation-canvas/` targets this package for its Part B, landed in
the same task — see this file's second half).

## Files

| Jini file | Origin file | Transform |
|---|---|---|
| `src/registry.ts` | `apps/web/src/artifacts/renderer-registry.ts` (108 lines) | Ported verbatim in shape. `ProjectFile` → `ArtifactFile` (generic, see `types.ts`). Dropped the built-in `DeckHtmlRenderer` — deck rendering needs a host-injected postMessage bridge (see `srcdoc/bridge.ts`), so a host registers its own `deck-html` `ArtifactRenderer` via the new `RendererRegistry.register()` method (not in the origin) instead of this package shipping one. Added `list()` and `register()` (not in the origin) so a host can inspect/extend a registry instance without reconstructing it. |
| `src/renderers/html.ts` | (part of `renderer-registry.ts`) | `HtmlRenderer` ported verbatim; `hints.isDeckHint` replaces the origin's positional `isDeckHint` context field. |
| `src/renderers/svg.ts` | (part of `renderer-registry.ts`) | `SvgRenderer` ported verbatim. |
| `src/renderers/react-component.ts` | (part of `renderer-registry.ts`) | `ReactComponentRenderer` ported verbatim as a registry-matching descriptor only — it does not itself evaluate/mount React source (see the file's doc comment); a host supplies the actual render function via `ArtifactView`'s `slots.renderers['react-component']`. |
| `src/renderers/markdown.ts` | `apps/web/src/artifacts/markdown.ts` (116 lines) | Verbatim — no product-specific logic in the original. |
| `src/renderers/index.ts` | — (new) | Barrel + `createDefaultRendererRegistry()`, seeded with every renderer this package ships (excludes `deck-html`, see `registry.ts` above). |
| `src/shiki.ts` | `apps/web/src/runtime/shiki.ts` (56 lines) | Ported with one version-driven trim: the origin's `langs` list also requested `rust`, `go`, `swift`, `ruby`, `diff`, `toml`, `dockerfile` — this package's pinned `shiki@^1.24.4`'s `bundle/web` (a deliberately size-trimmed, browser-focused subset) does not ship grammars for those, so they're dropped rather than cast around (a cast would compile but throw at runtime). `HighlighterGeneric<any, any>` → `HighlighterGeneric<BundledLanguage, BundledTheme>` (typed, no `any`) — types imported from `shiki/bundle/web` specifically, since the top-level `shiki` module's own `BundledLanguage`/`BundledTheme` are a structurally different (full-bundle) type that doesn't match what `bundle/web`'s `createHighlighter` actually returns. |
| `src/url-load-decision.ts` | `apps/web/src/components/file-viewer-render-mode.ts` (203 lines) | `hasTweaksTemplate`/`hasUrlModeBridge` dropped (see "Not ported" below). `UrlLoadDecision` generified: the origin had one named boolean per product-specific bridge (`commentMode`, `inspectMode`, `editMode`, `paletteActive`, `drawMode`, `tweaksBridge`, …) — replaced with `activeBridgeIds?: readonly string[]`, so any host-registered `SrcDocBridge` (see `srcdoc/bridge.ts`) can force srcDoc mode by declaring itself active in `shouldUrlLoadHtmlPreview`'s `bridgesRequiringSrcDoc` set, without this package knowing the bridge's name in advance. `shouldUrlLoadHtmlPreview`, `parseForceInline`, `htmlNeedsFocusGuard`, `htmlNeedsSandboxShim` ported with equivalent logic under the generified interface. |
| `src/srcdoc/build.ts` | `apps/web/src/runtime/srcdoc.ts` (2,689 lines) | See "The srcDoc host" below — this is the one substantial redesign in the package, not a mechanical port. |
| `src/srcdoc/bridge.ts` | — (new) | The `SrcDocBridge` plugin seam (see below). |
| `src/srcdoc/index.ts` | — (new) | Barrel. |
| `src/types.ts` | — (new) | `ArtifactFile` (generified from `ProjectFile`: `{name, kind, content?, url?, manifest?}`). Re-exports `ArtifactManifest`/`ArtifactKind`/`ArtifactRendererId`/`ArtifactExportKind`/`ArtifactStatus` from `@jini/chat-core`, which already ports the manifest vocabulary (`createHtmlArtifactManifest`, `inferLegacyManifest`, `parseArtifactManifest`, etc. — see `packages/chat-core/src/artifacts/`) — this package does not re-derive that logic. |
| `src/react/i18n.tsx` | `i18n/index.tsx` in the vendored OD web tree (via the same mechanism-only port already done for `@jini/ui`'s `features/i18n`) | A second, package-local copy of the same "context + host-injected dictionary, zero-cost passthrough when unconfigured" shape — not a dependency on `@jini/ui`, since this package's allowed deps (`docs/jini-port/recon/r4b-webui-design.md` §1) are `react`, `@jini/chat-core`, a markdown lib, and shiki; `@jini/ui` is not among them. Deliberately smaller than `@jini/ui`'s version (no locale/RTL/persistence — this package only has a handful of user-facing strings). |
| `src/react/components/SrcDocSandbox.tsx` | — (new) | The sandboxed-iframe host component (see "The srcDoc host" below). |
| `src/react/components/ArtifactView.tsx` | — (new) | `<ArtifactView file registry slots>` per r4b §1's public-surface list. Resolves `file` against `registry`, dispatches to a host `slots.renderers[id]` when supplied, otherwise a built-in default for `html`/`svg`/`markdown`, otherwise a translated fallback message. |
| `src/index.ts` | — (new) | Public barrel. |

## The srcDoc host (`srcdoc/build.ts` + `srcdoc/bridge.ts` + `react/components/SrcDocSandbox.tsx`)

The origin `runtime/srcdoc.ts` (2,689 lines) bakes a fixed set of postMessage
bridges directly into its `buildSrcdoc` function: deck navigation,
comment/inspect element-selection, a CSS tweaks palette, and a manual-edit
overlay, plus a snapshot/export-capture pipeline. Every one of those is
product-specific — their wire protocols and DOM markers (a `data-*`
element-id attribute scheme) reference that product's own comment/inspect/
edit UI, not a generic concept.

Ported (generic sandbox mechanics, kept behavior-equivalent):
- Document wrapping (`buildSrcDoc` — wraps a bare HTML fragment in a minimal
  document shell; passes a full document through unchanged).
- `sanitizeTitleInDoc`/`sanitizePreviewTitle`/`decodeHtmlEntitiesForTitle` —
  rewrites the real `<title>` (skipping occurrences inside comments/
  `<script>`/`<style>`) to a string safe to use as a downloaded/printed
  filename on common desktop OSes and collaboration tools.
- The same-origin `localStorage`/`sessionStorage` shim + safe anchor/
  `target="_blank"` link handling (`data-jini-sandbox-shim`, renamed from
  `data-od-sandbox-shim`) — always installed, since the iframe's `sandbox`
  attribute omits `allow-same-origin` and would otherwise throw
  `SecurityError` on first Web Storage access.
- The anti-focus-steal guard (`data-jini-preview-focus-guard`, renamed from
  `data-od-preview-focus-guard`) — opt-in via `previewFocusGuard`.
- The lazy-transport-shell perf optimization (`buildLazySrcDocTransport`,
  `canActivateSrcDocTransport`) — lets a host reuse one mounted iframe across
  renders via a `postMessage` activation handshake instead of paying a full
  `srcDoc` reflow every time. Message type names renamed
  `od:srcdoc-transport-*` → `jini:srcdoc-transport-*`.
- `injectAfterHeadOpen`/`injectBeforeHeadEnd`/`injectBeforeBodyEnd` — the
  generic string-splice helpers every bridge (ported or not) needs to insert
  a `<script>`/`<style>`/`<meta>` into a document without a full DOM
  reparse; exported so host-registered `SrcDocBridge` implementations can
  reuse them too.

**Not ported** (OD-specific, become `SrcDocBridge` plugins a host registers,
not built-ins — see `srcdoc/bridge.ts`'s doc comment for the design):
`injectDeckBridge` (slide navigation), `injectSelectionBridge` (comment +
inspect element-selection), `injectPaletteBridge` (CSS tweaks palette),
`injectManualEditBridge`/`annotateManualEditSourcePaths` (manual-edit
overlay), `injectSnapshotBridge`/`injectExportCaptureBridge` (screenshot/PDF
export pipeline), `annotateMissingOdIds` (auto-annotates elements with a
`data-od-id` for the selection bridge to target — meaningless without that
bridge). None of these are ported even in stripped form; a consuming product
implements its own `SrcDocBridge` for each one it needs and registers it via
`buildSrcDoc`'s `bridges` option. `hasTweaksTemplate`/`hasUrlModeBridge` (from
`file-viewer-render-mode.ts`) are dropped for the same reason — both only
have meaning relative to the (unported) tweaks/manual-edit bridges.

**New, not in the origin:**
- The `SrcDocBridge` plugin seam itself (`srcdoc/bridge.ts`) — `{id, inject}`
  run in registration order over the built document, tolerant of a throwing
  bridge (skipped, original doc passed through) so one broken host bridge
  can't blank the whole preview.
- A default strict Content-Security-Policy (`DEFAULT_SRC_DOC_CSP`), injected
  unless `options.csp` is `false` or a custom policy string. Locks down
  `object-src`/`base-uri`/`form-action`; still allows the inline scripts/
  styles and `blob:`/`data:` assets typical agent-generated artifacts use.
  This is defense in depth on top of the iframe's own `sandbox` attribute
  (already the primary isolation boundary — the sandbox omits
  `allow-same-origin`, so the document has no access to the host's storage/
  cookies/DOM regardless of CSP). The origin had no CSP meta tag at all;
  this is a deliberate hardening per this port's brief ("treat srcDoc
  content as hostile: strict CSP, isolated origin, no ambient bridge").
- `<SrcDocSandbox>` (`react/components/SrcDocSandbox.tsx`) — the React
  component wrapping `buildSrcDoc` in an `<iframe sandbox="allow-scripts
  allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer">`
  (no `allow-same-origin` — isolated origin), with an `onMessage` prop that
  filters `window` `message` events to only those sourced from its own
  `iframe.contentWindow` (origin is intentionally not checked, matching the
  origin bridge's own documented security note: sandboxing contains the
  blast radius, a stable origin can't be assumed across dev/preview
  deployments). No bridge is installed ambiently — a host opts in via
  `options.bridges`.

## Not ported (out of scope for this package)

- `DeckHtmlRenderer` (needs the deck postMessage bridge, above).
- Every `srcdoc.ts` bridge implementation listed above.
- Actual React-component evaluation/mounting for the `react-component`
  renderer id (inherently host-specific sandboxing strategy) — this package
  only matches *that* a file is a react-component artifact; rendering it is
  a host-supplied `ArtifactView` slot.
- OD's own Composio-style renderer extensions, if any existed beyond the
  five renderers ported here — none were found beyond what's listed above.

## Dependencies

`react`, `react-dom` (peers, `^19.2.0`, matching `@jini/ui`'s pin),
`@jini/chat-core` (workspace, for the artifact-manifest vocabulary),
`micromark`/`micromark-extension-gfm` (markdown), `shiki` (syntax
highlighting). Dev: `@testing-library/react`/`jest-dom`/`user-event`, `jsdom`,
`@vitest/coverage-v8` — same versions as `@jini/ui`'s `package.json` for
consistency across the repo's React packages.

## Validation (Part A — RendererRegistry + srcDoc sandbox core)

`pnpm --filter @jini/renderers-react typecheck` — 0 errors. `pnpm --filter
@jini/renderers-react test` — 118/118 passing across registry resolution,
every built-in renderer's `canRender` logic, markdown-to-HTML safety
(external-link hardening, unsafe-scheme stripping, table-pipe escaping),
`shiki` highlighting + caching, the `UrlLoadDecision` port, every `srcdoc/
build.ts` mechanic (title sanitization, splice helpers, sandbox shim, CSP
injection, lazy-transport activation gating), the bridge plugin seam
(ordering, context passthrough, throw-tolerance), and both React components
(`ArtifactView`/`SrcDocSandbox`) including an end-to-end i18n test that
mounts under `I18nProvider` with a real dictionary and asserts the
*translated* string renders (not just the passthrough case) per this repo's
i18n policy. `pnpm guard` clean. No product-identity strings in `src/`
(verified via `grep -rniE "open design|OD_|--od-stamp|/tmp/open-design"` and
a bare-`OD`-word sweep — both empty).

---

# `annotation-canvas` — provenance (Part B)

**Retry of a reverted extraction.** A first attempt (via Codex Cloud,
2026-07-17) landed at this same path but an independent review found 2 real,
undisclosed gaps versus the origin (the send/draft/queue submit-action
picker, and all keyboard shortcuts) and never produced a draft PR or worked
on a task branch. That code was reverted; this is a fresh extraction, not
gap-fix work on the reverted code. Both previously-missing behaviors are
confirmed present below.

Origin: `nexu-io/open-design`, `refs/pull/5228/head`, commit
`d695f1e0f2b85a032aa7ce4895a3eb764cb1b65d` (verified to match the required
pre-dispatch fetch exactly). Target file:
`apps/web/src/components/PreviewDrawOverlay.tsx` (2,158 lines, confirmed by
`wc -l` against the live fetch — matches the expected line count).

Per `docs/jini-port/god-components-extraction-plan.md`'s Consolidation map
(`features/annotation-canvas/` row) and its priority-order item 1: "near-
complete annotation-canvas engine (freehand draw/undo-redo, canvas redraw
with rAF/DPR handling, box-select, draggable text labels, a
collision-avoiding floating-toolbar placement engine). OD-specific only via
a thin, already-isolated seam (`markKind()`, `data-od-*` attributes, the
snapshot/composite/submit pipeline). Target: a generic `AnnotationCanvas`
component/hook in `@jini/renderers-react` … OD supplying the snapshot/submit
callback via a port."

## Reference Preflight evidence

Read in full from the same OD ref (PR #5228 head): `apps/web/src/features/
memory/ports.ts`, `dependencies.ts`, `index.ts` (the vertical-slice shape
this port follows — ports+dependencies+hooks+components+barrel, one binder
file, public barrel as the only reachable surface); `docs/adr/
0002-frontend-vertical-slice-decomposition.md` (full); `scripts/
check-web-slice-boundaries.ts` (size-checked, 862 lines — its rules are
already summarized by the ADR, not re-read line-by-line).
`apps/web/AGENTS.md` **does not exist at this ref** — `apps/AGENTS.md`
covers the same ground (its "apps/web frontend refactors (vertical slices)"
section names the same ADR and the same `MemorySection` canary), so that was
read instead; flagged here rather than silently substituted.

Callers confirmed via `grep -rln PreviewDrawOverlay`: `FileViewer.tsx` (2 use
sites, the full prop surface: `active/onActiveChange/captureViewport/
captureSnapshot/captureTarget/filePath/sendDisabled/sendDisabledReason/
onToolbarClick/toolbarHost`), `DesignBrowserPanel.tsx` (same contract, no
`onToolbarClick`/`toolbarHost`), `ChatComposer.tsx` (does not render it —
only listens for the `ANNOTATION_EVENT` `CustomEvent` on `window` and
implements the send/draft/queue submission semantics itself: composed-turn
building, staged attachments, run-context metadata, `entry_from: 'mark'`
analytics tagging).

## Vertical-slice files

| Jini file | Origin | Transform |
|---|---|---|
| `annotation-canvas/types.ts` | `PreviewDrawOverlay.tsx`'s top-level types (`Point`, `Stroke`, `NormalizedRect`, `TextMark`, `Rect`, `MarkTool`, `AnnotationAction`, `DrawToolbarElement`, `CaptureTarget`, `PreviewSnapshot`, `CaptureFrameRect`, `AnnotationEventDetail`) | Ported verbatim in shape. `AnnotationEventDetail` → `AnnotationSubmitDetail` (dropped its `ack` callback field — the port's `onSubmit` return value replaces the ack pattern). Added `CSSPropertiesLike` (a framework-free stand-in for React's `CSSProperties`, since this zero-React top-level file may not import from `react` per this package's react-layout policy) and `DockPlacement`/`DrawDockLayout`/`DrawDockSide` (were inline types in the origin component, promoted to named exports here). |
| `annotation-canvas/rules.ts` | `PreviewDrawOverlay.tsx`'s pure helpers (`clamp`, `rectsOverlap`, `dockPlacementEquals`, `normalizedRectFromPoints`, the dock-placement `useLayoutEffect`'s candidate-search algorithm, `boxBounds`/`annotationBounds`'s merge logic, `markKind()`, the inline `submitOptions`/`markToolOptions` derivations) | The dock-placement algorithm (`computeDockPlacement`) is the origin's `useLayoutEffect` body extracted into a pure function taking already-measured plain rects instead of reading `getBoundingClientRect()` itself — the hook layer measures, this layer decides. `boxBounds()`/`annotationBounds()`'s ad hoc `Math.min/max` merging became named, tested `mergeRects`/`mergeBounds`. `submitOptions`/`markToolOptions` split into pure "rule" data (id/label-key/enabled) here vs. icon/translated-label attachment in the React layer, since this file must stay React- and i18n-hook-free. |
| `annotation-canvas/drawing.ts` | `PreviewDrawOverlay.tsx`'s `redraw()` callback body, `drawNormalizedBox`, `drawTextMarks`, `drawCaptureTarget`, `compositeWithBackground`'s draw calls | Ported near-verbatim; `redraw()`'s canvas-ref/state reading split out (stays in the hook), leaving `redrawStrokesAndBoxes(ctx, {strokes, drawingStroke, selectionBoxes, boxDraft}, width, height, dpr)` as a pure function over already-read state. `compositeWithBackground`'s draw sequence (target → boxes → strokes → text) extracted as `compositeMarksOntoCanvas` so the hook's async export flow and the pure drawing sequence are independently testable. |
| `annotation-canvas/ports.ts` | — (new) | `AnnotationCanvasPort` — see "OD-only seam vs. generic core" below. |
| `annotation-canvas/dependencies.ts` | — (new) | `createFakeAnnotationCanvasPort()` — a test/demo-only default binding; there is no real transport this package itself binds (unlike `@jini/ui`'s `features/connectors/dependencies.ts`, which binds a real fetch), since the actual submit semantics are entirely host-specific by design. |
| `annotation-canvas/index.ts` | — (new) | Public barrel. |
| `annotation-canvas/react/hooks/useAnnotationCanvas.ts` | `PreviewDrawOverlay.tsx`'s component body (state/refs/effects/handlers — everything except JSX) | The headless controller. Ported near-verbatim: all history/undo-redo state, box/pen/text drawing state machines, text-label drag+edit+autosize, submit-action state (`submitAction`/`submitMenuOpen`), file-attachment staging, capture-warning banner state, dock-placement re-measurement effects, and **every keyboard shortcut** (see below). Replaced: the `window.dispatchEvent(CustomEvent(...))`+`ack` dance → `await port.onSubmit(detail)` (still race'd against the same 60s timeout, now via `Promise.race` instead of a manual `settled` flag); `activePreviewIframe()`/`snapshotHostIframe()`'s `data-od-render-mode`/`data-od-active` DOM lookup → dropped entirely, `port.captureSnapshot` is the only capture strategy (no automatic bridge-iframe fallback — see "Not ported" below); `toolbarHost ?? wrapRef.current?.closest('.viewer-body')` → dropped the `.viewer-body` fallback (an app-shell-specific CSS class convention), `toolbarHost` is now a plain optional prop with inline rendering as the fallback. |
| `annotation-canvas/react/components/AnnotationCanvas.tsx` | `PreviewDrawOverlay.tsx`'s JSX (the `return (...)` body) | The presentational shell consuming the hook's controller. Structure/interactions/ARIA roles preserved (`role="toolbar"`, `role="menu"`/`menuitemradio"`/`aria-checked` for both the mark-tool and submit-action dropdowns, `role="status"`/`aria-live="polite"` for the capture-warning banner, `role="dialog"`/`aria-modal` for the staged-image preview). Visual chrome (exact pixel styling, the tooltip CSS block, the `RemixIcon`/`Icon` icon set) intentionally not ported verbatim — see "Not ported" below. |
| `annotation-canvas/react/components/icons.tsx` | — (new) | A small generic inline-SVG icon set (not a port of `Icon`/`RemixIcon`, both out of scope) so the toolbar renders legibly out of the box; `AnnotationCanvasProps.icons` lets a host override any/all of them. |

## Keyboard shortcuts (the reverted attempt's gap #2 — confirmed present)

All six shortcuts from the origin are ported and covered by
`useAnnotationCanvas.test.ts`/`AnnotationCanvas.test.tsx`:

1. **Escape** closes the overlay (`onActiveChange(false)`) while active.
2. **Cmd/Ctrl+Z** undoes the last box/stroke.
3. **Shift+Cmd/Ctrl+Z** redoes.
4. **Escape** (capture phase) closes the staged-image preview modal first,
   before it would otherwise close the whole overlay.
5. **Escape** (capture phase, outside-click too) dismisses the submit-action
   menu and the mark-tool menu independently.
6. **Escape** inside a text-label's textarea blurs it (stopping propagation)
   instead of closing the overlay.
7. **Enter** in the note input submits as **Queue** (IME-composition-safe —
   a candidate-confirming Enter, tracked via `onCompositionStart`/
   `onCompositionEnd` rather than the stale `nativeEvent.isComposing`, must
   not also submit). `isImeComposing`'s doc-comment rationale (Chrome/macOS
   Pinyin's Enter-still-carries-`isComposing=true` bug) folded directly into
   `onNoteKeyDown`'s own comment rather than porting a separate one-line
   utility module for it.

## Submit-action picker: send/draft/queue (the reverted attempt's gap #1 — confirmed present)

`submitAction`/`submitMenuOpen` state, the split primary button (`send()`
with the currently-selected action) + chevron-triggered dropdown
(`role="menu"`, one `role="menuitemradio"` per action with `aria-checked`),
and each action's independent enable rule (`send` gated by `sendDisabled`;
`draft`/`queue` need only something to submit) are all ported —
`rules.ts`'s `buildSubmitOptionRules` + the hook's `chooseSubmitAction`/
`submitOptions`/`currentSubmit`. Covered end-to-end in
`AnnotationCanvas.test.tsx` (opening the menu, choosing `draft`, choosing
`queue` then re-submitting via the primary button, and the `sendDisabled`
gate) and `useAnnotationCanvas.test.ts` (the same at the hook level, plus
that `send()` refuses `action:'send'` while `sendDisabled`).

## OD-only seam (stays with the consuming product) vs. generic core (this package)

**Stays product-side** (per the Reference Preflight's seam analysis):
- The `window.dispatchEvent(new CustomEvent('opendesign:annotation', …))`
  wire protocol and its `ack`-callback shape — replaced by the
  `AnnotationCanvasPort.onSubmit` port; a consuming product implements its
  own transport (even reusing the same `CustomEvent` approach internally, if
  it wants) behind that interface.
- The composer's send/draft/queue submission semantics: composed-turn
  building, staged-attachment merging, run-context metadata, `entry_from`
  analytics tagging. None of this is generic — it is that product's own
  chat-composer domain logic.
- `data-od-render-mode`/`data-od-active` iframe lookup + the compositor
  snapshot-bridge retry loop (`requestPreviewSnapshot` with growing
  timeouts). A host's `port.captureSnapshot` replaces this outright — no
  automatic "find the right iframe" fallback ships in this package.
- `markKind()`'s *naming* stayed (`deriveMarkKind` in `rules.ts`) since the
  concept (click vs. stroke vs. both) is generic; only the OD-specific
  `data-od-id` annotation step (`annotateMissingOdIds` in `srcdoc.ts`, a
  Part-A-adjacent file, not this component) was never in scope here.
- The exact visual chrome: `Icon`/`RemixIcon`, the tooltip `<style>` block,
  every inline pixel/color value. A host restyles via `className`/CSS
  targeting the `data-annotation-canvas-*` attributes this component does
  expose, or supplies its own `icons` override.

**Generic, this package's core:** the freehand/box/text drawing engine,
undo/redo history, canvas rAF/DPR redraw, the collision-avoiding dock
placement algorithm, the submit-action picker as a UI state machine, and
every keyboard shortcut (both listed in full above).

## Not ported (intentionally, disclosed)

- The automatic snapshot-bridge iframe lookup and its growing-timeout retry
  loop (`[1500, 3000, 6000]`ms) — a host's `port.captureSnapshot` fully
  replaces this; there is no bridge-discovery fallback.
- `hasUrlModeBridge`/`hasTweaksTemplate` equivalents — not applicable here
  (those live in Part A's `url-load-decision.ts` scope, not this feature,
  and were already dropped there for the same reason: meaningless without
  the unported tweaks/manual-edit bridges).
- The exact origin visual design (colors, blur/shadow values, the
  `RemixIcon`/`Icon` icon set, the tooltip CSS block). Replaced with a
  small generic icon set + inline styles that preserve structure/ARIA, not
  pixel parity.
- `annotateMissingOdIds`'s `data-od-id` annotation scheme — irrelevant here
  since the comment/inspect selection bridge it exists to support is a Part
  A `srcdoc` bridge-seam concern, not drawn by this component.

## Wiring into the RendererRegistry (per the task brief: "not a standalone component bolted on separately")

`@jini/renderers-react`'s `ArtifactView` (Part A) gained an optional
`annotation` prop (`Omit<AnnotationCanvasProps, 'children'>`). When
supplied, `ArtifactView` wraps whatever it resolves to render — a built-in
renderer (`SrcDocSandbox` for `html`/`svg`, the markdown `div`), a
host-supplied `slots.renderers[id]`, or even the "no renderer" fallback
message — in `<AnnotationCanvas>`. This mirrors the origin's real usage
(`PreviewDrawOverlay` wraps whichever iframe/webview `FileViewer.tsx`/
`DesignBrowserPanel.tsx` happened to render as `children`) while tying the
integration point to the artifact-resolution pipeline `RendererRegistry`
drives, rather than requiring a caller to separately import and wire
`AnnotationCanvas` next to `ArtifactView`. Covered by
`ArtifactView.test.tsx`'s new annotation-wiring tests.

## Validation (Part B — annotation-canvas)

`pnpm --filter @jini/renderers-react typecheck` — 0 errors (repo-wide, both
parts together). `pnpm --filter @jini/renderers-react test` — 193/193
passing (118 from Part A + 75 new: 29 `rules.test.ts`, 11 `drawing.test.ts`,
3 `dependencies.test.ts`, 19 `useAnnotationCanvas.test.ts`, 10
`AnnotationCanvas.test.tsx`, 3 new `ArtifactView.test.tsx` annotation-wiring
cases). `pnpm guard` clean. No product-identity strings anywhere in `src/`
(re-verified after Part B's additions via the same
`grep -rniE "open design|OD_|--od-stamp|/tmp/open-design"` + bare-`OD`-word
sweep — both empty across the whole package, not just this feature).

## Coverage pass (Part B follow-up) — one real bug found and fixed

While driving `useAnnotationCanvas.ts`/`AnnotationCanvas.tsx` to full test
coverage, the hook's internal `textAreaRefs` map (backing the
autofocus-on-create effect, the autosize-on-frame-change effect, and
`textBounds()`'s export-accurate measurement) turned out to never be
populated — the component's textarea `ref` callback only called
`autosizeTextArea(el)`, never registering `el` into the map at all. All
three features were silently no-ops at runtime (autofocus never focused,
the resize-driven autosize effect iterated an always-empty map, and
`textBounds()` always fell back to its 1×1-approximation branch instead of
measuring the real element). Fixed by adding a `registerTextArea(id, el)`
function to the controller (mirroring `updateTextMark`/`removeTextMark`'s
shape) and calling it from the textarea's `ref` callback alongside
`autosizeTextArea`. Behavior-only fix, no shape/API changes beyond the one
new controller method.
