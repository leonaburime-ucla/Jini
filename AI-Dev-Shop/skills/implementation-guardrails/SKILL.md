---
name: implementation-guardrails
version: 1.3.0
last_updated: 2026-04-26
description: Use when implementing or reviewing backend/general code so complexity, scaling, and maintainability guardrails stay consistent: scaling sanity checks, selective complexity comments, query-shape awareness, one-source-of-truth rules, and readable call-site defaults.
---

# Skill: Implementation Guardrails

Apply this skill when writing or reviewing general application code paths that need explicit complexity, performance, and maintainability guardrails.

This skill is a child layer on top of `coding-foundations`. It is for author-time and review-time implementation discipline, not for defining the shared baseline axioms.

Do not wire this skill by itself. Any agent that loads `implementation-guardrails` must also load `coding-foundations` explicitly.

## Ownership

- Programmer owns first-pass complexity and scaling decisions while writing code.
- Code Review is the backstop for missed issues and unjustified deviations.
- Refactor owns non-blocking complexity debt after the behavior is already correct.
- TestRunner owns empirical performance evidence only when the active tasks or spec define performance constraints.

## Load Strategy

Start here, then load only the reference you need:

- `references/complexity-comments.md` when code handles caller-controlled or unbounded input, nested iteration, query fan-out, batch work, or a custom algorithm
- `references/defaults-checklist.md` when you want the concrete implementation defaults and review signals in one place

## Core Rules

1. Do an author-time scaling sanity check for any changed path that iterates caller-controlled input, nests loops, batches work, or risks per-item I/O.
2. Add a short inline complexity note only when the cost, query shape, or tradeoff is non-obvious and materially relevant to future maintainers.
3. For data-heavy code, make query or network fan-out explicit. Prefer bounded bulk reads/writes over hidden per-item I/O.
3b. For any function that calls an external service for a user-variable collection (roles, items, permissions, records), enforce resource bounds: maximum collection size (configurable cap), timeout on service calls, and defined behavior at the cap (error, truncate, or paginate). Do not assume typical usage equals worst-case usage.
4. Keep one source of truth for business rules, mapping tables, and config lookups; do not duplicate them across modules.
5. Avoid boolean flag parameters when an enum, options object, or named variant would make the call site clearer.
6. Prefer descriptive names and flow over clever compactness on non-trivial paths.
7. If performance or framework constraints force a non-obvious tradeoff, leave the reason near the code.

## Complexity Note Rule

- A note like `// O(n)` by itself is not enough.
- If you add a complexity note, define what the variable means and why the cost is acceptable.
- If query or network fan-out is the real concern, note the query shape in the same comment.
- Do not annotate trivial scans, getters, or obvious standard-library usage just to satisfy the rule.

## What Stays Out

- baseline dependency, purity, mutation, contract, and fail-fast rules that live in `coding-foundations`
- parameter conventions, test seam rules, typed error contracts, and UI test exemptions
- architecture- or framework-specific pattern rules that belong in other skills

## Review Signals

When this skill is active during review, look for:

- per-item database, network, or filesystem calls inside loops
- non-obvious expensive paths with no explanation
- query or network fan-out hidden inside collection transforms
- performance-driven mutation or batching with no rationale
- boolean flag parameters where an enum or options object would be clearer
- duplicated rules or lookup tables that should have one source of truth
- clever compactness that obscures cost or intent

## Output Expectations

When this skill materially shaped the implementation or review, report:

- changed paths that required complexity or query-shape notes
- important maintainability tradeoffs or performance justifications
- justified deviations from the default guardrails

## References

- `references/complexity-comments.md`
- `references/defaults-checklist.md`
