# Git Branching and PR Strategy

How the pipeline interacts with git workflow — when to branch, how to name branches, what PRs should contain, and which merge strategy to use.

## Branch Naming

```
feature/<NNN>-<feature-slug>
```

- `<NNN>` is the pipeline feature number (from `<ADS_MEMORY_ROOT>/reports/pipeline/<NNN>-<feature-name>/`)
- `<feature-slug>` is a short kebab-case name derived from the feature
- Examples: `feature/201-team-chat-platform`, `feature/305-payment-webhooks`

For multi-slice blueprint work where a System Design produces multiple spec packages:
```
feature/<NNN>-<feature-slug>/<slice-name>
```

## When to Branch

The **Coordinator creates the feature branch** at **TDD dispatch** — the point where implementation is about to begin and the plan is locked.

Why at TDD dispatch (not earlier):
- Spec, Red-Team, and Software Architect work happens in planning — no code to branch
- TDD is the first stage that writes implementation files
- By this point the ADR is approved and tasks.md is generated

The branch is created from the current main/trunk state. If main has moved since the spec was approved, the Coordinator should note this in the TDD dispatch context.

The Coordinator records the branch name in `pipeline-state.md`:
```
branch: feature/<NNN>-<feature-slug>
branch_created: <timestamp>
```

## When to Signal PR-Ready

The Coordinator signals **PR-ready at the Done gate** — after all implementation stages are complete:
- Code Review passed
- Security review passed (if in scope)
- Test certification exists
- Self-validation completed (if runtime-changing work)

The Coordinator does not push or create the PR automatically. It signals readiness and provides the PR description for the human to review and submit.

## PR Description Template

```markdown
## Summary
<1-3 sentence description of what this feature does>

## Spec Traceability
- **Spec**: `<spec-entrypoint-path>` (hash: `<spec-hash>`)
- **ADR**: `<ADS_MEMORY_ROOT>/reports/pipeline/<NNN>-<feature>/adr.md`
- **Tasks**: `<ADS_MEMORY_ROOT>/reports/pipeline/<NNN>-<feature>/tasks.md`

## Quality Gates
- [ ] Test certification: `<path-to-test-certification.md>`
- [ ] Security review: <passed / not required / findings addressed>
- [ ] Self-validation: <PASS / PARTIAL with note / not required>
- [ ] Code review: <passed with N findings resolved>

## What Changed
<bullet list of key changes by module/area>

## Risks and Follow-ups
<any known risks, deferred work, or follow-up items>
```

## Merge Strategy

| Strategy | When to use | Tradeoff |
|----------|------------|----------|
| **Squash merge** (default) | Single-feature branches | Clean history, one commit per spec, easy to revert whole features |
| **Merge commit** | Multi-slice blueprint branches, long-running work | Preserves internal commit structure, shows progression |
| **Rebase** | Small fixes, single-commit work | Linear history, but loses merge context |

**Default recommendation: squash merge** for feature branches.

Rationale: one squash commit per feature = one commit traceable to one spec. Makes `git log` a feature changelog. The full implementation history is preserved in the branch (and PR) if anyone needs granular detail.

**Exception**: if the feature branch has multiple meaningful milestones that the team wants preserved in main history (e.g., a multi-week migration with distinct phases), use a merge commit instead.

## Commit Message Format for Squash

```
feat(<NNN>): <short description>

Spec: <spec-hash>
ADR: <adr-path>
```

This makes `git log --oneline` a scannable feature list with spec traceability.

## Commit Message Format (During Implementation)

During implementation on the feature branch:
```
[<NNN>] <type>: <imperative description>
```

- `<NNN>` is the pipeline feature number
- `<type>` follows conventional commits: `feat`, `fix`, `refactor`, `test`, `docs`
- Examples: `[201] feat: implement JWT validation middleware`, `[201] test: add auth edge cases`

These individual commits are preserved in the branch/PR history even when squash-merged.

## What the Coordinator Does NOT Do

- Does not push to remote without human approval
- Does not force-push or rewrite published history
- Does not create PRs automatically (provides the description, human submits)
- Does not resolve merge conflicts (flags them for human resolution)
- Does not make branching decisions for non-pipeline work (hotfixes, maintenance branches are human-owned)
