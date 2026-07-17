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

## Validation (this task)

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
