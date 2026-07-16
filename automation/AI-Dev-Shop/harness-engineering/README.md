# Harness Engineering

Last Updated: 2026-05-23

This folder is the repo-local system of record for harness engineering work in AI Dev Shop.

Harness engineering means building the scaffolding around agents so they can work reliably: knowledge maps, validators, guardrails, eval loops, cleanup cadences, and feedback systems.

This area started as a pragmatic rollout, but it now covers runtime rules, seeded evals, harness evals, validators, drift sensors, maintenance policy, external skill intake, and framework-maintainer guidance.

## Design Principles

- Map, not manual: keep root instructions short and push detail into linked sources of truth.
- Repository-local knowledge: if the agent cannot discover it in-repo, it is operationally invisible.
- Mechanical enforcement first: convert important markdown rules into checks that fail loudly with fix guidance.
- Progressive disclosure: give agents only the context they need for the current task.
- Closed-loop improvement: recurring failures should become guardrails, benchmarks, or skill updates.
- Continuous garbage collection: keep drift small and frequent instead of waiting for a large cleanup event.

## Folder Layout

```text
harness-engineering/
  README.md
  agent-evals/
    <agent-name>-evals/
      benchmark-suite/
  archive/
  harness-evals/
    contract-enforcement/
    drift-sensors/
    git-and-docs/
  hooks/
  maintainers/
    guides/
    skill-md-format/
  maintenance/
    doc-staleness-policy.md
    doc-staleness-watchlist.md
    observer-cadence.md
    tech-debt-tracker.md
  plans/
    active/
    completed/
  policy/
    ci-enforcement.md
    registry-integrity-policy.md
  quality/
    README.md
    agent-isolation-eval-framework.md
    evaluation-loops.md
    eval-coverage-model.md
    failure-promotion-policy.md
    function-quality-seeded-evals.md
    load-bearing-harness-audit.md
    model-upgrade-program.md
    phase-checkpoint-template.md
    quality-score.md
    react-component-testing-policy.md
    stage-output-schema.md
    spec-definition-of-done.md
    agent-performance-scorecard.md
    test-first-design-policy.md
    testability-antipatterns.md
    debug-playbook.md
  references/
  runtime/
    capability-verification.md
    context-firewalls.md
    context-offloading.md
    self-validation.md
    session-continuity.md
    subagent-usage-policy.md
    tripwires.md
  sensors/
    coverage-quality.md
    dead-code.md
    dependency-drift.md
  skills-inbox/
    archive/
    external/
  validators/
```

## Folder Roles

- `agent-evals/`: seeded eval suites for individual agent roles; these test whether a persona catches the intended defects and produces valid output
- `archive/`: retained historical framework artifacts that should stay out of the active harness path
- `harness-evals/`: seeded eval suites for the harness itself, such as contract enforcement, drift sensors, git behavior, and docs behavior
- `hooks/`: reserved host lifecycle hook documentation and future integrations; not currently an active feature
- `maintainers/`: maintainer-only framework evolution docs, migration guides, and instruction-format rollout work
- `maintenance/`: cleanup cadence, doc-staleness tracking, and ongoing harness debt management
- `plans/`: active and completed harness rollout plans
- `policy/`: hard repo-enforcement policies that back validators and CI checks
- `quality/`: evaluator loops, failure-promotion doctrine, load-bearing audits, model-upgrade policy, scorecards, seeded-eval doctrine, and testing-quality guidance
- `references/`: distilled external source material that informs local harness decisions
- `runtime/`: live harness rules that affect agent execution, resumption, self-validation, context flow, and capability checks
- `sensors/`: recurring codebase-health signals routed through Observer maintenance flows
- `skills-inbox/`: external skill ingestion quarantine, review policy, and archived decisions
- `validators/`: executable checks and probe scripts

## How It Fits Together

1. `runtime/` defines the rules agents follow during a run.
2. `policy/` and `validators/` turn selected rules into mechanical checks.
3. `quality/`, `agent-evals/`, and `harness-evals/` define how changes are measured before they become trusted defaults.
4. `sensors/` and `maintenance/` catch drift after the framework is in use.
5. `skills-inbox/` controls external skill intake so shared instructions do not become a dumping ground.
6. `references/`, `plans/`, and `maintainers/` preserve the rationale and rollout history behind framework changes.

## What Is Implemented Now

- Local reference notes distilled from primary-source harness guidance
- A harness rollout plan and debt tracker
- An initial quality score baseline for this repo
- Executable validators for path references and skills-registry integrity
- A doc-garden audit script for advisory health signals
- Local reference notes for OpenAI, Anthropic, LangChain, and Vercel harness patterns
- An explicit Observer/doc-garden cadence for toolkit maintenance
- Seed benchmark fixtures for the golden-sample pre-implementation stages
- Committed agent eval suites under `agent-evals/` for multiple pipeline roles
- Harness eval suites under `harness-evals/` for contract enforcement, drift sensors, git behavior, and docs behavior
- Drift sensor definitions for dead code, dependency drift, and coverage quality
- A failure-promotion rule for turning repeated mistakes into durable harness artifacts
- CI enforcement guidance plus a GitHub Actions workflow that runs the validator entrypoint
- A durable progress-ledger pattern for resumable long-running work
- Deterministic pre-completion and loop-detection tripwires
- A hard-fail policy for shared-skills registry coverage plus an intentional-exclusion escape hatch
- A capability-verification policy plus a local host probe for version-sensitive runtime features
- A subagent-usage policy plus runtime mode resolution for automatic helper-agent defaulting
- A file-trigger routing table and context-firewall rules for cleaner discovery dispatch
- A file-backed context-offloading rule for long logs, traces, and retry evidence
- Stack-specific self-validation templates for downstream runtime checks
- An independent-evaluator loop policy for skeptical QA, grading rubrics, and build contracts
- A model-upgrade program and load-bearing audit method for simplifying stale harness components
- Retained evaluator contract/report templates plus a validator that enforces them when `evaluator_mode: required` is declared in a progress ledger
- A retained load-bearing audit template plus a validator for benchmark-driven maintenance reports
- An explicit compaction-vs-reset rule for long-running sessions instead of treating resets as timeless defaults
- A maintenance-report generator plus scheduled cleanup workflow support
- A narrow doc-staleness watchlist plus advisory audit for high-risk source-of-truth docs

## How To Use

Run the full first-pass harness checks:

```bash
bash harness-engineering/validators/run-all.sh
```

Inspect capability status on the current host:

```bash
bash harness-engineering/validators/probe_host_capabilities.sh
```

Check whether live browser automation is enabled on the current host:

```bash
bash harness-engineering/validators/probe_host_capabilities.sh --host <detected-host> --capability browser_automation
```

Resolve automatic subagent mode for the current host:

```bash
bash harness-engineering/validators/resolve_subagent_mode.sh --host <detected-host>
```

Run the validators individually:

```bash
python3 harness-engineering/validators/validate_path_references.py
python3 harness-engineering/validators/validate_registry_integrity.py
python3 harness-engineering/validators/validate_contracts.py
python3 harness-engineering/validators/validate_eval_suite.py
python3 harness-engineering/validators/validate_evaluator_artifacts.py
python3 harness-engineering/validators/validate_load_bearing_audits.py
python3 harness-engineering/validators/doc_garden_audit.py
```

## Current Boundaries

- These validators currently check repository knowledge integrity, not application runtime behavior.
- Self-validation templates live here, but the project-specific repo that uses this toolkit must still define the actual boot commands, health checks, critical-path assertions, and any richer static-analysis/runtime enforcement it wants. The bounded retry and optional sidecar-diagnosis rules live in `harness-engineering/runtime/self-validation.md`; the host project supplies the concrete commands those rules execute.
- The evaluator-loop and load-bearing-audit validators only enforce retained artifact shape and declared presence. They do not prove that the evaluator or benchmark methodology itself was high quality.
- Many seeded eval suites exist, but not every suite has retained runs yet. Treat generated fixtures without run results as coverage scaffolding, not proof of agent quality.
- `hooks/` is reserved for future lifecycle integrations. Do not claim hook support unless a host-specific integration is verified and wired into the framework.
- Meta-harness auto-optimization, raw-trace optimizer loops, cost-aware harness selection, and programmatic action-veto middleware are tracked as open roadmap work in `todo.md`.
- Enterprise shift-left harnesses remain in `skills/enterprise-spec/`; this folder is the broader repo-level harness layer.
- `AGENTS.md` reduction is intentionally tracked separately in `todo.md` so the harness layer can stabilize first.

## Primary Source References

- OpenAI: `references/openai-harness-engineering.md`
- OpenAI: `references/openai-practical-guide.md`
- Anthropic: `references/anthropic-harness-design-long-running-apps.md`
- Anthropic: `references/anthropic-guardrails.md`
- LangChain: `references/langchain-anatomy-agent-harness.md`
- LangChain: `references/langchain-improving-deep-agents.md`
- Vercel: `references/vercel-ai-engineering-company.md`
