# Cloud prompt — `useResizableSplitPane` extraction (small, Claude Code)

Per the consolidation map, this is the smallest item on the list: a single hook lifted out of an
otherwise ~99%-OD-specific 9,907-line file (`ProjectView.tsx`). No feature-slice ceremony needed —
just a clean, standalone hook.

```text
You are working in the Jini repository. Your task is to extract ONE
generic hook, a resizable split-pane / drag-to-resize hook, from Open
Design's ProjectView.tsx into @jini/ui. Work only on this task's branch
and finish with a draft PR; never push directly to main.

Before editing any file, complete and print this exact Reference Preflight:

1. Read foundry/docs/jini-port/god-components-extraction-plan.md's "Consolidation
   map" section and quote the exact row covering ProjectView.tsx -- filed
   under Section B, target hooks/useResizableSplitPane (a flat hook, not a
   features/<domain>/ slice -- this is deliberately the smallest item on
   the list, don't over-scaffold it).
2. Jini branch and SHA. This environment has ONE repo source -- the
   vendored snapshot at
   foundry/integrations/open-design/reference/components-original/ProjectView.tsx
   is the source of truth.
3. Confirm you read foundry/docs/jini-port/recon/r6-god-component-internals.md
   section 1.2 (the full analysis this task is derived from). Per that
   section: ProjectView.tsx is genuinely, overwhelmingly OD-specific
   (~7,600-line function, 99 useCallbacks/56 useEffects/24 useStates,
   OD-domain concerns interleaved throughout, not siloed into separable
   tabs) -- this is the ONE genuine exception found in the whole file: a
   resizable split-pane / drag-to-resize chat panel (~250 lines across
   several line ranges) -- pointer-drag width resize, RAF-throttled,
   RTL-aware, keyboard-resizable, ResizeObserver-clamped,
   localStorage-persisted. Zero OD types touched; only residue is a
   renameable storage-key string (the original uses something like
   'open-design.project.chatPanelWidth' -- confirm the exact string and
   replace it with a caller-supplied storage key, default to a generic
   neutral key).
4. Locate this hook precisely in the source (search for the drag-resize
   pointer handlers, RAF throttling, and the localStorage persistence
   together -- it will not be a single named function, it may be inlined
   logic within the component; your job is to lift it into a standalone
   hook, not just find an existing function with this name).
5. Confirm this really is the ONLY generic piece in the file (per r6, this
   is "the closest any file came to confirming r5's original flat
   classification, but 'flat' is still not quite accurate") -- do not go
   looking for more, the rest of the file (brand-extraction, AMR billing
   gating, design-system audit, plugin-folder actions, comments,
   conversation/queue management, onboarding, and the entire JSX
   composition shell wrapping exclusively-OD child components like
   ChatPane/FileWorkspace/AmrBalanceDialog/CritiqueTheaterMount/
   HandoffButton) stays OD-specific and untouched.
6. Record the exact green-baseline commands you'll re-run at the end.

Read these Jini references before designing the hook:
- AGENTS.md
- foundry/docs/jini-port/START-HERE.md
- foundry/docs/jini-port/god-components-extraction-plan.md (especially the
  Consolidation map and the i18n/React-layout policy sections near the top)
- foundry/docs/jini-port/recon/r6-god-component-internals.md section 1.2
- packages/ui/README.md and packages/ui/source-map.md

Implementation rules:
- This is a flat hook (packages/ui/src/hooks/useResizableSplitPane.ts +
  colocated .test.ts), not a features/<domain>/ slice -- no ports.ts/
  dependencies.ts ceremony needed for something this small and
  self-contained. If it turns out to need real injectable behavior beyond
  a storage-key parameter, use judgment and say so explicitly rather than
  forcing a bare function into unnecessary structure.
- Keep the hook itself framework-bound (it uses React state/effects, so it
  lives in packages/ui/src/hooks/ per this package's existing convention --
  that top-level hooks/ bucket is for hooks not tied to one feature
  domain, which this qualifies as).
- Keep public @jini surfaces product-neutral. Do not add Open Design
  names, imports, or string identities -- including the OD-branded
  localStorage key from the original; genericize it and make it a
  caller-supplied parameter with a neutral default.
- No i18n concerns expected (this hook has no user-facing text) -- if you
  find one, apply the i18n policy in god-components-extraction-plan.md.
- Apply the Phase 8.5 audit from the fixing-open-design-web SKILL.md.
- Run the package typecheck/tests, pnpm guard, and a purity grep for
  product-identity strings. Report concrete outputs, not just command
  names.

Finish with a concise summary: the full Reference Preflight output, the
file changed, OD behavior confirmed left behind (the rest of
ProjectView.tsx), validation results, all test/typecheck/guard/purity
results, and the draft PR URL (or, if gh isn't available/authenticated in
this environment, the branch name and a comparison URL for a human to open
the PR manually).
```
