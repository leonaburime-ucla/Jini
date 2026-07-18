# Cloud prompt — `FileViewer.tsx` viewer-shell extraction (filled in from the template)

Filled in from `god-component-extraction-template.md`. Per the consolidation map in
`docs/jini-port/god-components-extraction-plan.md`, `FileViewer.tsx` is an **own feature**
(target `features/viewer-shell/`) — but it is the single largest file in the whole sweep
(14,275 lines) and only a **small fraction** of it is in scope. Scope discipline matters more
here than on any other item dispatched so far — read the scope section below before anything else.

```text
You are working in the Jini repository. Your task is to extract ONLY the
generic "media-viewer shell" pattern from Open Design's FileViewer.tsx into
@jini/ui, leaving the rest of this 14,275-line file completely untouched.
Work only on this task's branch and finish with a draft PR; never push
directly to main.

Before editing any file, complete and print this exact Reference Preflight:

1. Read docs/jini-port/god-components-extraction-plan.md in full, in
   particular its "Consolidation map" section. Quote the exact row covering
   FileViewer.tsx: it is filed under "B. Own feature", target
   features/viewer-shell/. Also note the "5 more overlaps spotted" list in
   that same section -- it flags a possible duplicate between THIS file's
   PreviewViewportControls/FileVersionViewportControls and
   DesignBrowserPanel.tsx's BrowserViewportControls (a different god-file,
   not yet extracted). Do not silently extract a second competing
   viewport-switcher primitive -- if you extract this piece, read
   DesignBrowserPanel.tsx's BrowserViewportControls too (vendored at
   integrations/open-design/reference/components-original/DesignBrowserPanel.tsx)
   and either confirm they're genuinely the same shape (design one shared
   primitive) or document precisely why they differ enough to ship two.
2. Jini branch and SHA. No known live-OD-branch durability concern for this
   target (no tracked PR reference in docs/jini-port/od-reference-branches.md)
   -- the vendored snapshot at
   integrations/open-design/reference/components-original/FileViewer.tsx is
   sufficient. State this explicitly.
3. Confirm you read docs/jini-port/recon/r6-god-component-internals.md
   section 1.1 (the full analysis this task is derived from) BEFORE reading
   the source file, so you know exactly which ~6-9 pieces are in scope
   before you go looking for them in a 14,275-line file.
4. Confirm you located and read IN FULL every in-scope piece listed below
   (not the whole file -- that would be a waste of budget on code that's
   staying OD-specific, and risks scope creep into HtmlViewer/
   FileVersionManagerModal, which must NOT be touched).
5. This is a genuinely new feature folder. Read
   packages/ui/src/features/connectors/ and packages/ui/src/features/progress-card/
   as structural examples of the ports+dependencies+components+barrel shape
   and the i18n/Phase-8.5/purity discipline expected here -- NOTE: both of
   those still use the OLD flat layout (hooks/, components/ directly under
   the feature folder); this task should use the NEW layout instead (see
   rule below).
6. Name what stays OD-specific and why (the two large exclusions below).
7. Record the exact green-baseline commands you'll re-run at the end.

SCOPE -- read r6 section 1.1 for full detail, but the in-scope pieces are:
- The media-viewer shell family: BinaryViewer, DocumentPreviewViewer,
  ImageViewer, SketchViewer, VideoViewer, AudioViewer, SvgViewer, TextViewer
  -- a "viewer-toolbar + viewer-body" shell independently repeated 9 times
  in this one file, parameterized only by a {name,size,mtime}-shaped file
  reference. This is the highest-value single piece -- 9x internal
  repetition is unusually strong evidence of a missing shared primitive.
  Design ONE generic shell component/hook (host supplies the file ref shape
  and a content-renderer slot per viewer kind) rather than porting all 8 as
  near-duplicate components.
- PreviewViewportControls/FileVersionViewportControls -- responsive
  desktop/tablet/mobile viewport switcher, zero business types. Check the
  DesignBrowserPanel.tsx overlap noted in preflight step 1 before shipping.
- CommentSidePanel/CommentSideDock -- already prop-abstracted
  (comments/selectedIds/onToggleSelect/onReorder/onCreateComment/
  `composer: ReactNode` slot in the original); only the comment item's own
  type is OD-specific (accept it as a generic type parameter, don't port
  OD's concrete comment shape).
- CodeWithLines, JsonPanel -- trivial, zero-dependency, ship close to
  verbatim.
- MarkdownViewer's split source/preview pane with scroll-sync -- generic;
  only the artifact-status gate around it ties it to OD (drop the gate,
  keep the split-pane/scroll-sync mechanism).

OUT OF SCOPE -- do NOT touch, do NOT read in full (skim only enough to
confirm the boundary, per r6 section 1.1):
- HtmlViewer (~7,110 lines, ~50% of the file) -- deploy-provider selection,
  live-artifact daemon streaming, board/pod annotation, manual-edit CSS
  bridge. Confirmed OD-specific by a full read in r6; do not re-verify by
  reading the whole thing again, that budget is better spent on the
  in-scope pieces above.
- FileVersionManagerModal (~1,050 lines) -- version-history is a generic
  concept, but this implementation is saturated with OD
  analytics/deploy/export calls. Confirmed OD-specific in r6. Leave as-is.

Read these Jini references before designing the slice:
- AGENTS.md
- docs/jini-port/START-HERE.md
- docs/jini-port/god-components-extraction-plan.md (especially the
  Consolidation map and the i18n/React-layout policy sections near the top)
- docs/jini-port/recon/r6-god-component-internals.md section 1.1
- packages/ui/README.md and packages/ui/source-map.md
- integrations/open-design/reference/dev-skills-original/fixing-open-design-web/SKILL.md

Implementation rules:
- Follow the MemorySection vertical-slice shape: ports, a single dependencies
  binding seam, feature-local hooks, presentational components, a public
  barrel, and colocated .test.ts(x) files. Use the NEW layout (decided
  2026-07-17, see packages/ui/README.md): types.ts/constants.ts/rules.ts/
  ports.ts/dependencies.ts/index.ts stay at the feature's top level; hooks/
  and components/ (anything importing React) move under a react/ subfolder
  -- features/viewer-shell/react/{hooks,components}/.
- This feature likely ships MULTIPLE related pieces (the shell, viewport
  controls, comment panel, code/json panels, markdown split-pane) rather
  than one component -- organize react/components/ with one file per piece,
  sharing rules.ts/types.ts where the logic genuinely overlaps (e.g. the
  viewer-shell's toolbar chrome), not forcing everything into one giant
  component.
- Keep public @jini surfaces product-neutral. Do not add Open Design names,
  imports, or string identities to packages/@jini -- including in comments
  that cite the vendored reference path literally (a real mistake that
  slipped through once already; see packages/ui/source-map.md's connectors
  addendum).
- Follow the i18n policy in god-components-extraction-plan.md: every
  user-facing string wired through useT() with the English string as the
  key, verified with a real test mounting under I18nProvider with a
  translated dictionary -- not just that it compiles. Audit every function
  that produces display text, not just top-level JSX.
- Apply the Phase 8.5 audit from the fixing-open-design-web SKILL.md on your
  own new files: inline JSX callbacks, useMemo/useEffect bodies, orphaned
  state. This has caught real hidden logic on every canary run in this repo
  so far.
- An independent review of a prior extraction in this repo found generic
  behaviors (a view-mode toggle, a bulk-action affordance) that were
  entirely missing and NOT disclosed in that task's source-map.md entry.
  Before finishing, explicitly cross-check every piece you extract against
  its full description in r6 section 1.1 -- if you drop or simplify
  something r6 called generic, say so explicitly in source-map.md, do not
  let it become a silent gap.
- Run the package typecheck/tests, pnpm guard, and a purity grep for
  product-identity strings. Report concrete outputs, not just command names.

Finish with a concise summary: the full Reference Preflight output (including
the exact consolidation-map row and the viewport-controls overlap check),
files changed, OD behavior left behind (the two large exclusions plus
anything else), validation results, source discrepancies, and the draft PR
URL (or, if gh isn't available/authenticated in this environment, the branch
name and a comparison URL for a human to open the PR manually).
```
