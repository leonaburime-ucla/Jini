# Self-Validation Harness Templates

This file defines the downstream runtime harness pattern for repos that use this toolkit.

## Why This Exists

Green unit tests are not the same as a working app. Before handoff, agents often need a repo-local runbook for booting the app, checking logs, exercising one critical path, and retrying once with fresh evidence.

This file covers the implementer's own runtime checks. It does not assume self-validation is an unbiased final judge for harder autonomous builds.

## What A Self-Validation Harness Is

A self-validation harness is a stack-specific runbook that tells the implementing agent how to:

- boot the app or service
- inspect logs and startup health
- exercise a critical user or API path
- capture artifacts when something fails
- retry after one scoped fix before handoff

## When To Use It

Use a self-validation harness when the change affects:

- runtime startup or configuration
- HTTP/API behavior
- browser or mobile UI behavior
- auth, background jobs, queues, or integrations
- database migrations or deployment-sensitive behavior

Pure documentation work, policy/docs-only framework edits, and non-runtime markdown maintenance do not need one.

If the task is beyond what the current model handles reliably in one pass, add a separate evaluator loop per `harness-engineering/quality/evaluation-loops.md` instead of treating self-validation as the only quality gate.

## Canonical Templates

Start from the closest stack template under `<AI_DEV_SHOP_ROOT>/framework/templates/self-validation/`:

- `generic-web-app-template.md`
- `node-api-template.md`
- `python-service-template.md`
- `supabase-template.md`

## Contract Integration

This file defines the execution pattern and bounded retry rules for runtime validation. The **authoritative declaration contract** — what fields the host project must fill in and the formal outcome definitions — lives at `<AI_DEV_SHOP_ROOT>/framework/contracts/runtime-validation.md`.

Host projects write their concrete declarations to `<ADS_MEMORY_ROOT>/governance/contracts/runtime-validation.md`. The outcome descriptions below (PASS/PARTIAL/BLOCKER) are kept consistent with the contract but the contract is the source of truth.

## What The Host Project Must Define

Dropping this toolkit into a repo does not automatically create a runnable runtime harness. The host project still needs to fill in the concrete checks.

At minimum, define:

1. the real boot or startup command for the app or service
2. the healthy signal to wait for
3. the exact critical path to exercise
4. the exact negative or edge path to exercise
5. where logs, screenshots, traces, or payload dumps should be offloaded
6. which local static-analysis or runtime checks exist for that stack, and whether each is advisory or blocking
7. whether one bounded diagnosis pass is allowed on that host before the final rerun

This setup should be concrete enough that the Programmer can run it without guessing and bounded enough that repeated failure does not become an endless retry loop.

## Minimum Validation Loop

Every self-validation harness should include:

1. environment preflight
2. boot command
3. log inspection checkpoints
4. one critical-path verification
5. one negative-path or edge-path verification
6. artifact capture for failures
7. one retry-after-fix pass before handoff

## Bounded Diagnosis Pass

A bounded diagnosis pass means exactly one additional diagnostic step before the final rerun.

- On hosts with verified helper-agent support, this may be one sidecar helper-agent diagnostic pass.
- On single-agent or unverified hosts, this means one isolated discovery pass in the same session.

It is not an open-ended extra retry budget. Use it once or skip it.

## Bounded Retry Rule

Self-validation should reduce false confidence, not create an endless token sink.

Use this bounded sequence:

1. initial validation run
2. one focused fix plus one rerun
3. if the issue is still unclear, optionally run one bounded diagnosis pass to sharpen the hypothesis before one final rerun

Do not keep repeating the same runtime check beyond that sequence without a materially new reason.

If the same failure remains after the bounded sequence:

- write the failure clearly into the self-validation report
- add the cluster to `progress-ledger.md`
- stop blind retrying
- hand off with an explicit status instead of burning more cycles

## Outcome Rule

Use one of these statuses in the self-validation report and the Programmer handoff:

- `PASS`: the required runtime checks succeeded
- `PARTIAL`: bounded attempts were used, the exact failure is recorded, and the work can continue downstream with explicit risk because the issue is environmental, locally unverified, or otherwise not yet proven to be a real ship blocker
- `BLOCKER`: the runtime loop exposed a confirmed critical-path regression, data-loss risk, migration breakage, auth/security break, or another issue that should stop the pipeline

`PARTIAL` is not a silent pass. It is a documented warning state with evidence, offload paths, current hypothesis, and recommended next owner.

Examples:

- `PARTIAL`: the app boots, logs are clean, and the core local path works, but the final external-provider handshake cannot be verified on this host because the sandbox credentials or dependency are unavailable. The exact failing step is recorded and the work remains locally unverified, not proven broken.
- `BLOCKER`: startup crashes, readiness never goes green, a migration breaks boot, or a critical auth/API path returns the wrong result under local validation. That is a real stop condition, not just an unverified environment.

## Output Location

Store the run result at:

`<ADS_MEMORY_ROOT>/reports/self-validation/SV-<feature-or-workstream>-<YYYY-MM-DD-HHmm>.md`

If long logs or DOM dumps are needed, offload them per `<AI_DEV_SHOP_ROOT>/harness-engineering/runtime/context-offloading.md`.

## Handoff Rule

If runtime validation is in scope and the harness was not run, the agent must say so explicitly and treat the handoff as incomplete or partial. Do not imply “done” when the runtime path was never exercised.

If runtime checks passed locally but the task still required an independent evaluator to judge product quality, edge-case depth, or end-to-end usability, do not present self-validation alone as final acceptance.

If runtime validation was run but remained unresolved after the bounded retry rule above:

- use `PARTIAL` when the problem is recorded clearly and not yet proven to be a true blocker
- use `BLOCKER` when the runtime evidence shows the feature is genuinely unsafe or broken to ship
- never keep retrying just to avoid writing down an unresolved runtime problem
