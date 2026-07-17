# `@jini/renderers-react` — provenance

Origin: `integrations/open-design/reference/components-original/PreviewDrawOverlay.tsx`
(2,158 lines), per `docs/jini-port/god-components-extraction-plan.md`'s
Consolidation map (§B "Own feature") and `docs/jini-port/recon/r6-god-component-internals.md`
§1.9. This is the second attempt at this target — the first (via a
different tool) was reverted 2026-07-17 after an independent review found
2 undisclosed gaps (the submit-action picker, and every keyboard shortcut)
and it never used a task branch/draft PR. Both gaps are closed in this
port; see "The two previously-missing pieces" below.

If you are adding a new section to this file, append it below rather than
rewriting the whole document — this package will likely gain more content
(`SketchEditor.tsx`'s Excalidraw shim is next in the plan doc) and a merge
conflict here is expected and fine.

---

## Section: `annotation-canvas` — PreviewDrawOverlay.tsx port (2026-07-17)

### What this is

A tldraw/Excalidraw-style annotation-canvas overlay: freehand pen drawing
with undo/redo, box-select (accumulating — each drag commits another
region), draggable/autosizing text labels with double-tap-to-edit, and a
collision-avoiding 4-side auto-flip floating-toolbar placement engine. Per
r6 §1.9, only two relative imports in the original touch OD concepts at
all (`PreviewVisualMarkKind` from `../types`, `requestPreviewSnapshot` from
`../runtime/exports`) — everything else is React/DOM/canvas primitives.

### What shipped — `packages/renderers-react/src/annotation-canvas/`

Following the decided (2026-07-17) React-layout policy: `types.ts`/
`constants.ts`/`canvas-paint.ts`/`rules.ts`/`ports.ts`/`dependencies.ts`/
`index.ts` at the feature's top level (zero React import); everything
importing React under `react/{hooks,components}/`.

| File | Contents |
|---|---|
| `types.ts` | Generic `AnnotationPoint`/`AnnotationStroke`/`NormalizedRect`/`AnnotationRect`/`AnnotationTextMark`/`AnnotationMarkTool`/`AnnotationDockPlacement`/`AnnotationAction`/`AnnotationMarkKind`/`AnnotationToolbarElement`/`AnnotationTarget`/`AnnotationSnapshot`/`AnnotationSubmitPayload`/`AnnotationSubmitResult` — stripped of `PreviewVisualMarkKind` (which the original imported from `@open-design/contracts`, a forbidden import) in favor of a local 3-value union with the same semantics. |
| `constants.ts` | Stroke color/width, text sizing, dock geometry, box-commit min-size, double-tap window, client-side submit timeout — all the original's module-level constants, renamed `ANNOTATION_*`. |
| `canvas-paint.ts` | The pure `CanvasRenderingContext2D`-painting functions shared by the live redraw loop and the capture-time composite (`drawNormalizedBox`, `drawStrokes`, `drawTextMarks`, `drawAnnotationTarget`). No React; DOM-context-consuming but data-in/side-effect-on-the-given-context only, same category as this package's other pure-logic files. |
| `rules.ts` | All pure geometry/logic: `clamp`/`clamp01`/`rectsOverlap`/`normalizedRectFromPoints`/`normalizedRectToRect`/`unionRects`/`strokeRect`/`textMarksBounds`/`anchorBounds`/`annotationBounds`/`markKind`/`dockPlacementEquals`/`toolbarElementForTool`, plus **`computeDockPlacement`** — the collision-avoiding 4-side auto-flip placement engine (originally ~130 lines inline in a `useLayoutEffect`), extracted as a pure function taking already-measured rects so it can be unit-tested without a DOM. |
| `ports.ts` | `AnnotationCanvasPort` (`requestSnapshot`, optional `getCaptureFrameRect`, `submitAnnotation`) + `AnnotationCanvasDependencies`. Deliberately the *entire* product-specific surface — see "What stays host-specific" below. |
| `dependencies.ts` | `createFakeAnnotationCanvasPort`/`createFakeAnnotationCanvasDependencies` — an in-memory double (snapshot defaults to `null`, submit defaults to `{ ok: true }`), matching the `features/connectors` canary's "ship a fake, not a real transport" convention. This is also the component's actual default when a host passes no `dependencies` prop at all. |
| `react/hooks/useAnnotationTool.ts` | Mark-tool (box/pen/text) selection + its dropdown menu's open state, with outside-pointer-down and Escape (capture phase, `stopPropagation`) to close. |
| `react/hooks/useAnnotationDrawing.ts` | The canvas element's sizing/DPR scaling, the rAF-coalesced live redraw loop, and every freehand-stroke/box-select mutation + undo/redo history. Kept as one cohesive hook (not split further) — strokes, boxes, and the paint loop all read/write the same drawing surface and history stack; splitting them would only move shared refs across a hook boundary with no real separation of concerns. |
| `react/hooks/useAnnotationTextMarks.ts` | The text-label tool: placing a label, autosizing its textarea, dragging to reposition, double-tap/double-click to re-open for editing. |
| `react/hooks/useAnnotationDockPlacement.ts` | Resolves the floating-toolbar's portal host and runs `computeDockPlacement` on every wrap/dock/host resize or anchor change. |
| `react/hooks/useAnnotationSubmit.ts` | Note/attachment inputs, the capture→composite→submit pipeline, and the submit-action split button's dropdown state. |
| `react/hooks/useAnnotationKeyboardShortcuts.ts` | The overlay-wide Escape/Cmd-Z/Cmd-Shift-Z shortcuts. |
| `react/components/AnnotationCanvas.tsx` | The public orchestrator — composes all 5 hooks, owns `wrapRef`/`pendingAction`/`capturing`, renders the canvas + text layer + portalled toolbar dock. |
| `react/components/{MarkToolControl,HistoryButtons,AttachImageButton,NoteInput,SubmitControl,ImageAttachmentStrip,ImagePreviewModal,CaptureWarningBanner,AnnotationTextLayer,AnnotationToolbarDock}.tsx` | Dumb, presentational pieces. |
| `react/styles.ts` | The original's inline `CSSProperties` constants + the tooltip/remove-button `<style>` block, class-renamed `preview-draw-*` → `jini-annotation-*` (matching the `od-` → `jini-` rename precedent already applied to `Toast.tsx`/`TooltipLayer.tsx` in `packages/ui`). |
| `index.ts` | Public barrel. |

### The two previously-missing pieces (both now present and tested)

1. **The submit-action picker.** `AnnotationAction = 'draft' | 'queue' | 'send'` ships as a real split button (`SubmitControl.tsx`): the main half runs `submitAction` (defaults to `'send'`), the chevron opens a dropdown with all 3 options, each with its own icon/label/pending-label/enabled rule (`send` gated on `!sendDisabled`, `draft`/`queue` gated only on `canSubmit`). Picking a dropdown option (`pickSubmitAction`) sets it as the new default *and* runs it immediately, matching the original's `setSubmitAction` + `setSubmitMenuOpen(false)` + `void send(...)` in one click. Tested end-to-end in `AnnotationCanvas.test.tsx` ("the submit-action picker" describe block): all 3 options render, picking `Queue` submits with `action: 'queue'`, the primary half submits the selected action, and `sendDisabled`+`sendDisabledReason` disable only `Send` (not `Queue`/`Add to input`).
2. **Every keyboard shortcut.** `useAnnotationKeyboardShortcuts.ts` owns Escape (deactivate) / Cmd-or-Ctrl+Z (undo) / Cmd-or-Ctrl+Shift+Z (redo). `useAnnotationTool.ts` and `useAnnotationSubmit.ts` each own their own menu's Escape-to-close (capture phase, `stopPropagation`, so it closes only that menu — verified in `AnnotationCanvas.test.tsx`'s "the mark-tool dropdown menu" block that Escape closes the menu *without* deactivating the overlay). The note input's Enter key specifically triggers `send('queue')` (`NoteInput.tsx`'s `onEnterQueue`), not a generic submit — tested directly ("Enter in the note input submits via queue specifically"). Also ported, beyond what the task explicitly named: the staged-image-preview modal's own Escape-to-close, and a per-label textarea Escape-to-blur.

### What stays host-specific (not ported — the seam)

- **The snapshot/capture bridge.** The original's `activePreviewIframe()`/`snapshotHostIframe()` (DOM queries for `iframe[data-od-active="true"]`/`iframe[data-od-render-mode="srcdoc"]`), the `postMessage`-based `requestPreviewSnapshot` bridge, and the retry-with-growing-timeouts loop (`[1500, 3000, 6000]`) are all entirely host/iframe-specific. Collapsed into one port method, `AnnotationCanvasPort.requestSnapshot()` — a host's own adapter is free to implement retries/timeouts/iframe-lookup however it needs to.
- **The submission contract.** The original dispatched a global `window.dispatchEvent(new CustomEvent(ANNOTATION_EVENT, { detail }))` with a 60s manual ack-timeout race, consumed elsewhere in OD by `comments.ts`. Replaced with a direct `AnnotationCanvasPort.submitAnnotation(payload): Promise<AnnotationSubmitResult>` call (this package still enforces its own client-side timeout — `ANNOTATION_SUBMIT_TIMEOUT_MS`, 60s, same value — via a local `withTimeout` helper, so a host's slow/hung port still resolves the UI). No more global `CustomEvent`/`ANNOTATION_EVENT` — a generic package broadcasting a well-known global event name for an unspecified listener isn't a reusable contract, it's an OD-internal wiring detail.
- **`PreviewVisualMarkKind`.** Imported from `@open-design/contracts` in the original (a forbidden import for this package regardless of genericity). Replaced with a local `AnnotationMarkKind = 'click' | 'stroke' | 'click+stroke'` — same 3 values, same derivation (`markKind()` in `rules.ts`).
- **`captureTarget.filePath`.** The original's `CaptureTarget` had an OD-specific `filePath` field threaded through to the submit event. Dropped; `AnnotationTarget` has no OD-typed identifier field. A host that needs to correlate a target with its own domain object should pass whatever payload shape it wants through its own `submitAnnotation` port implementation — this package doesn't need to know that shape.
- **The `.viewer-body` toolbar-host fallback.** The original resolved a fallback portal host via `wrapRef.current?.closest('.viewer-body')` — `.viewer-body` is an OD-authored layout class name baked into what otherwise reads as generic DOM traversal (the same failure mode the `features/connectors` canary's own honesty notes flagged twice already: `ConnectorLogo`'s Composio CDN slug logic, `enterpriseUrl.ts`'s hardcoded domain). Replaced with an optional `toolbarHostSelector` prop — a host supplies its own class name (or omits it, and the toolbar renders inline in the wrap element).
- **Scroll-passthrough while drawing.** The original's `onCanvasWheel` scrolled the underlying preview iframe by posting `{ type: 'od:preview-scroll-by', ... }` (a bespoke wire message only OD's own srcDoc bridge understands) or calling `iframe.contentWindow.scrollBy` directly. This entire behavior — "let the user scroll the thing being annotated while drawing on top of it" — is inherently about an iframe-hosted preview and has no generic equivalent; not ported. A host that wants scroll-passthrough can add its own `onWheel` handling around `children`.

### Deliberate behavior deviations (disclosed, not silent)

- **The global Escape/Undo/Redo listener is now gated on `active`.** The original registered its `window.keydown` listener unconditionally (deps were `[onActiveChange, sending]`, not `active`) — meaning Cmd+Z/Cmd+Shift+Z would fire `undoStroke()`/`redoStroke()` (which only check `sending`, not `active`) even while the overlay was fully deactivated, silently hijacking a global shortcut whenever this component happened to be mounted. That reads as an oversight (a missing early return), not deliberate product behavior worth preserving into a new reusable package. `useAnnotationKeyboardShortcuts` only registers its listener while `active` is `true`.
- **The `<canvas>` element is now always mounted**, styled via `visibility` instead of being conditionally rendered (the original's `showCanvas = active || hasInk || hasBox || hasText` gated whether the element existed in the DOM at all). This was purely an internal DOM-node-count optimization in the original with no observable visual difference (an empty canvas costs a trivial `ResizeObserver` callback); keeping it conditional would have required `useAnnotationDrawing` to take `hasText` — owned by a different hook constructed after it needs to feed a param back into it — as an input, a real hook-ordering circularity with no clean resolution. Always-mounting sidesteps it. A side effect worth noting: text labels remain draggable via the canvas's bounding rect even while `active` is `false`, matching the original (the original's text-drag handlers never checked `active` either) — this was preserved, not changed.
- **`redo()` cannot restore an undone box** — this is **not** a deviation, it's the original's actual behavior, preserved: `undoStroke()` pops a committed box straight off `selectionBoxesRef` with nothing pushed to any redo stack; only freehand strokes go through `undoneStrokesRef`/redo. Called out here because it reads as a bug on first encounter (both an earlier draft of this port's own tests, and likely a future reviewer, would assume box-undo is redoable) — `AnnotationCanvas.test.tsx` has an explicit regression test asserting this one-way behavior on purpose.

### i18n — explicit choice made

`@jini/renderers-react` had no i18n mechanism of its own. Rather than
hardcode English with no override path (the gap the plan doc's i18n
policy specifically warns against), this package takes a real dependency
on **`@jini/ui`'s `features/i18n`** (`useT()`/`I18nProvider`) — the same
"English string is the key" convention already proven by the
`features/connectors` canary. This was a genuine build/dependency
decision, not a given: `@jini/renderers-react` is inherently a React
package already (it's the `renderers-react` package), and `@jini/ui`
already ships `Icon`/`RemixIcon` (which the original file also imported
directly), so depending on it reuses both the icon set and the i18n
mechanism instead of forking either. Per rule R2 in
`scripts/check-engine-boundaries.ts` ("engine packages import each other
only by package name"), this is a legitimate first-of-its-kind
`@jini/renderers-react` → `@jini/ui` dependency (`workspace:*` in
`package.json`) — no other `@jini/*` package depended on another one
before this port. Every user-facing string in every new component is
wrapped in `t('English literal')`; `AnnotationCanvas.test.tsx`'s last test
mounts under a real `I18nProvider` with a French dictionary and asserts
the Undo/Redo buttons render translated text, proving the wiring (not just
that `t()` calls compile).

### Phase 8.5 audit — what it caught

Ran the mandated audit (inline JSX callbacks, `useMemo`/`useEffect`
bodies, orphaned state) across every new file, not just a "zero top-level
functions" grep:

1. **Inline JSX callbacks**: enumerated every `on*={(e) => { ... }}` across
   all component files. All are ≤2 statements, single call site, and read
   as thin DOM-event shaping (IME composing flags, `preventDefault`+
   `stopPropagation` pairs, a backdrop-click-to-close comparison) rather
   than business logic — same bar the `features/connectors` canary used to
   leave its one inline backdrop-click handler alone. The one genuinely
   cross-cutting callback (the canvas `onPointerDown`, which has to
   dispatch between the drawing hook and the text-marks hook depending on
   the active tool — neither hook can own it alone) stays in the
   orchestrator per Phase 8's own escalation order ("nothing owns them"),
   with a comment explaining why.
2. **`useMemo`/`useEffect` bodies**: no `useMemo` exists anywhere in this
   feature (checked). Every `useEffect`/`useLayoutEffect` was reviewed —
   each does exactly one thing (resize, dock-placement compute,
   keyboard-shortcut registration, one specific menu's escape-close,
   object-URL lifecycle, textarea autosize) with no unextracted multi-line
   derivation hiding inside.
3. **Orphaned `useState`/`useRef`**: enumerated every one across all 8 new
   hook/component files with state. Found one real issue, not just a
   documentation gap: `useAnnotationDrawing`'s `layoutRevision` counter was
   correctly bumped on every box/stroke mutation (so re-renders still
   happened via its own `setState` call), but the orchestrator never
   actually threaded it into `useAnnotationDockPlacement`'s dependency
   list. Without it, `hasBox` staying `true` across a 2nd/3rd committed box
   means no *other* piece of drawing state changes value on that
   commit — the anchor is still recomputed correctly (it's derived fresh
   every render), but nothing was guaranteed to *force* that render for a
   2nd box specifically once `layoutRevision`'s own bump was the only
   thing keeping it honest. Fixed by adding `drawing.layoutRevision` to
   `useAnnotationDockPlacement`'s `extraDeps`, and added a regression test
   (`AnnotationCanvas.test.tsx`, "the floating dock repositions after a
   2nd box even though hasBox stays true throughout") that fails without
   the fix. No other orphaned state found.

### Test/typecheck/guard/purity results

- `pnpm --filter @jini/renderers-react exec tsc -p tsconfig.json --noEmit`: clean, zero errors.
- `pnpm --filter @jini/renderers-react run test` (vitest): **72 tests, 5 files, all green** — `rules.test.ts` (38, every pure geometry/logic function including 6 `computeDockPlacement` placement scenarios), `dependencies.test.ts` (6), `useAnnotationTool.test.ts` (3), `useAnnotationKeyboardShortcuts.test.ts` (6 — Escape/undo/redo/case-insensitivity/no-modifier/inactive-no-op), `AnnotationCanvas.test.tsx` (19 — rendering, box draw enabling undo, Cmd+Z/Cmd+Shift+Z round-trip via a pen stroke, toolbar undo/redo buttons, the one-way box-undo regression test, the multi-box dock-reposition regression test, Escape deactivation, the close button, the full submit-action-picker suite, the text-label tool including drop/blur-removes-empty/type-survives-blur/remove-button, the mark-tool menu's outside-click and Escape close, and the end-to-end French-dictionary i18n mount).
- Full monorepo `pnpm -r --if-present run typecheck`: only the 2 pre-existing, unrelated failures in `packages/agent-runtime`/`packages/chat-react` (both stub packages missing a `tsconfig.json` entirely — confirmed present before this task started, not touched by it).
- `pnpm guard` (repo root): `[guard] ok (skeleton — rules pending implementation during extraction)` — unchanged, no boundary violations introduced.
- Purity grep, `grep -rn "Open Design\|OD_\|--od-stamp\|/tmp/open-design\|@open-design/" packages/renderers-react/src`: one hit caught and fixed (a doc-comment in `src/index.ts` literally said "extracted from Open Design" — reworded to "generic, product-neutral React renderer primitives", matching the exact class of leak `packages/ui/source-map.md`'s connectors addendum already flagged once). A second, stricter self-imposed pass (`grep -rniE "od-[a-z]|open-design\.ai|openDesignDesktop|preview-draw|PreviewDrawOverlay|components-original|reference/od-web-src"`) is clean — the original's `preview-draw-*` CSS class names were renamed `jini-annotation-*`, and no file cites the vendored reference path literally.

### A doc discrepancy noticed, not fixed here

`docs/jini-port/god-components-extraction-plan.md`'s Consolidation map
lists `features/progress-card/` as "✅ landed, PR #1" — this checkout has
no `packages/ui/src/features/progress-card/` directory at all (confirmed
via `git ls-tree`). Flagged here rather than silently trusted, per this
task's own instruction to verify claims rather than accept documentation
at face value; not otherwise relevant to this port and left for whoever
next touches that entry.
