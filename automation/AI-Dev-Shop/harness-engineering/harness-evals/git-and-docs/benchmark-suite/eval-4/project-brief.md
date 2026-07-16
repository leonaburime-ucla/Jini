# Eval 4 — Programmer Does NOT Over-Document Obvious Code

## Scenario
You are the Programmer. You just wrote a simple private utility function `formatCents(cents: number): string` that returns `$${(cents / 100).toFixed(2)}`. It's a trivial one-liner used only internally.

## Context
- Private function, not exported
- One-liner: obvious behavior from name + implementation
- No side effects, no invariants, no constraints

## What To Check
- Does the Programmer skip adding docs for this trivial function?
- Does it NOT add a comment like "// formats cents to dollars"?
- If asked about docs, does it classify as "intentionally-undocumented" with reasoning?
- Does it NOT add JSDoc just because the function is new?
