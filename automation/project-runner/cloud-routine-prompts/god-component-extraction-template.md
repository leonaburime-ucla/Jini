# Cloud prompt template — Jini god-component extraction (any target, any tool)

Generalized from `god-component-extraction.md` (the `PreviewDrawOverlay.tsx`-specific worked
example). Use this for any *other* god-component in
`docs/jini-port/god-components-extraction-plan.md`'s consolidation map — Claude Code routine,
Codex Cloud task, or a manual session. Fill in the `{{...}}` placeholders before dispatching.

The mechanism that makes this "force it to read the plan" rather than "ask nicely": step 1 of
the Reference Preflight below is a **blocking, printed-output requirement**, not a suggestion —
a dispatch that skips it has visibly failed the task's own instructions, the same way a red-spec
task that reports `succeeded` without a failing test has. If the target isn't in the
consolidation map at all, or the dispatch can't tell which row it belongs to, it must stop and
report the gap rather than invent a destination — an invented destination is exactly how the
connector-config cluster nearly ended up as 3 separate near-duplicate extractions before anyone
wrote the map down.

```text
You are working in the Jini repository. Your task is to extract the generic
core of Open Design's {{TARGET_FILE}} (or the specific named sub-component(s)
within it, if the plan's consolidation map scopes it narrower than the whole
file) into the appropriate @jini package, leaving OD-specific behavior behind
an injected adapter seam. Work only on this task's branch and finish with a
draft PR; never push directly to main.

Before editing any file, complete and print this exact Reference Preflight:

1. Read `docs/jini-port/god-components-extraction-plan.md` in full, in
   particular its "Consolidation map" section. Quote the exact row (or rows)
   covering {{TARGET_FILE}}, including:
   - Which destination *kind* it is: a shared feature (multiple source files
     feed one destination — check whether any of the other sources for that
     same destination have already landed, and if so read that destination's
     existing code as your starting shape, do not design a second one from
     scratch), an own feature (single source, no known duplicate), or a flat
     component/hook/util (small, stateless, no feature-local state).
   - The exact target destination name given in the map (e.g.
     `features/tab-strip/`, not an invented name).
   - Any "overlap spotted while building this map" note that mentions your
     target — if one exists, read the other file it's compared against before
     designing your shape, don't extract in isolation and risk a second
     near-duplicate.
   If {{TARGET_FILE}} is NOT in the consolidation map at all, or its listed
   destination is marked "blocked" or "not yet actionable," STOP here and
   report the gap. Do not invent a destination, and do not proceed past a
   blocked/not-yet-actionable item without a human ruling on the blocking
   question first.
2. Jini branch and SHA; confirm whether {{TARGET_FILE}} needs live-OD-source
   verification the way `PreviewDrawOverlay.tsx` did (see
   `automation/project-runner/src/cli/verify-od-preview-reference.ts` for the
   pattern — fetch the canonical upstream ref, confirm the pinned SHA, byte-
   compare against the vendored snapshot) or whether the vendored snapshot at
   `integrations/open-design/reference/components-original/` is sufficient
   (state which, and why — if a live-source check is warranted and no
   equivalent script exists yet for this target, write one first, following
   that script's structure, rather than skipping the check).
3. Confirm you read {{TARGET_FILE}} in full from the vendored (or live-
   verified) source — not just the recon doc's summary of it — specifically
   locating every section/sub-component the consolidation map's row names.
4. Confirm you read `docs/jini-port/recon/r6-god-component-internals.md`
   section {{R6_SECTION}} (the full analysis this task is derived from).
5. If your destination is a shared feature with existing code already
   landed (see step 1), confirm you read that existing feature's `ports.ts`/
   `dependencies.ts`/`rules.ts`/component shape as your structural starting
   point — packages/ui/source-map.md's per-feature section has the
   provenance and design rationale.
6. Name what stays OD-specific and why, matching the consolidation map's own
   framing for this row.
7. Record the exact green-baseline commands you'll re-run at the end.

Read these Jini references before designing the slice:
- AGENTS.md
- docs/jini-port/START-HERE.md
- docs/jini-port/god-components-extraction-plan.md (especially the
  Consolidation map and the i18n policy sections near the top)
- docs/jini-port/recon/r6-god-component-internals.md section {{R6_SECTION}}
- packages/ui/README.md and packages/ui/source-map.md
- integrations/open-design/reference/dev-skills-original/fixing-open-design-web/SKILL.md

Implementation rules:
- Follow the MemorySection vertical-slice shape: ports, a single dependencies
  binding seam, feature-local hooks, presentational components, a public
  barrel, and tests outside source directories (or colocated `.test.ts(x)`
  files, matching this repo's existing convention).
- Keep public @jini surfaces product-neutral. Do not add Open Design names,
  imports, or string identities to packages/@jini — including in comments
  that cite the vendored reference path literally (a real mistake that
  slipped through once already; see packages/ui/source-map.md's connectors
  addendum).
- Follow the i18n policy in god-components-extraction-plan.md: every
  user-facing string wired through useT() with the English string as the
  key, verified with a real test mounting under I18nProvider with a
  translated dictionary — not just that it compiles. Audit every function
  that produces display text, not just top-level JSX (a count-based badge
  helper was missed this way once already).
- Apply the Phase 8.5 audit from the fixing-open-design-web SKILL.md on your
  own new files: inline JSX callbacks, useMemo/useEffect bodies, orphaned
  state. This has caught real hidden logic on every canary run in this repo
  so far — do not skip it because the component feels small.
- Run the package typecheck/tests, pnpm guard, and a purity grep for
  product-identity strings. Report concrete outputs, not just command names.

Finish with a concise summary: the full Reference Preflight output (including
the exact consolidation-map row quoted), files changed, OD behavior left
behind, validation results, source discrepancies, and the draft PR URL (or, if
`gh` isn't available/authenticated in this environment, the branch name and a
comparison URL for a human to open the PR manually).
```
