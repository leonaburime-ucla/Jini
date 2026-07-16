# Code-Documentation Standards

Source of truth for what agents must and must not document in code. The goal is high-signal documentation that explains contracts, constraints, and non-obvious behavior — not narration of what the code already says.

## MUST Document

These require inline documentation. Missing docs on these surfaces is a **Required** Code Review finding.

### Public Interfaces
- Exported functions, classes, types, and constants consumed by other modules
- API handlers (HTTP, WebSocket, CLI commands, event handlers)
- SDK-facing surfaces, plugin APIs, webhook contracts
- Published schemas, event shapes, and message formats

What to include: purpose, input semantics, output/error contract, and one usage example when the call shape is non-obvious.

### Complex Orchestration
- Multi-step async workflows (what order, what happens on partial failure)
- Retry/backoff logic (what retries, how many times, what resets)
- State machines (states, transitions, guards)
- Cross-service coordination (what calls what, timeout behavior)

### Non-Obvious Invariants
- Ordering requirements that aren't enforced by types
- Idempotency assumptions
- Deduplication rules
- Ownership/lifecycle constraints (who creates, who disposes)
- Security assumptions (what is trusted, what is validated)

### Side Effects
- Database writes, cache mutations
- External API calls, webhook dispatches
- File system changes
- Telemetry/logging that affects behavior (not just observability)
- Queue publishes

### Constraints
- Resource limits (connection pools, rate limits, memory bounds)
- Timeouts and deadline propagation
- Backward-compatibility requirements
- Performance complexity notes (only when non-obvious, e.g., O(n²) in a hot path)
- Privacy/security constraints (PII handling, encryption requirements)

## MUST NOT Document

These are actively harmful. Comment bloat is a **Recommended** Code Review finding (escalates to Required if it obscures behavior).

### Obvious Leaf Logic
- Simple getters/setters, trivial mappers, one-line utility functions
- Private functions whose name fully describes their behavior
- Standard framework boilerplate (route handlers that just call a service)

### Code-Restating Comments
- `// increment counter` above `counter++`
- `// return the user` above `return user`
- JSDoc that only repeats the function signature with no added insight

### Noise Comments
- Comments added solely to satisfy a line-count quota
- `// TODO` without context, owner, or actionable next step
- Change-log comments (`// added 2026-05-19 for feature X`) — that's what git history is for
- Comments compensating for bad names — rename the thing instead

### Speculative Comments
- `// might need this later`
- `// probably should handle X here`
- If it's not needed now, don't document hypothetical future work in code

## Enforcement Model

### Programmer Self-Check (Before Handoff)
Before handing off, the Programmer classifies each changed public symbol:
- `documented` — docs added or updated
- `intentionally-undocumented` — symbol is obvious, no docs needed (must state why)
- `stale-doc-updated` — existing docs were wrong, now fixed

This classification goes in the handoff summary under a "Documentation" section.

### Code Review Check
The Code Review agent evaluates documentation as part of its review:

| Finding | Severity |
|---------|----------|
| Missing docs on public interface | Required |
| Missing docs on side effects or invariants | Required |
| Stale/misleading docs (says one thing, code does another) | Required |
| Missing changed-API handoff documentation | Required |
| Comment bloat / code-restating comments | Recommended |
| Missing docs on complex internal logic | Recommended |
| Missing usage example on non-obvious public API | Recommended |

### Doc-Lint by Stack

If the host project has a doc-lint tool configured, run it as part of computational controls:

| Stack | Tool | What it checks |
|-------|------|---------------|
| TypeScript | eslint-plugin-jsdoc | Missing JSDoc on exports |
| Python | pydocstyle / ruff (D rules) | Missing docstrings on public functions |
| Go | golint / revive | Missing comments on exported symbols |
| Rust | clippy (missing_docs) | Missing docs on public items |

If no doc-lint is configured, the Programmer states this explicitly — it's not a failure, just a known gap.

### API Handoff Expectations

When a PR changes a public API surface, the handoff must include:
- Which public APIs were added or changed
- Whether docs were added/updated for each
- Any intentional no-doc decisions (with reasoning)

This is separate from and in addition to inline code docs — it goes in the PR description and handoff summary so reviewers can verify coverage without reading every file.
