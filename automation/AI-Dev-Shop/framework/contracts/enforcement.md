# Contract Enforcement

How the framework behaves when contracts are present, missing, partial, or failing.

## Contract States

| State | Meaning |
|-------|---------|
| **Active** | Contract is declared with all required fields filled. Enforcement is full. |
| **Partial** | Contract exists but some slots are empty or marked as gaps. Enforcement applies only to filled slots. |
| **Missing** | No contract file exists at the expected host location. |
| **Stale** | Contract exists but has not been reviewed in 90+ days or references commands/paths that no longer exist. |

## Greenfield vs Brownfield Detection

A project is **greenfield** if any of these are true:
- `<ADS_MEMORY_ROOT>` was created during the current bootstrap (no prior pipeline reports exist)
- The project metadata explicitly declares `adoption_mode: greenfield`
- The user states the project is new when asked

Otherwise the project is **brownfield** by default. When in doubt, treat as brownfield — advisory mode is always safer than blocking a productive team.

## Greenfield vs Brownfield Defaults

### Greenfield Projects

A project bootstrapped with AI Dev Shop from the start.

- Missing **computational controls**: Coordinator escalates to user at Programmer dispatch — asks the user to declare at minimum `build` and one test slot before implementation begins. Does not silently block.
- Missing **runtime validation**: runtime-changing work cannot achieve better than PARTIAL outcome.
- Missing **architecture fitness**: no enforcement. Agents use general best practices. Not a blocker.
- Required greenfield slots must contain actual executable commands, not gap placeholders. If a greenfield project cannot fill a required slot, it needs an explicit human waiver.

### Brownfield Projects

An existing project adopting AI Dev Shop incrementally.

- All missing contracts default to **advisory mode** — the Coordinator logs the absence, agents proceed, and handoffs note that no formal contract was verified.
- **Touched-scope enforcement**: once a contract is declared (even partially), enforcement applies only to files modified in the current work. Pre-existing baseline failures are grandfathered.
- **Baseline failures**: if the host declares a contract and existing code already violates it, those violations are recorded as known baseline issues. They do not block current work. They cannot be worsened — introducing a new violation in a modified file blocks.
- Advisory mode lasts until the team explicitly promotes to full enforcement by marking the contract as `enforcement: strict` in the declaration.

## Enforcement Tiers

### Hard Blocker

Pipeline stops. The agent cannot hand off until the issue is resolved.

Triggered by:
- Blocking computational check fails on modified code
- Runtime validation returns BLOCKER
- Blocking architecture rule violated in modified file
- New violation introduced in a brownfield project with active touched-scope enforcement

### Escalation

Coordinator warns and requires human decision before proceeding.

Triggered by:
- Required contract is missing (greenfield) — Coordinator asks user to resolve before proceeding
- Contract is stale (90+ days without review)
- Non-blocking check fails repeatedly (3+ consecutive pipeline runs on same slot)
- Architecture rule waiver requested for blocking rule

### Advisory

Warning is logged. Pipeline continues. Handoff notes the finding.

Triggered by:
- Contract is missing (brownfield)
- Non-blocking check fails
- Advisory architecture rule violated
- Known baseline failure in untouched code

## Waiver Protocol

When a blocking rule needs to be bypassed for a justified reason:

- **Owner**: who authorized the waiver (human name or role)
- **Scope**: which specific rule or check is waived
- **Reason**: why the waiver is justified
- **Expiry**: when the waiver should be reviewed (default: 30 days)
- **Remediation**: what the follow-up plan is to properly address the violation

Waivers are recorded in `<ADS_MEMORY_ROOT>/governance/contracts/waivers.md`.

Agents cannot self-grant waivers for blocking rules. Only explicit human approval can create a waiver. The Coordinator may propose and record a waiver, but it is not valid until the user confirms.

## Stale Contract Detection

A contract is considered stale when:

- It has not been updated in 90+ days AND the project has had significant code changes
- It references commands or paths that no longer exist in the project
- Declared slots point to scripts that error with "not found"

When staleness is detected:
- Coordinator raises an escalation at the next pipeline start
- The contract remains enforceable on its still-valid slots
- Invalid slots are treated as empty (not blocking, but gap is reported)

## Stage Gate Behavior

The Coordinator checks contract status at each stage transition:

1. Before **Programmer** dispatch: verify computational controls exist (greenfield) or note absence (brownfield). Include declared commands in Programmer context.
2. Before **Programmer** handoff: verify all declared blocking checks pass on modified files.
3. Before **TestRunner**: pass computational test commands to TestRunner context.
4. Before **Code Review**: pass architecture fitness rules and computational lint/typecheck results to reviewer context.
5. At **Done** gate: verify no unresolved blockers from any contract. Report contract coverage in final summary.
