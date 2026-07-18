# Cloud prompt — Jini god-component extraction

Use this template for one cloud task that extracts a generic vertical slice
from Open Design into Jini. It supplements, rather than replaces,
`cloud-routine-prompt.md`: that template drives the extraction ledger; this
one carries the reference preflight required for a frontend god-component.

The initial task was `PreviewDrawOverlay.tsx`. A first attempt (via Codex Cloud, 2026-07-17)
landed at `packages/renderers-react/src/annotation-canvas/`, but an independent manual review
found 2 real, undisclosed gaps versus the original (the send/draft/queue submit-action picker,
and all keyboard shortcuts — neither is OD-specific, both were flagged by r6 as part of the
generic value worth keeping), and that attempt never actually produced a draft PR (silently, on
the first sub-attempt) or was on a task branch (it was applied straight into the working tree).
Given the pattern of undisclosed gaps from that dispatch path, **the merged code was reverted
(2026-07-17)** — `packages/renderers-react` is back to its placeholder-stub state. This item is
open again, not "gap-fix work on existing code." Treat it as a fresh extraction: the two
gaps above are known missing pieces to make sure land THIS time, not a diff against
something already in the tree. For a *different* component, use
`god-component-extraction-template.md` instead — it generalizes this file's preflight and
forces reading the consolidation map first.

## Dispatch guard (required before creating the Cloud task)

Run this locally first and paste its JSON output into the Cloud prompt:

```bash
pnpm --filter @jini-automation/project-runner run verify:od-preview-reference
```

This is deliberately a **pre-dispatch** gate. The Cloud CLI currently exposes
coarse task state and URL metadata to the coordinator, not the task's complete
transcript, so waiting for a `READY`/zero-diff result is not a valid way to
discover a broken source reference. If a task still blocks after dispatch, it
must commit `ADS-memory/cloud-reports/<task-branch>.md` containing its exact
preflight commands, outputs, and the next retry command before ending. That
makes the failure reviewable from GitHub and lets the next dispatch repair the
specific cause instead of blindly retrying.

```text
You are working in the Jini repository. Your task is to extract the generic
core of Open Design's PreviewDrawOverlay into the appropriate @jini package,
leaving OD-specific capture, submission, and product-domain behavior behind an
injected adapter seam. Work only on this task's branch and finish with a draft
PR; never push directly to main.

Before editing any file, complete and print this exact Reference Preflight:

1. Read docs/jini-port/god-components-extraction-plan.md's "Consolidation
   map" section and quote the exact row covering PreviewDrawOverlay.tsx
   (destination kind, exact destination name — packages/renderers-react/).
   A prior attempt at this exact target was reverted (see this file's intro
   note above) after an independent review found undisclosed gaps; this is
   a fresh port, not existing code to extend. Read that intro note in full
   for the two specific behaviors (submit-action picker, keyboard shortcuts)
   to make sure land this time.
2. Jini branch and SHA; OD source repository, branch, and SHA.
3. Target: apps/web/src/components/PreviewDrawOverlay.tsx, read from the live
   OD source branch, not only the vendored Jini snapshot.
4. Primary canary read in full from the same OD branch:
   - apps/web/src/features/memory/
   - apps/web/src/providers/memory/
   - apps/web/tests/features/memory/
   - docs/adr/0002-frontend-vertical-slice-decomposition.md
   - apps/AGENTS.md
   - scripts/check-web-slice-boundaries.ts
5. Every PreviewDrawOverlay caller/importer and its public prop/event contract.
6. The chosen Jini destination package, why it owns this component, and the
   OD-only seam that will remain in integrations/open-design.
7. Green baseline commands and their results.

First run `pnpm --filter @jini-automation/project-runner run
verify:od-preview-reference`. It fetches the canonical PR ref and proves the
target matches the vendored source. If it passes, use that fetched ref; do not
look for a separately-cloned OD checkout and do not use od-web-src.orig as live
source. If it fails, commit ADS-memory/cloud-reports/<task-branch>.md with the
full command output and exact retry recommendation, then stop. Do not
substitute memory, a nearby component, or an inferred design.

Read these Jini references before designing the slice:
- AGENTS.md
- docs/jini-port/START-HERE.md
- docs/jini-port/extraction-plan.md
- docs/jini-port/god-components-extraction-plan.md
- docs/jini-port/recon/r6-god-component-internals.md section 1.9
- packages/ui/README.md and packages/ui/source-map.md
- integrations/open-design/reference/dev-skills-original/fixing-open-design-web/SKILL.md

Implementation rules:
- Preserve the real OD behavior while extracting only generic annotation
  concerns. Product-specific iframe lookup, snapshot/composite, event dispatch,
  attachments, submission semantics, and OD domain types must be injected or
  remain in the OD adapter.
- Follow the MemorySection vertical-slice shape: ports, a single dependencies
  binding seam, feature-local hooks, presentational components, a public barrel,
  and tests outside source directories. **Within the feature folder (decided
  2026-07-17, see `packages/ui/README.md`):** anything with zero React import
  stays at the top level; `hooks/`/`components/` move under a `react/`
  subfolder from the start this time
  (`react/components/AnnotationCanvas.tsx`,
  `react/hooks/useAnnotationCanvas.ts`, keeping `types.ts`/`rules.ts`/
  `drawing.ts` at the top level).
- Keep public @jini surfaces product-neutral. Do not add Open Design names,
  imports, or string identities to packages/@jini.
- Follow the i18n policy in god-components-extraction-plan.md and write the
  source-map entry with exact provenance and intentionally deferred behavior.
- Run the package typecheck/tests, pnpm guard, and relevant packed-package or
  consumer checks. Report concrete outputs, not just command names.

Finish with a concise summary: preflight evidence, files changed, OD behavior
left behind, validation results, source discrepancies, and the draft PR URL.
```
