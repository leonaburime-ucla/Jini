# Consensus Report

**Date:** 2026-04-03
**Prompt:** What operating paradigm should AI Dev Shop use for a very large brownfield codebase rewrite when multi-agent execution is available, so the rewrite can be broken into safe parallel parts instead of one giant agent attempt?
**Mode:** `debate`
**Controls:** `max_rounds=2`, `min_confidence=0.90`, `swarm_timeout_seconds=300`
**Primary model:** `gpt-5.4`
**Canonical term for this artifact:** `contract-bounded slice`

## The Swarm

| Role | Model | Version / Resolved ID | Status |
|---|---|---|---|
| Primary | Codex | `gpt-5.4` | Responded |
| Peer | Claude | `us.anthropic.claude-opus-4-6-v1[1m]` | Responded |
| Peer | Gemini | `gemini-3.1-pro-preview` | Responded |

## Dispatch Diagnostics

- Debate run scratch artifacts live at `project-knowledge-template/.local-artifacts/swarm-consensus/runs/2026-04-03T155204Z-massive-rewrite-consensus/`.
- Claude peer resolution was backed by `project-knowledge-template/.local-artifacts/swarm-consensus/smoke-tests/last-known-good.json`.
- Two debate rounds were enough. Convergence was strong on the operating model; remaining disagreement was limited to terminology and whether `git worktrees` are a hard requirement or the best default implementation.
- This file is the retained artifact. It is evidence of a recommended approach, not yet a framework workflow adoption.

## Individual Responses

### Primary

- Recommended a rewrite-program DAG built from contract-bounded slices.
- Treated each slice as a semantically coherent unit with explicit ownership, validation commands, dependency edges, and rollback path.
- Emphasized coordinator-owned manifests, split heuristics, and serialized integration.

### Claude

- Recommended seam-based parallel rewrite with contract-first decomposition.
- Pushed for strict path ownership, contract registry, contract disputes, and merge-queue discipline.
- Converged to the position that isolation technology is flexible, but disjoint write sets are not.

### Gemini

- Recommended preserving behavioral/domain cohesion rather than slicing purely by file or layer.
- Pushed test-harness-first discipline, just-in-time seam prep, and shared/core locking.
- Converged to a strong serialized integration train with blocking validation.

## Synthesis

### Agreement

- The unit of parallel work must be contract-bounded, semantically cohesive, and mapped to an explicit disjoint write set.
- Parallel execution requires a short sequential seam-prep phase before each wave.
- The Coordinator must own contracts, ownership or locks, dispute handling, and serialized integration.
- Shared/core areas cannot be edited opportunistically.
- Merge and integration must be serialized with blocking validation gates.

### Divergence

- Naming diverged slightly: `domain cell`, `rewrite cell`, and `contract-bounded slice` all described nearly the same unit.
- `git worktrees` were treated as the strongest default for local isolation, but not as the essence of the architecture.

## Decision Ledger

- Use `contract-bounded slice` as the canonical term for this retained artifact.
- Treat the slice as the atomic unit of parallel rewrite work.
- Require explicit disjoint write sets for every parallel slice.
- Require just-in-time seam prep before each wave of parallel work.
- Require a Coordinator-owned contract registry or lock map artifact.
- Require a serialized merge queue or integration train with blocking contract and integration checks.
- Ban uncoordinated shared-core mutation.
- Keep this result as a retained consensus report for now; promote it into a framework workflow only after an explicit adoption decision.

## Final Recommendation

For large brownfield rewrites, AI Dev Shop should use a program of `contract-bounded slices`: semantically cohesive units of work that are bounded by explicit interface contracts and explicit write ownership. The Coordinator should prepare seams and shared contracts just in time for each wave, then dispatch only truly independent slices in parallel. Each worker should operate in an isolated environment and be rejected automatically if it edits outside its declared write set. Completed slices should enter a serialized merge queue where build, contract, and cross-boundary validation all block the next merge until green. This gives the framework safe parallelism without collapsing into shared-core conflicts or architecture drift. If multi-agent execution is unavailable, the same slice queue should run sequentially.

## Open Question

- Should AI Dev Shop standardize on `git worktrees` as the default local isolation mechanism for parallel `contract-bounded slices`, or should the workflow stay isolation-backend-agnostic as long as disjoint write sets are enforced mechanically?
