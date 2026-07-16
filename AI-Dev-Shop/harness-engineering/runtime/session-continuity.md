# Session Continuity

This file defines the durable progress artifact for long-running or resumable work.

## Why This Exists

`pipeline-state.md` tracks coordinator state and retry counters. It is not enough by itself for clean human or agent resume. Long-running work also needs a human-readable progress ledger that records what changed, what failed, and what should happen next.

This file is about state continuity, not a blanket instruction to reset context every time. Reset-vs-compaction choice depends on current model behavior and should be revisited through `harness-engineering/quality/load-bearing-harness-audit.md`.

## Required Artifact

Create a `progress-ledger.md` when either condition is true:

- the work is expected to cross sessions, handoffs, or context-window boundaries
- a failure cluster reaches retry 2 and resumption quality now matters more than raw speed

Do not create one for short single-session work just because the task touches framework docs, validators, or toolkit-maintenance files.

## Canonical Locations

- Feature pipeline runs: `<ADS_MEMORY_ROOT>/reports/pipeline/<NNN>-<feature-name>/progress-ledger.md`
- Non-feature host-project work: `<ADS_MEMORY_ROOT>/reports/continuity/<workstream>/progress-ledger.md`
- Non-feature toolkit maintenance or direct framework work: `<AI_DEV_SHOP_ROOT>/project-knowledge-template/reports/continuity/<workstream>/progress-ledger.md`

The state file remains the machine-oriented checkpoint. The progress ledger is the human/agent resume surface.

Those paths are reserved canonical locations, not a claim that every repo will already contain retained ledgers there.

## Minimum Contents

Every `progress-ledger.md` must include:

- workstream metadata and owner
- current objective
- last verified good state
- recent progress since the last checkpoint
- next 1-3 concrete actions
- blockers or open questions
- artifact/path references
- failure-cluster history with current hypothesis
- explicit resume instructions for a fresh session
- `evaluator_mode` and `evaluator_contract` metadata when an independent evaluator loop is required

Use `<AI_DEV_SHOP_ROOT>/framework/templates/progress-ledger-template.md`.

## Update Triggers

Update the ledger:

1. when the ledger is first created
2. before any planned session stop or handoff
3. after each retry for a recurring failure cluster
4. before asking a fresh session or another agent to resume the work
5. before claiming a long-running workstream is complete

## Coordinator Rules

- Create the ledger at the first meaningful checkpoint for long-running work if it does not already exist.
- Include the ledger path in `pipeline-state.md`.
- Read the ledger before resuming any interrupted run.
- If a run is resumable but the ledger is missing, recreate it before further dispatch.

## Scope Notes

- This is not a full audit log. Keep it concise and high-signal.
- Prefer references to artifact paths over large pasted logs.
- The goal is to let a fresh session continue with minimal reconstruction cost.

## Reset Vs Compaction

Use the progress ledger in both cases, but choose the session strategy deliberately:

- Prefer `compaction` when the current model stays coherent in a continuous run and reset overhead is not buying meaningful quality.
- Prefer a `context reset` plus structured handoff when the agent starts wrapping up early, loses coherence near context limits, or cannot recover cleanly inside the same session.
- Do not assume older reset-heavy patterns remain necessary after a model or runtime upgrade.

The continuity artifact is the durable handoff surface either way. The question is whether the next step should be taken by the same compacted session or by a fresh one.
