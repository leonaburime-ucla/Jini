# Workflows

This directory defines the operational rulebook, lifecycle states, and physical constraints of the AI Dev Shop multi-agent pipeline. It serves as the authoritative source for how the Coordinator routes tasks and manages state.

## Core Pipeline Rules

- **`multi-agent-pipeline.md`**: The master sequence. Defines the stage-by-stage execution order, context injection rules, and handoff contracts for every agent in the system.
- **`conventions.md`**: Defines the physical constraints of the workspace. It specifies exactly where generated files (specs, reports, pipeline artifacts) must be saved and enforces the read-only vs. writable directory boundaries.
- **`specs-as-built.md`**: Defines the curated current-state documentation surface generated from reverse-spec and post-implementation capture, including freshness metadata and validation rules.
- **`job-lifecycle.md`**: Defines the state machine for agent dispatches (QUEUED, RUNNING, RETRYING, ESCALATED). It acts as the single source of truth for retry budgets and escalation triggers.

## State Management & Debugging

- **`pipeline-state-format.md`**: The schema definition for the `pipeline-state.md` file, which the Coordinator uses to persist current progress, active spec hashes, and retry counters across sessions.
- **`state-validator-checklist.md`**: A manual sanity-check guide for human operators to verify the integrity of the pipeline state or memory store before resuming an interrupted run.
- **`recovery-playbook.md`**: Instructions for the Coordinator (or human) on how to cleanly recover from terminal states, context limit aborts, or mid-run spec hash mismatches.
- **`trace-schema.md`**: The formatting rules for agent debug logs and tracing output, used when the pipeline is operating in verbose/debug mode.
