# Cloud prompt — `PreviewDrawOverlay.tsx` redo (Claude Code, vendored-snapshot only)

A first attempt at this target (via Codex Cloud) landed with 2 undisclosed gaps and was reverted
(see `god-component-extraction.md`'s intro note for the full history). This is a from-scratch
redo, adapted for Claude Code's actual environment constraint: ONE repo source, no live OD
checkout — unlike `god-component-extraction.md`'s original wording, do not try to fetch a live OD
branch; the vendored snapshot is the source of truth here.

```text
You are working in the Jini repository. Your task is to extract the generic
core of Open Design's PreviewDrawOverlay.tsx into the appropriate @jini
package, leaving OD-specific capture, submission, and product-domain
behavior behind an injected adapter seam. Work only on this task's branch
and finish with a draft PR; never push directly to main.

Before editing any file, complete and print this exact Reference Preflight:

1. Read foundry/docs/jini-port/god-components-extraction-plan.md's "Consolidation
   map" section and quote the exact row covering PreviewDrawOverlay.tsx
   (destination kind, exact destination name -- packages/renderers-react/).
   A prior attempt at this exact target (via a different tool) landed with
   2 undisclosed gaps and was reverted -- this is a fresh port, not existing
   code to extend or diff against.
2. Jini branch and SHA. This environment has ONE repo source (no live OD
   checkout) -- the vendored snapshot at
   foundry/integrations/open-design/reference/components-original/PreviewDrawOverlay.tsx
   is the source of truth. State this explicitly rather than looking for a
   live branch.
3. Confirm you read PreviewDrawOverlay.tsx (2,158 lines) in full. Per r6
   section 1.9: the large majority of the file (freehand pen drawing +
   undo/redo WITH KEYBOARD SHORTCUTS, canvas redraw with rAF-coalescing and
   DPR scaling, box/rect multi-select, freeform draggable text-label tool
   with autosize/drag/double-tap-to-edit, and a collision-avoiding 4-side
   auto-flip floating-toolbar placement engine) is a coherent,
   tldraw/Excalidraw-style annotation-canvas library with essentially zero
   OD data-model dependency. Only a thin, already-isolated seam is
   OD-specific: the iframe-snapshot/composite/submit pipeline (markKind(),
   data-od-active/data-od-render-mode DOM attributes, postMessage bridge,
   ANNOTATION_EVENT/comments.ts submission contract).
4. Confirm you read foundry/docs/jini-port/recon/r6-god-component-internals.md
   section 1.9 (the full analysis this task is derived from).
5. MANDATORY -- explicitly locate and confirm you are including these two
   pieces, both missed by the prior (reverted) attempt without disclosure:
   a. The submit-action picker: the original has a real 'draft'/'queue'/
      'send' AnnotationAction type with a dropdown menu (submitOptions,
      setSubmitAction), distinct icon/label/pendingLabel per action, and an
      Enter-key shortcut that specifically triggers 'queue'. This is
      generic UX (how to submit something), not OD-specific -- ship the
      full picker, not just the type.
   b. ALL keyboard shortcuts: Escape deactivates the whole overlay,
      Cmd/Ctrl+Z undoes, Cmd/Ctrl+Shift+Z redoes, plus Escape-to-close
      handlers for the submit-menu and mark-tool-menu dropdowns (capture
      phase, stopPropagation so Escape closes the menu without also
      deactivating the whole overlay). Read the original's keydown
      listeners directly (search for addEventListener('keydown') -- there
      are multiple, at different scopes) rather than assuming a single
      handler covers everything.
6. Read packages/ui/src/features/connectors/ and
   packages/ui/src/features/progress-card/ as structural examples of the
   ports+dependencies+components+barrel shape and the i18n/Phase-8.5/purity
   discipline expected here -- NOTE: both still use the OLD flat layout;
   this task should use the NEW layout instead (see rule below).
7. Name what stays OD-specific (the iframe/snapshot/submit seam) and why.
8. Record the exact green-baseline commands you'll re-run at the end.

Read these Jini references before designing the slice:
- AGENTS.md
- foundry/docs/jini-port/START-HERE.md
- foundry/docs/jini-port/god-components-extraction-plan.md (especially the
  Consolidation map and the i18n/React-layout policy sections near the top)
- foundry/docs/jini-port/recon/r6-god-component-internals.md section 1.9
- packages/ui/README.md and packages/ui/source-map.md
- foundry/integrations/open-design/reference/dev-skills-original/fixing-open-design-web/SKILL.md

Implementation rules:
- Preserve the real OD behavior while extracting only generic annotation
  concerns. Product-specific iframe lookup, snapshot/composite, event
  dispatch, attachments, submission semantics, and OD domain types must be
  injected or remain in the OD adapter.
- Follow the MemorySection vertical-slice shape: ports, a single
  dependencies binding seam, feature-local hooks, presentational
  components, a public barrel, and colocated .test.ts(x) files. Use the NEW
  layout (decided 2026-07-17, see packages/ui/README.md): types.ts/
  constants.ts/rules.ts/ports.ts/dependencies.ts/index.ts stay at the
  feature's top level; hooks/ and components/ (anything importing React)
  move under a react/ subfolder -- e.g.
  packages/renderers-react/src/annotation-canvas/react/{hooks,components}/.
- Keep public @jini surfaces product-neutral. Do not add Open Design names,
  imports, or string identities to packages/@jini -- including in comments
  that cite the vendored reference path literally (a real mistake that
  slipped through once already; see packages/ui/source-map.md's connectors
  addendum).
- Follow the i18n policy in god-components-extraction-plan.md: every
  user-facing string wired through useT() with the English string as the
  key, verified with a real test mounting under I18nProvider with a
  translated dictionary -- not just that it compiles. If this package has
  no i18n mechanism of its own (check @jini/ui's features/i18n and whether
  it's reasonable to depend on it from @jini/renderers-react, or whether a
  host-overridable labels prop is more appropriate given the package
  boundary), make an explicit, documented choice either way -- don't
  silently hardcode English with no override at all.
- Apply the Phase 8.5 audit from the fixing-open-design-web SKILL.md on your
  own new files: inline JSX callbacks, useMemo/useEffect bodies, orphaned
  state. This has caught real hidden logic on every canary run in this repo
  so far.
- Write a thorough source-map.md "deliberately not extracted" section --
  the prior attempt's version of this section was incomplete (it didn't
  disclose the two gaps above at all). List every original behavior you
  are NOT porting and why, not just the obvious OD-specific ones.
- Run the package typecheck/tests, pnpm guard, and a purity grep for
  product-identity strings. Report concrete outputs, not just command
  names.

Finish with a concise summary: the full Reference Preflight output
(including explicit confirmation both mandatory pieces from step 5 are
present and tested), files changed, OD behavior left behind, validation
results, all test/typecheck/guard/purity results, and the draft PR URL (or,
if gh isn't available/authenticated in this environment, the branch name
and a comparison URL for a human to open the PR manually).
```
