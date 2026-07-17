# Cloud prompt — `DesignBrowserPanel.tsx` browser-chrome extraction (Claude Code)

Per the consolidation map, `DesignBrowserPanel.tsx` is Section B ("own feature", target
`features/browser-chrome/`) — 3,654 lines, but r6 flags it as "the second-strongest
undersold-by-aggregate-count finding after PluginsView.tsx": only 20-25% of the file is in scope,
the rest is genuinely OD-specific. This routine runs AFTER the `features/viewer-shell/` routine
(FileViewer.tsx, scheduled earlier the same night) — check its outcome before deciding on the
viewport-controls piece below, since both files may ship the same primitive.

```text
You are working in the Jini repository. Your task is to extract ONLY the
generic "embeddable webview/iframe browser tab" primitive from Open
Design's DesignBrowserPanel.tsx into @jini/ui, leaving the OD-specific
majority of this 3,654-line file completely untouched. Work only on this
task's branch and finish with a draft PR; never push directly to main.

Before editing any file, complete and print this exact Reference Preflight:

1. Read docs/jini-port/god-components-extraction-plan.md's "Consolidation
   map" section and quote the exact row covering DesignBrowserPanel.tsx --
   filed under Section B, target features/browser-chrome/. Also note the
   "5 more overlaps spotted" list in that same section -- it flags a
   possible duplicate between THIS file's BrowserViewportControls and
   FileViewer.tsx's PreviewViewportControls/FileVersionViewportControls.
   FIRST check whether a features/viewer-shell/ feature already exists in
   this repo (packages/ui/src/features/viewer-shell/) -- a routine
   targeting FileViewer.tsx ran earlier the same night and may have already
   shipped a viewport-switcher primitive and/or documented why it's
   distinct from this one. If it exists, read its viewport-controls piece
   and either reuse/extend it (do not ship a second competing primitive)
   or document precisely why this one must be separate. If it doesn't
   exist yet, ship BrowserViewportControls here and leave a clear note in
   source-map.md for whoever does FileViewer.tsx's viewport controls next
   to check this one first.
2. Jini branch and SHA. This environment has ONE repo source -- the
   vendored snapshot at
   integrations/open-design/reference/components-original/DesignBrowserPanel.tsx
   is the source of truth.
3. Confirm you read docs/jini-port/recon/r6-god-component-internals.md
   section 1.12 (the full analysis this task is derived from) BEFORE
   reading the source file, so you know exactly which piece is in scope
   before searching for it in a 3,654-line file.
4. Confirm you located and read IN FULL every in-scope piece listed below.
5. Read packages/ui/src/features/connectors/ and
   packages/ui/src/features/progress-card/ as structural examples of the
   ports+dependencies+components+barrel shape and the i18n/Phase-8.5/purity
   discipline expected here -- NOTE: both still use the OLD flat layout;
   this task should use the NEW layout instead (see rule below).
6. Name what stays OD-specific and why (the exclusions below).
7. Record the exact green-baseline commands you'll re-run at the end.

SCOPE -- read r6 section 1.12 for full detail, but the in-scope pieces are:
- Navigation stack, address-bar normalization, history/favicon utilities
  (loadHistory/saveHistory/normalizeBrowserAddress/faviconUrl) -- all pure
  string/URL/localStorage functions. Only residue is a renameable
  storage-key string (genericize it, do not hardcode an OD-branded key).
- BrowserViewportControls -- responsive viewport-preset switcher (see the
  overlap-check in preflight step 1 before shipping this).
- Design ports for onNavigate, history storage, and brand-bridge
  registration (the registration mechanism itself is generic even though
  what gets registered -- brand-extraction -- is OD-specific; the port
  should let a host wire in its own registration callback rather than
  hardcoding OD's registerBrandBrowser call).

ALSO NOTE (shape-generic/OD-data, same class as byok/* -- use judgment on
whether these are worth including in this pass or flagging for later):
- BrowserUseMenu -- searchable grouped-action menu SHAPE is generic, the
  action catalog DATA is OD-specific (an AI "browser-use" tool-action
  catalog). If included, the component must take the catalog as a prop, not
  own it.
- BrowserInspectPanel -- generic color-picker/range-slider quick-CSS-editor
  shape, OD element-snapshot data. Same treatment: shape ships, OD data
  becomes a host-supplied type parameter.

OUT OF SCOPE -- do NOT touch:
- registerBrandBrowser's actual brand-extraction logic (only the
  registration MECHANISM/port is in scope, not what OD registers).
- BrowserCommentMarkers/BrowserCommentComposer (board-comment annotation --
  OD-specific).
- The AI "browser-use" tool-action catalog's actual OD-specific action
  definitions, page-archive/brief capture for AI-agent consumption, and the
  hardcoded REFERENCE_GROUPS design-inspiration bookmark content.

Read these Jini references before designing the slice:
- AGENTS.md
- docs/jini-port/START-HERE.md
- docs/jini-port/god-components-extraction-plan.md (especially the
  Consolidation map and the i18n/React-layout policy sections near the top)
- docs/jini-port/recon/r6-god-component-internals.md section 1.12
- packages/ui/README.md and packages/ui/source-map.md
- integrations/open-design/reference/dev-skills-original/fixing-open-design-web/SKILL.md

Implementation rules:
- Follow the MemorySection vertical-slice shape: ports (onNavigate/history
  storage/brand-bridge registration), a single dependencies binding seam,
  feature-local hooks, presentational components, a public barrel, and
  colocated .test.ts(x) files. Use the NEW layout (decided 2026-07-17, see
  packages/ui/README.md): types.ts/constants.ts/rules.ts/ports.ts/
  dependencies.ts/index.ts stay at the feature's top level; hooks/ and
  components/ (anything importing React) move under a react/ subfolder --
  features/browser-chrome/react/{hooks,components}/.
- Keep public @jini surfaces product-neutral. Do not add Open Design names,
  imports, or string identities to packages/@jini -- including in comments
  that cite the vendored reference path literally.
- Follow the i18n policy in god-components-extraction-plan.md: every
  user-facing string wired through useT() with the English string as the
  key, verified with a real test mounting under I18nProvider with a
  translated dictionary.
- Apply the Phase 8.5 audit from the fixing-open-design-web SKILL.md on
  every new file.
- Two prior extractions in this repo shipped with real, undisclosed gaps
  (a missing view-mode toggle, a missing bulk-action affordance, a missing
  submit-action picker, missing keyboard shortcuts) because source-map.md's
  "what was dropped" section wasn't checked against the recon doc's full
  description. Before finishing, explicitly cross-check every piece you
  extract against its full description in r6 section 1.12 -- if you drop
  or simplify something r6 called generic, say so explicitly in
  source-map.md, do not let it become a silent gap.
- Run the package typecheck/tests, pnpm guard, and a purity grep for
  product-identity strings. Report concrete outputs, not just command
  names.

Finish with a concise summary: the full Reference Preflight output
(including the viewport-controls overlap check and its outcome), files
changed, OD behavior left behind (all three exclusions), validation results,
all test/typecheck/guard/purity results, and the draft PR URL (or, if gh
isn't available/authenticated in this environment, the branch name and a
comparison URL for a human to open the PR manually).
```
