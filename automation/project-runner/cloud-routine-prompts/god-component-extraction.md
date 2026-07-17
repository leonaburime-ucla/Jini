# Cloud prompt — Jini god-component extraction

Use this template for one cloud task that extracts a generic vertical slice
from Open Design into Jini. It supplements, rather than replaces,
`cloud-routine-prompt.md`: that template drives the extraction ledger; this
one carries the reference preflight required for a frontend god-component.

The initial task is `PreviewDrawOverlay.tsx`. Do not reuse this prompt for a
different component without replacing the target and its source references.

```text
You are working in the Jini repository. Your task is to extract the generic
core of Open Design's PreviewDrawOverlay into the appropriate @jini package,
leaving OD-specific capture, submission, and product-domain behavior behind an
injected adapter seam. Work only on this task's branch and finish with a draft
PR; never push directly to main.

Before editing any file, complete and print this exact Reference Preflight:

1. Jini branch and SHA; OD source repository, branch, and SHA.
2. Target: apps/web/src/components/PreviewDrawOverlay.tsx, read from the live
   OD source branch, not only the vendored Jini snapshot.
3. Primary canary read in full from the same OD branch:
   - apps/web/src/features/memory/
   - apps/web/src/providers/memory/
   - apps/web/tests/features/memory/
   - docs/adr/0002-frontend-vertical-slice-decomposition.md
   - apps/web/AGENTS.md
   - scripts/check-web-slice-boundaries.ts
4. Every PreviewDrawOverlay caller/importer and its public prop/event contract.
5. The chosen Jini destination package, why it owns this component, and the
   OD-only seam that will remain in integrations/open-design.
6. Green baseline commands and their results.

If any preflight item is unavailable or the live source materially disagrees
with the vendored snapshot, stop and report the discrepancy. Do not substitute
memory, a nearby component, or an inferred design.

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
  and tests outside source directories.
- Keep public @jini surfaces product-neutral. Do not add Open Design names,
  imports, or string identities to packages/@jini.
- Follow the i18n policy in god-components-extraction-plan.md and write the
  source-map entry with exact provenance and intentionally deferred behavior.
- Run the package typecheck/tests, pnpm guard, and relevant packed-package or
  consumer checks. Report concrete outputs, not just command names.

Finish with a concise summary: preflight evidence, files changed, OD behavior
left behind, validation results, source discrepancies, and the draft PR URL.
```
