---
name: ui-loop
version: 1.0.0
last_updated: 2026-06-03
description: Focused loop skill for fast UI iteration. Prioritizes browser-visible feedback over code-only reasoning. Iterate in short cycles — change, observe in browser, fix — then reconcile with tests and specs after the UI works.
---

# Skill: UI Loop

Focused operating mode for frontend/UI implementation. The generic commit→push→feedback loop is too slow for visual work. This skill reorders priorities: **see it working first, then reconcile.**

## When to Use

- Implementing or fixing visual components, layouts, interactions, animations
- Debugging CSS/styling issues, hydration mismatches, client-side state bugs
- Any task where "does it look right in the browser?" is the primary feedback signal
- Coordinator or Programmer activates this when the task is UI-heavy

## Loop Structure

```
┌─────────────────────────────────────────────┐
│  1. Make a small, focused change            │
│  2. Observe in browser (screenshot/inspect) │
│  3. Does it match intent?                   │
│     YES → next change                       │
│     NO  → diagnose from browser evidence    │
│  4. Repeat until visually correct           │
│  5. THEN reconcile: tests, lint, types      │
└─────────────────────────────────────────────┘
```

## Principles

1. **Browser is truth for visual claims.** During the UI loop, browser-observed rendered state outranks assumptions about what the code "should" produce. Type errors, lint warnings, and certified test failures still govern correctness — but visual feedback takes priority for layout, styling, and interaction decisions. Get it visually right first, then reconcile code-level constraints.

2. **Small changes, fast cycles.** Change one thing at a time. Observe immediately. Don't batch 5 CSS changes and hope.

3. **Browser evidence.** After each meaningful change, capture evidence: screenshot (if vision capabilities are available) or DOM inspection/computed styles/accessibility tree. This is your proof-of-progress and your debug artifact.

4. **Defer non-visual checks.** Linting, type checking, and tests run in the reconciliation phase, not inside the hot loop. They slow down visual iteration without improving visual correctness.

5. **Reconciliation is mandatory.** Once the UI is visually correct, run the full check suite: types, lint, tests, accessibility. Do not skip this. The loop is "iterate fast THEN verify," not "iterate fast and ship without verification."

## Workflow

### Phase 1: Fast Iteration

1. **Start the dev server** if not running. Verify browser automation is available via `browser-live-analysis` preflight.
2. **Identify the visual target.** What should this look like? (Spec, design reference, user description.)
3. **Change → Observe loop:**
   - Make one focused edit (component, style, layout, state)
   - Navigate/interact in browser to trigger the change
   - Screenshot or inspect the result
   - Compare against target
   - If wrong: diagnose from what you SEE (DOM state, computed styles, network, console), not from what you THINK the code does
4. **Continue** until the visual result matches intent.

### Phase 2: Reconciliation

Once visually correct:

1. Run type checker — fix any type errors introduced during iteration
2. Run linter — fix formatting/style violations
3. Run relevant tests — fix any regressions
4. Run accessibility checks if touching interactive elements
5. Verify the final browser state one more time after reconciliation fixes

### Phase 3: Handoff

- Report visual evidence (screenshot of final state)
- List reconciliation results (types clean, lint clean, tests pass)
- Note any accessibility findings

## Activation Guard

Only activate this skill when `browser_automation` is `enabled` on the current host (verified via `browser-live-analysis` preflight). If browser automation is unavailable, fall back to standard implementation flow with manual verification instructions — do not attempt the UI loop without browser feedback.

## Integration with Existing Skills

- **browser-live-analysis**: Use for all browser interaction. Run its preflight before entering the UI loop.
- **programmer-fast-feedback** (`harness-engineering/quality/programmer-fast-feedback.md`): The watcher provides background test signals but does NOT interrupt the hot visual loop. Pause or ignore watcher output during Phase 1; consume watcher signals in reconciliation.
- **pattern-priming**: Still required before first component — the UI loop does not skip style alignment.

## Anti-Patterns

- **Coding blind:** Making multiple changes without observing in browser. This is not UI-loop — this is guessing.
- **Premature reconciliation:** Running lint/types after every small CSS tweak. Save it for when the visual is right.
- **Skipping reconciliation:** Shipping visual changes without running types/tests/a11y. The loop ends with verification, always.
- **Evidence-less claims:** Saying "it looks correct" without browser evidence (screenshot, DOM snapshot, or computed style inspection). If you didn't observe it in the browser, you didn't verify it.
