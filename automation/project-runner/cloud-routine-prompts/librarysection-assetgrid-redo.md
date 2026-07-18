# Cloud prompt — `LibrarySection.tsx` AssetGrid redo (Claude Code)

A first attempt at this target (via Codex Cloud, "Extract AssetGrid feature from LibrarySection")
landed 6 of 9 generic behaviors correctly, but was never committed after review found 2 real gaps
(one entirely undisclosed). This is a from-scratch redo -- the prior attempt's files were never
merged, so there's nothing to diff against; just build it right this time.

```text
You are working in the Jini repository. Your task is to extract the generic
"live-updating, filterable, multi-selectable asset grid" pattern from Open
Design's LibrarySection.tsx into @jini/ui. Work only on this task's branch
and finish with a draft PR; never push directly to main.

Before editing any file, complete and print this exact Reference Preflight:

1. Read docs/jini-port/god-components-extraction-plan.md's "Consolidation
   map" section and quote the exact row covering LibrarySection.tsx --
   target features/asset-grid/ (generic AssetGrid<TAsset>). A prior attempt
   at this target was never merged after review found gaps -- this is a
   fresh port.
2. Jini branch and SHA. This environment has ONE repo source -- the
   vendored snapshot at
   integrations/open-design/reference/components-original/LibrarySection.tsx
   is the source of truth.
3. Confirm you read LibrarySection.tsx (1,401 lines) in full. Per r6
   section 1.16, this is "the second-strongest candidate after
   ConnectorsBrowser.tsx" -- a generic asset-grid pattern (comparable to a
   photo library/DAM) with ALL of these pieces confirmed generic and
   REQUIRED (not optional) in this port:
   a. Rubber-band multi-select (snapshotCardRects/cardIdsInBand) -- "the
      cleanest generic core found in the whole sweep," operates purely on
      HTMLElement rects and Set<string> ids.
   b. Day-bucketed timeline grouping.
   c. Kind/source facet filtering.
   d. Debounced search.
   e. SSE live-merge reconciliation for incremental updates.
   f. GRID/TIMELINE VIEW TOGGLE -- a real, distinct UI mode switch. The
      prior attempt at this target dropped this entirely without
      disclosing it. Read the original carefully for how the two view
      modes actually differ (not just "grouped by day" vs "flat grid" --
      confirm from the source what each mode actually renders) and ship
      both, with a toggle control.
   g. BULK-DELETE-WITH-CONFIRM -- a generic UI affordance: a "delete
      selected" action with a confirmation step, and a Delete-key keyboard
      shortcut, wired to a host-supplied callback (the actual destructive
      API call is correctly host-owned/OD-specific -- but the confirm-UI
      and the callback slot for it are NOT optional; the prior attempt's
      source-map.md said "product actions (delete/...)" were host-owned via
      callbacks, but then shipped no callback prop for it at all -- that
      was the actual gap, not the classification. Add a real
      onDeleteSelected callback prop and a confirm-dialog affordance.
   h. Keyboard shortcuts: Cmd/Ctrl+A select-all, Escape clear-selection,
      Delete triggers the bulk-delete flow above (grep the original for
      these directly, do not assume from memory).
   i. Kind-aware thumbnail dispatch (host-injectable renderThumbnail slot).
4. Confirm you read docs/jini-port/recon/r6-god-component-internals.md
   section 1.16 (the full analysis this task is derived from).
5. Read packages/ui/src/features/connectors/ and
   packages/ui/src/features/progress-card/ as structural examples of the
   ports+dependencies+components+barrel shape and the i18n/Phase-8.5/purity
   discipline expected here -- NOTE: both still use the OLD flat layout;
   this task should use the NEW layout instead (see rule below).
6. Name what stays OD-specific: LibraryCard's "origin" action row
   (design-system/project/edit-as-page navigation) and the "multi-select ->
   add to design system" bulk action -- these are genuinely OD-specific and
   non-separable, per r6.
7. Record the exact green-baseline commands you'll re-run at the end.

Read these Jini references before designing the slice:
- AGENTS.md
- docs/jini-port/START-HERE.md
- docs/jini-port/god-components-extraction-plan.md (especially the
  Consolidation map and the i18n/React-layout policy sections near the top)
- docs/jini-port/recon/r6-god-component-internals.md section 1.16
- packages/ui/README.md and packages/ui/source-map.md
- integrations/open-design/reference/dev-skills-original/fixing-open-design-web/SKILL.md

Implementation rules:
- Follow the MemorySection vertical-slice shape: ports, a single
  dependencies binding seam, feature-local hooks, presentational
  components, a public barrel, and colocated .test.ts(x) files. Use the NEW
  layout (decided 2026-07-17, see packages/ui/README.md): types.ts/
  constants.ts/rules.ts/ports.ts/dependencies.ts/index.ts stay at the
  feature's top level; hooks/ and components/ (anything importing React)
  move under a react/ subfolder -- features/asset-grid/react/{hooks,components}/.
- Keep public @jini surfaces product-neutral. Do not add Open Design names,
  imports, or string identities to packages/@jini -- including in comments
  that cite the vendored reference path literally.
- Follow the i18n policy in god-components-extraction-plan.md: every
  user-facing string wired through useT() with the English string as the
  key, verified with a real test mounting under I18nProvider with a
  translated dictionary -- not just that it compiles.
- Apply the Phase 8.5 audit from the fixing-open-design-web SKILL.md on your
  own new files: inline JSX callbacks, useMemo/useEffect bodies, orphaned
  state.
- Write source-map.md's "retained generic behavior manifest" against the
  FULL list in step 3 above (a-i) -- for each one, state where it landed
  and what test proves it. Do not write a manifest that's silent on any of
  the 9 items; if you genuinely decide one doesn't belong, say so
  explicitly with reasoning, don't just omit it.
- Run the package typecheck/tests, pnpm guard, and a purity grep for
  product-identity strings. Report concrete outputs, not just command
  names.

Finish with a concise summary: the full Reference Preflight output
(including explicit confirmation that the view-toggle and bulk-delete
pieces from step 3 are present and tested), files changed, OD behavior left
behind, validation results, all test/typecheck/guard/purity results, and the
draft PR URL (or, if gh isn't available/authenticated in this environment,
the branch name and a comparison URL for a human to open the PR manually).
```
