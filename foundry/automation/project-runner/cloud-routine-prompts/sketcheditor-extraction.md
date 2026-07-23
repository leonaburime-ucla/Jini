# Cloud prompt — `SketchEditor.tsx` extraction (filled in from the template)

Filled in from `god-component-extraction-template.md` for the next item after the two canaries
already landed (`ConnectorsBrowser.tsx` done, `DesignSystemFlow.tsx` progress-card in PR #1;
`PreviewDrawOverlay.tsx` was reverted after an independent review found undisclosed gaps and is
open again — see `god-component-extraction.md`). Per the consolidation map in
`foundry/docs/jini-port/god-components-extraction-plan.md`, `SketchEditor.tsx` is an **own feature** —
standalone, no known duplicate elsewhere in the 23-file sweep, no cluster dependency to resolve
first. Paste the block below into Codex Cloud (or a Claude Code routine) as-is.

```text
You are working in the Jini repository. Your task is to extract the generic
core of Open Design's SketchEditor.tsx into the appropriate @jini package,
leaving OD-specific behavior behind an injected adapter seam. Work only on
this task's branch and finish with a draft PR; never push directly to main.

Before editing any file, complete and print this exact Reference Preflight:

1. Read foundry/docs/jini-port/god-components-extraction-plan.md in full, in
   particular its "Consolidation map" section. Quote the exact row covering
   SketchEditor.tsx: it is filed under "B. Own feature (single source, no
   known duplicate elsewhere in this sweep)", target
   `features/sketch-editor/` (or `@jini/renderers-react` if that package
   already has a natural home for a third-party-editor-embedding shim by the
   time you read this -- check its README/source-map first). If anything
   about that classification looks wrong once you've actually read the file
   (e.g. you find it secretly duplicates something else in the sweep), stop
   and report the discrepancy rather than silently overriding the map.
2. Jini branch and SHA. SketchEditor.tsx has no known live-OD-branch
   durability concern the way PreviewDrawOverlay.tsx did (no tracked PR
   reference in foundry/docs/jini-port/od-reference-branches.md) -- the vendored
   snapshot at foundry/integrations/open-design/reference/components-original/
   SketchEditor.tsx is sufficient; you do not need to write or run a
   live-upstream verification script for this target. State this
   explicitly rather than silently skipping the check.
3. Confirm you read SketchEditor.tsx (1,088 lines) in full. Per r6 section
   1.22: roughly 60-70% of the file is a reusable Excalidraw-integration
   shim -- theme-sync effect, saved/dirty-indicator timers, scene
   diff/save/export glue via content-signature dedupe, `excalidrawUIOptions`/
   custom MainMenu composition, and a ~300-line DOM-enhancement/shim toolkit
   (MutationObserver-driven tooltip injection, context-menu simplification,
   i18n text overrides, toast rewriting, portal/modal enhancement for Mermaid
   dialogs). OD-specific and cleanly separable: legacy sketch-item migration
   (OD's pre-Excalidraw hand-rolled format), the `.sketch.json`/file-model
   naming convention in callback contracts, OD's own i18n hook and
   locale-string override tables, and `od-*` CSS class names.
4. Confirm you read foundry/docs/jini-port/recon/r6-god-component-internals.md
   section 1.22 (the full analysis this task is derived from).
5. This is a genuinely new feature folder, not a shared one -- no existing
   `features/<name>/` to read as a starting shape. Instead read
   packages/ui/src/features/connectors/ (the ConnectorsBrowser canary) and
   packages/ui/src/features/progress-card/ (the DesignSystemFlow canary,
   currently in draft PR #1 on this repo) as the two most recent, most
   scrutinized examples of the ports+dependencies+hooks+components+barrel
   shape and the i18n/Phase-8.5/purity discipline expected here -- NOTE: both
   of those still use the OLD flat layout (hooks/, components/ directly under
   the feature folder); this task should use the NEW layout instead (see
   rule below), so match their internal discipline, not their exact folder
   paths.
6. Name what stays OD-specific (the four items in step 3's second half) and
   why -- this matches the consolidation map's own framing for this row.
7. Record the exact green-baseline commands you'll re-run at the end.

Read these Jini references before designing the slice:
- AGENTS.md
- foundry/docs/jini-port/START-HERE.md
- foundry/docs/jini-port/god-components-extraction-plan.md (especially the
  Consolidation map and the i18n policy sections near the top)
- foundry/docs/jini-port/recon/r6-god-component-internals.md section 1.22
- packages/ui/README.md and packages/ui/source-map.md
- foundry/integrations/open-design/reference/dev-skills-original/fixing-open-design-web/SKILL.md

Implementation rules:
- Follow the MemorySection vertical-slice shape: ports (onSave/onExportImage/
  scene persistence), a single dependencies binding seam, feature-local
  hooks, presentational components, a public barrel, and colocated
  .test.ts(x) files. Use the NEW layout (decided 2026-07-17, see
  packages/ui/README.md): types.ts/constants.ts/rules.ts/ports.ts/
  dependencies.ts/index.ts stay at the feature's top level; hooks/ and
  components/ (anything importing React) move under a react/ subfolder --
  features/sketch-editor/react/{hooks,components}/.
- Keep public @jini surfaces product-neutral. Do not add Open Design names,
  imports, or string identities to packages/@jini -- including in comments
  that cite the vendored reference path literally (a real mistake that
  slipped through once already; see packages/ui/source-map.md's connectors
  addendum).
- Follow the i18n policy in god-components-extraction-plan.md: every
  user-facing string wired through useT() with the English string as the
  key, verified with a real test mounting under I18nProvider with a
  translated dictionary -- not just that it compiles. Audit every function
  that produces display text, not just top-level JSX (a count-based badge
  helper was missed this way once already on an earlier canary).
- Apply the Phase 8.5 audit from the fixing-open-design-web SKILL.md on your
  own new files: inline JSX callbacks, useMemo/useEffect bodies, orphaned
  state. This has caught real hidden logic on every canary run in this repo
  so far -- do not skip it because the shim toolkit feels mechanical.
- Genericize the parameterized tooltip/i18n-override table the MainMenu/
  DOM-enhancement toolkit uses -- do not hardcode OD's specific override
  strings into the shipped component.
- Run the package typecheck/tests, pnpm guard, and a purity grep for
  product-identity strings. Report concrete outputs, not just command names.

Finish with a concise summary: the full Reference Preflight output (including
the exact consolidation-map row quoted), files changed, OD behavior left
behind, validation results, source discrepancies, and the draft PR URL (or, if
gh isn't available/authenticated in this environment, the branch name and a
comparison URL for a human to open the PR manually).
```
