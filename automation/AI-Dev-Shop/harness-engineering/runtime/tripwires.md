# Runtime Tripwires

This file defines deterministic tripwires that catch three common failure modes:

- coordinator content production (writing specialist artifacts instead of dispatching)
- premature completion claims
- blind retry loops

## Ownership-Resolution Gate

When the user expresses execution intent — any request for work to be done ("let's start X", "write the X", "do X", "implement Y") — the Coordinator MUST resolve ownership before generating ANY content, including inline prose.

### Mandatory Routing Decision

Before producing content or writing files in response to a task request, emit a routing decision:

```
[Routing: <content-type> → Owner: <agent> → Action: dispatch/proceed]
```

Resolve ownership from the file-trigger-table (`<AI_DEV_SHOP_ROOT>/framework/routing/file-trigger-table.md`):

| If owner resolves to... | Then... |
|---|---|
| A specialist agent | **Dispatch only.** Do not produce any of the specialist's content — not files, not inline drafts, not "starter" outlines, not clarification questions that embed domain expertise. |
| Coordinator | Check preconditions (see below), then proceed. |
| Ambiguous / no clear match | Run read-only discovery, resolve likely owner, then dispatch. |

### Preconditions on Coordinator-Owned Outputs

Even when ownership resolves to Coordinator, these artifacts require checkpoint gates:

| Artifact | Precondition |
|---|---|
| `tasks.md` | Human-approved ADR + Implementation Outline readiness (exists or SKIP recorded) |
| `verification-packet.md` | Accepted TestRunner evidence exists |
| Framework/harness files | User explicitly invoked toolkit maintenance; Observer/doc-garden follow-up required |
| `pipeline-state.md` | State/resume tracking context only |
| `progress-ledger.md` | Active resumable work exists |

### Inline Drafting = File Writing

Treat inline prose production the same as file creation. "Let's start the specs" means dispatch to Spec Agent — not produce requirements, features, acceptance criteria, or technical details in the chat. The guard covers ALL content generation, not just file writes.

### What This Does NOT Block

- Status updates, routing explanations, cycle summaries
- Mode-switch declarations and dispatch directives
- Questions to the user for clarification (as Coordinator, not as a specialist)
- Echoing back the user's request as a dispatch payload summary
- Architecture discussions in Review Mode when the user explicitly asks the Coordinator to explain (not produce)

### Required Response When Owner ≠ Coordinator

1. Show the routing decision: `[Routing: <type> → Owner: <agent> → Action: dispatch]`
2. Switch to Pipeline Mode if not already active
3. Dispatch the specialist with proper context injection
4. Do not ask the user whether to dispatch — execution intent auto-dispatches per the Review Mode intake rule

### Why This Works

LLMs are autoregressive — once compliance tokens start ("Sure, here's the spec..."), the model is trapped by its own context and must continue producing specialist content. By forcing the routing decision as the FIRST tokens generated, the subsequent generation naturally aligns with dispatch rather than content production. This is a structural interrupt, not a passive rule.

### Examples

- User: "let's start the specs" → `[Routing: Specs → Owner: Spec Agent → Action: dispatch]` → dispatch Spec Agent
- User: "write the ADR for this" → `[Routing: ADR → Owner: Software Architect → Action: dispatch]` → dispatch Software Architect
- User: "what's the status?" → No gate needed — this is Coordinator meta-work
- User: "generate the task list" → `[Routing: tasks.md → Owner: Coordinator → Action: proceed]` → check precondition: ADR approved? → proceed or block

## Pre-Completion Checklist

Before an agent claims `done`, `ready`, `fixed`, `green`, or equivalent, it must verify:

1. the active task/spec/ADR it was supposed to satisfy
2. fresh evidence from the relevant command or artifact
3. that no tests were deleted or weakened to manufacture a pass
4. that changed files stayed within scope or any deviation is explicitly reported
5. what remains open, if anything

For implementation and verification stages, the handoff should include a dedicated `Pre-Completion Checklist` section.

## Coordinator Rejection Rule

Reject the handoff and keep the job out of `DONE` if:

- the checklist is missing
- the checklist cites stale evidence
- the agent cannot map the claimed completion back to the task/spec

## Loop-Detection Triggers

Treat the run as being in a loop when any of these happen inside one failure cluster:

- the same file is edited 3 times
- the same test/command is rerun 3 times with materially identical failure output
- retry 2 completes without a materially new hypothesis or experiment

## Required Response To A Loop Alert

When a loop trigger fires:

1. stop blind retrying
2. write a `Loop Alert` note in the progress ledger
3. state the current hypothesis, why the last approach failed, and the next different approach
4. if no different approach exists, escalate instead of spending another cycle

## Relation To Retry Budgets

Loop detection sits below the normal stage retry budget. It is an early warning layer, not a replacement for escalation policy.

The goal is to interrupt waste earlier than "cluster burned 3 full retries."

## Examples

- same CSV escaping file edited three times with the same failing edge-case tests -> write loop alert and change debugging approach before retry 3
- agent says "done" after a partial suite run -> reject handoff because the completion checklist lacks fresh full-scope evidence
- tests pass only because assertions were removed -> hard failure, not a valid completion
