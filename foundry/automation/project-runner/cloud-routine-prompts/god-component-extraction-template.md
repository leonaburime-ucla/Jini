# Cloud prompt template — Jini god-component extraction (any target, any tool)

Generalized from `god-component-extraction.md` (the `PreviewDrawOverlay.tsx`-specific worked
example). Use this for any *other* god-component in
`foundry/docs/jini-port/god-components-extraction-plan.md`'s consolidation map — Claude Code routine,
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

1. Read `foundry/docs/jini-port/god-components-extraction-plan.md` in full, in
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
   `foundry/automation/project-runner/src/cli/verify-od-preview-reference.ts` for the
   pattern — fetch the canonical upstream ref, confirm the pinned SHA, byte-
   compare against the vendored snapshot) or whether the vendored snapshot at
   `foundry/integrations/open-design/reference/components-original/` is sufficient
   (state which, and why — if a live-source check is warranted and no
   equivalent script exists yet for this target, write one first, following
   that script's structure, rather than skipping the check).
3. Confirm you read {{TARGET_FILE}} in full from the vendored (or live-
   verified) source — not just the recon doc's summary of it — specifically
   locating every section/sub-component the consolidation map's row names.
4. Confirm you read `foundry/docs/jini-port/recon/r6-god-component-internals.md`
   section {{R6_SECTION}} (the full analysis this task is derived from).
5. If your destination is a shared feature with existing code already
   landed (see step 1), confirm you read that existing feature's `ports.ts`/
   `dependencies.ts`/`rules.ts`/component shape as your structural starting
   point — packages/ui/source-map.md's per-feature section has the
   provenance and design rationale.
6. Name what stays OD-specific and why, matching the consolidation map's own
   framing for this row.
7. Record the exact green-baseline commands you'll re-run at the end.
8. Print a retained-behavior manifest before implementation. Every generic
   behavior needs its source line(s), target module/port, and proving test.
   Explicitly include keyboard, pointer/cancel/drag/edit, history,
   resize/observer/transform, accessibility, and responsive-placement behavior
   when applicable. Mark only genuinely product-bound behavior as host-owned.

Read these Jini references before designing the slice:
- AGENTS.md
- foundry/docs/jini-port/START-HERE.md
- foundry/docs/jini-port/god-components-extraction-plan.md (especially the
  Consolidation map and the i18n policy sections near the top)
- foundry/docs/jini-port/recon/r6-god-component-internals.md section {{R6_SECTION}}
- packages/ui/README.md and packages/ui/source-map.md
- foundry/docs/jini-port/skills/fixing-open-design-web.md — read THIS, not the
  vendored `foundry/integrations/open-design/reference/dev-skills-original/
  fixing-open-design-web/SKILL.md` copy (that one must stay byte-identical
  to upstream for provenance verification and is missing Jini's raised
  coverage bar). This file is otherwise the same skill.

Implementation rules:
- Follow the MemorySection vertical-slice shape: ports, a single dependencies
  binding seam, feature-local hooks, presentational components, a public
  barrel, and tests outside source directories (or colocated `.test.ts(x)`
  files, matching this repo's existing convention). **Within the feature
  folder (decided 2026-07-17, see `packages/ui/README.md`):** anything with
  zero React import (`types.ts`, `constants.ts`, `rules.ts`, `ports.ts`,
  `dependencies.ts`, the barrel `index.ts`) stays at the feature's top level;
  `hooks/` and `components/` (anything importing React) move under a
  `react/` subfolder — `features/<domain>/react/{hooks,components}/`.
- **The `useX`/`useWiredX` wiring pair is mandatory for every hook that
  touches a port** (decided 2026-07-17, after 6 extractions — viewer-shell,
  settings-dialog, browser-chrome, sketch-editor, asset-grid,
  annotation-canvas — all independently skipped this): `useX(port: XPort):
  XController` holds all state/logic and receives its port as an argument —
  fake-able in tests, no module mocks, no import of `dependencies.ts`.
  `useWiredX(): XController` is a separate, one-line export in the same file
  that does nothing but `return useX(<the concrete port exported from
  dependencies.ts>);` — so production callers (the orchestrator/host
  component) invoke it with zero arguments, and only the wirer, not the real
  hook, ever imports `dependencies.ts`. Export both from the feature's
  `index.ts`. A hook with no port dependency (pure local state) does not need
  a wirer — ship it plain, matching the reference's own `useMemoryFlash`/
  `useMemoryNavigation`. See
  `apps/web/src/features/memory/hooks/useMemoryConfig.hooks.ts` on the
  `refactor/web-memory-slice` branch of
  `https://github.com/leonaburime-ucla/open-design` for the canonical worked
  example (`useMemoryConfig(port)` + `useWiredMemoryConfig()` at the bottom
  of the same file).
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
- **Coverage bar (decided 2026-07-17, raised past the vendored skill's own
  floor after 6 extractions landed without it):** the vendored
  `fixing-open-design-web` SKILL.md's Phase 9.5 ("Coverage-driven refactor
  loop") already specifies the right method — classify every uncovered
  line/branch as genuinely-reachable-write-a-test / dead-branch-refactor-it-
  away / SSR-guard-node-companion-test / type-required-fallback-non-null-
  assert, and its own hard rule: **`/* v8 ignore */` (or any coverage-
  suppression comment) is never a valid outcome.** If a branch can't be
  justified by one of those four classifications, the branch shouldn't
  exist — refactor it out, don't suppress it. Follow that method exactly,
  but the target for Jini work is **≥99% on all 4 metrics (statements,
  branches, functions, lines), aggregate AND per file, with 100% as the
  actual goal** — not the skill's own ≥98%. Use `json-summary`+`json`
  coverage reporters (the v8 text table drops rows). This is not optional
  polish done after the fact — run the Phase 9.5 loop as part of the same
  pass that writes the initial tests, not a separate follow-up task.
- **Tests must include mounted/integration coverage, not just pure-function
  tests** (Phase 9's own rule: "testing a pure helper alone is
  insufficient") — every hook needs a `renderHook` test against a
  hand-written fake port, every component needs a `@testing-library/react`
  mount test, and interactive behavior (keyboard shortcuts, drag,
  dismiss-on-outside-or-Escape, resize/observer-driven repositioning) needs
  a test that actually dispatches the real DOM event, not just a unit test
  of the extracted pure logic behind it.
- Run the package typecheck/tests, pnpm guard, and a purity grep for
  product-identity strings. Report concrete outputs, not just command names.
- Turn each retained-behavior row into a focused test before completion. A
  pure-helper test does not prove its mounted integration. Run a final
  source-parity audit and list every host-owned/deferred row explicitly.
- Delivery is a gate: verify the remote task branch and draft PR URL after
  commit. If either is missing, commit `ADS-memory/cloud-reports/<task-branch>.md`
  with command output and the exact retry command; do not report `READY` as
  success.

Finish with a concise summary: the full Reference Preflight output (including
the exact consolidation-map row quoted), files changed, OD behavior left
behind, validation results, source discrepancies, and the draft PR URL (or, if
`gh` isn't available/authenticated in this environment, the branch name and a
comparison URL for a human to open the PR manually).
```
