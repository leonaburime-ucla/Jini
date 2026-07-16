# Agent Isolation Eval Framework

Version: 2.0.0
Last Updated: 2026-04-26

## Purpose

Define a repeatable, agent-agnostic harness for testing any AI Dev Shop agent
in isolation. Each agent receives controlled inputs with seeded defects and a
hidden ledger scores what the agent caught, missed, misclassified, or invented.

Pipeline evals measure end-to-end quality but hide individual agent capability.
Isolation evals measure independent capability.

## What Changed In v2.0.0

The earlier framework proved the isolation pattern, but it still left critical
gaps:

- seed coverage was not driven by an explicit matrix
- bug nature and seed structure were mixed together
- difficulty tiers were descriptive, not calibrated
- rerun data was discussed in chat but not required as a saved artifact
- suites could look strong while still missing layered, distributed, or
  false-positive checks

This version fixes that by making coverage, controls, and persisted run data
first-class requirements.

## Core Principle

**Controlled input, hidden ledger, explicit coverage model, persisted run data,
post-hoc scoring.**

Every isolation eval now follows this structure:

1. **Coordinator designs a coverage matrix** before writing seeds
2. **Coordinator fabricates inputs** that look like natural upstream output
3. **Agent runs in a fresh context** with no knowledge of the eval
4. **Hidden seed metadata and narrative ledger** define what should be caught
5. **Run results are persisted** for every pass, not summarized from memory
6. **Coordinator scores against saved artifacts** and promotes guards only from
   reproducible evidence

The source of truth for the matrix model is
`harness-engineering/quality/eval-coverage-model.md`.

## Default Execution Protocol

Isolation evals default to the **matching repo persona**, not to an outside
model.

Use these execution modes:

- `repo_persona_subagent` — default and preferred. Spawn the matching repo
  agent persona in a fresh context and let it produce its normal artifact.
- `repo_persona_host` — fallback only when helper-agent support is unavailable
  or the user explicitly disables subagents.
- `external_peer_cli` — comparison mode only. Use this only when the user
  explicitly asks to compare Claude, Gemini, Codex CLI, or another external
  peer against the repo persona.

Rules:

1. Canonical benchmark claims for an agent should be established with
   `repo_persona_subagent` unless subagents are unavailable.
2. External-peer runs are valuable, but they are comparison artifacts, not the
   default proof of repo-agent capability.
3. Every saved run must declare `agent` and `model_id` in
   `run-manifest.tsv` so later readers can tell whether the run exercised the
   repo agent or an external comparison target.
4. When `external_peer_cli` is used, say so plainly in the summary instead of
   presenting the result as the default agent benchmark.

---

## Required Suite Artifacts

Committed suites should use this layout:

```text
harness-engineering/agent-evals/<agent>-evals/<suite-id>/
  coverage-matrix.tsv          # required: planned coverage cells (suite-level)
  seed-catalog.tsv             # required: machine-readable seed metadata (suite-level)
  seed-ledger.md               # required: hidden narrative ledger (suite-level)
  controls.md                  # required: positive/negative/regression controls (suite-level)
  run-manifest.tsv             # required once runs begin (suite-level execution proof)
  run-results.tsv              # required once runs begin (suite-level)
  <eval-name>/                 # one directory per mini-project
    project-brief.md           # what the agent sees
    seed-state/                # immutable fixture: the pre-seeded project snapshot
      src/                     #   source code with planted defects
      specs/                   #   spec artifacts (if applicable)
      reports/                 #   fake upstream handoffs
    runs/                      # created by prepare_eval_run.py; kept with the suite when retained
      <run-id>/                #   fresh copy of seed-state/ for one run
        src/
        specs/
        reports/
          <agent>-output.md    #   agent's actual output lands here
    prompts/                   # optional: exact prompts used for dispatch
  reports/
    coordinator-eval-summary.md
```

### Suite-Level vs Per-Eval Artifacts

The six TSV/MD files at the suite root (`coverage-matrix.tsv`,
`seed-catalog.tsv`, `seed-ledger.md`, `controls.md`, `run-manifest.tsv`,
`run-results.tsv`)
describe the **entire suite** and reference seeds across all mini-projects.

Each `<eval-name>/` subdirectory contains the **per-project fixtures**: the
actual code, specs, and handoffs the agent will see. The `seed-state/`
directory inside each eval is the immutable snapshot — it is never modified
during a run.

`prepare_eval_run.py` copies `seed-state/` into `runs/<run-id>/` so each run
gets a fresh working directory. This keeps the benchmark inputs stable across
reruns while keeping run history, scored results, and human-readable reports
colocalized under the suite.

```bash
# Prepare all evals in the suite for a new run:
python3 harness-engineering/quality/scripts/prepare_eval_run.py <suite-dir> <run-id>

# Prepare only one specific eval:
python3 harness-engineering/quality/scripts/prepare_eval_run.py <suite-dir> <run-id> --eval <eval-name>
```

### Scoring a Suite

After runs are persisted in `run-manifest.tsv` and graded into
`run-results.tsv`, generate the aggregate metrics:

```bash
python3 harness-engineering/quality/scripts/score_eval_suite.py <suite-dir>

# With baseline comparison for attention-budget regression detection:
python3 harness-engineering/quality/scripts/score_eval_suite.py <suite-dir> \
  --baseline-results <path-to-previous-run-results.tsv>
```

The scorer computes all required suite-level metrics, emits a status label, and
writes the report to stdout or an optional output file.

Legacy suites may keep markdown-only ledgers, but new benchmark claims should
not rely on them alone.

### Workload Confirmation Guard

Before dispatch, estimate whether the planned scope is large enough that the
user should explicitly approve it.

Pause and ask for confirmation when any of these are true:

- the run spans more than 10 scored seeds
- the run spans more than one eval project
- the plan obviously needs manual grading rather than a narrow automated check
- the executing agent cannot finish the full scope in one context window

If the user approves the larger run, record that as
`scope_confirmation = confirmed` plus a short reason in `run-manifest.tsv`.
If the scope stays small, use `scope_confirmation = not_required`.

This guard does not replace the integrity controls below. It exists to prevent
silent overcommit and to force the model to ask before taking on a large,
expensive benchmark pass.

## Coverage Matrix Format

`coverage-matrix.tsv` is the suite-level plan. One row represents one target
cell in the coverage model.

```text
cell_id  agent  agent_dimension  bug_nature  seed_structure  difficulty  requirement  rationale  seed_ids
```

Required columns:

- `cell_id`: stable identifier such as `CR-SPEC-INV-HARD-01`
- `agent`: target agent name, for example `code-review`
- `agent_dimension`: the skill dimension that should catch the seed
- `bug_nature`: taxonomy value from `eval-coverage-model.md`
- `seed_structure`: taxonomy value from `eval-coverage-model.md`
- `difficulty`: `Easy`, `Medium`, or `Hard`
- `requirement`: `required`, `optional`, or `pruned`
- `rationale`: why this cell matters or why it was pruned
- `seed_ids`: comma-separated seed IDs once the cell is populated

Use `pruned` only when a combination is nonsensical for that agent. Do not
leave gaps implicit.

## Seed Catalog Format

`seed-catalog.tsv` is the machine-readable seed inventory. It complements the
human-readable `seed-ledger.md`.

```text
seed_id  eval_name  agent  agent_dimension  skill_source  agent_guard  bug_nature  seed_structure  difficulty  domain_complexity  complexity_category  engineering_concepts  control_type  expected_severity  false_positive_risk  evidence_path  detail_ref  matrix_cell_id
```

Required columns:

- `seed_id`: stable identifier such as `SEED-CR-17`
- `eval_name`: the eval bucket or mini-project name
- `agent`: target agent
- `agent_dimension`: dimension expected to catch the issue
- `skill_source`: specific skill file and section
- `agent_guard`: agent-level guard that should catch it, or `none`
- `bug_nature`: taxonomy value
- `seed_structure`: taxonomy value
- `difficulty`: `Easy`, `Medium`, or `Hard`
- `domain_complexity`: `textbook`, `production`, `staff`, `principal`, or
  `distinguished`
- `complexity_category`: for `staff`, `principal`, and `distinguished` seeds,
  the category from the taxonomy (e.g., `concurrency_composition`,
  `scale_threshold_collapse`); use `na` for `textbook` and `production` seeds
- `engineering_concepts`: comma-separated concept codes from the taxonomy
  (e.g., `distributed-consensus,replication`); every seed must declare at
  least one concept that is *required* to catch the failure
- `control_type`: `standard`, `positive_control`, `negative_control`, or
  `regression`
- `expected_severity`: `Critical`, `Required`, or `Recommended`
- `false_positive_risk`: `None`, `Low`, `Medium`, or `High`
- `evidence_path`: repo-local path or file:line
- `detail_ref`: row/section reference into `seed-ledger.md`
- `matrix_cell_id`: target coverage cell

Keep the long-form seeded issue narrative, deception notes, and expected signal
in `seed-ledger.md`. Keep normalized fields in `seed-catalog.tsv`.

The v2 seed-catalog schema is strict. Legacy catalogs without
`domain_complexity`, `complexity_category`, and `engineering_concepts` must be
migrated or regenerated before they can validate under this harness.

Benchmark depth gates are computed over non-`negative_control` seeds only.
Negative controls remain required and are scored through false-positive
calibration; they cannot be used to satisfy staff/principal/distinguished
catch-depth floors.

The validator treats depth-gate failures as readiness failures, not malformed
metadata. A suite with valid v2 schema but insufficient high-tier depth may
still validate as `pilot`; it cannot receive `benchmark` or `stable benchmark`
status until the depth gates pass. Capability difficulty tiers and advanced
seed structures are also computed from non-`negative_control` seeds.

### Optional Suite Extensions

Some suites need extra coverage metadata beyond the shared minimum columns.
These extension columns are optional at the framework level but are valid when a
suite needs them:

- `architecture_family` — normalized project shape such as `ai_rag_platform`,
  `api_integration_hub`, or `event_driven_data_platform`
- `expected_conditional_skills` — comma-separated skill slugs that should
  activate for the seed
- `expected_non_activations` — comma-separated skill slugs that must *not*
  activate for the seed

If a suite adds extension columns, keep them stable across all rows and update
the suite-local README so human scorers know how to populate the matching run
observations.

### Required Seed-Ledger Fields for Staff+ Seeds

Seeds classified as `staff`, `principal`, or `distinguished` must include the
following fields in their `seed-ledger.md` entry. These fields are the
structured evidence that proves the seed meets the High-Tier Seed Eligibility
criteria defined in `eval-coverage-model.md`.

| Field | Purpose | Example |
|---|---|---|
| `production_trigger` | The specific production condition that activates the failure (load, timing, partition, scale, data shape) | "Replica lag > 50ms under concurrent writes from two services" |
| `deceptive_cues` | What makes the artifact look correct to a competent reviewer | "All unit tests pass; the connection pool config matches documented best practices" |
| `required_concepts` | Engineering concepts required to catch the failure (use concept codes from the taxonomy) | `replication, distributed-state` |
| `causal_chain` | The multi-step reasoning path from observable artifact to root cause | "1. Write hits primary → 2. Read hits replica → 3. Replica lag causes stale read → 4. Cache repopulates from stale read → 5. TTL outlasts lag window" |
| `why_local_review_passes` | Why a competent reviewer would approve each component individually | "Each service correctly validates its own inputs; the race only manifests when Service A's retry overlaps with Service B's cache refresh" |
| `acceptable_root_cause` | The correct root cause statement an agent must produce (or equivalent) | "Read-your-writes violation under replica lag with cache repopulation race" |
| `unacceptable_shallow_answers` | Answers that touch the surface but miss the mechanism — these score PARTIAL at best | "Missing error handling", "Should add retry logic", "Cache TTL too short" |
| `minimum_evidence_chain` | The minimum set of artifacts/locations the agent must reference to justify a CAUGHT score | "Must reference: connection pool config, replica topology, cache TTL setting, and the write path timing" |
| `domain_expert_note` | The domain principle being tested, stated as a named concept or theorem | "Read-your-writes violation under replica lag" or "Compression-before-encryption length leak (CRIME/BREACH class)" |

**Rules:**

- Legacy suites may keep freeform ledger entries, but new benchmark claims for
  staff+ seeds require all nine fields.
- The `domain_expert_note` is the most important field for distinguished seeds.
  It names the deep principle that makes the failure invisible to non-experts.
- If a seed cannot fill `causal_chain` with at least 3 steps, it is likely not
  staff+ — reconsider its complexity classification.
- The `unacceptable_shallow_answers` field prevents partial-credit inflation by
  defining what does NOT count as catching the real issue.

**Validation:**

The validator checks that staff+ seeds in `seed-ledger.md` include all required
fields when the suite claims benchmark status. Missing fields are a blocking
warning, not a silent pass.

## Run Manifest Format

Every executed eval must be persisted in `run-manifest.tsv` before its seeds
are scored.

```text
run_id  eval_name  run_scope  execution_mode  agent  model_id  model_label  execution_status  scope_confirmation  scope_confirmation_notes  started_at  completed_at  artifact_path  artifact_sha256  transcript_path  transcript_sha256
```

Required columns:

- `run_id`: stable identifier for the suite run
- `eval_name`: which eval was executed
- `run_scope`: `benchmark_full` or `targeted_regression`
- `execution_mode`: `repo_persona_subagent`, `repo_persona_host`, or
  `external_peer_cli`
- `agent`: target agent, for example `programmer`
- `model_id`: exact model identifier used for the run
- `model_label`: human-readable display label
- `execution_status`: `completed`, `simulated`, `aborted`, or `failed`
- `scope_confirmation`: `confirmed` or `not_required`
- `scope_confirmation_notes`: why the scope was approved or why no pause was needed
- `started_at`: ISO-8601 UTC timestamp for dispatch start
- `completed_at`: ISO-8601 UTC timestamp for completion
- `artifact_path`: retained primary output path relative to the suite root
- `artifact_sha256`: SHA-256 hash of the retained primary output
- `transcript_path`: retained raw transcript or stdout path relative to the suite root
- `transcript_sha256`: SHA-256 hash of the retained transcript

Rules:

- scored runs must have a matching `completed` manifest row
- manifest hashes must match the retained files on disk
- simulated runs may be recorded, but they must never be scored as benchmark evidence

## Run Results Format

Every scored seed must be persisted in `run-results.tsv`.

```text
run_id  eval_name  run_scope  execution_mode  agent  model_id  model_label  seed_id  result  severity_correct  evidence_path  evidence_excerpt  reviewer_notes  executed_at
```

Required columns:

- `run_id`: stable identifier for the run
- `eval_name`: which eval was executed
- `run_scope`: `benchmark_full` or `targeted_regression`
- `execution_mode`: `repo_persona_subagent`, `repo_persona_host`, or
  `external_peer_cli`
- `agent`: target agent, for example `programmer`
- `model_id`: exact model identifier used for the run
- `model_label`: human-readable display label
- `seed_id`: seed being scored
- `result`: `CAUGHT`, `PARTIAL`, `MISSED`, `FALSE_POSITIVE`, or `CORRECT_SKIP`
- `severity_correct`: `yes`, `no`, or `na`
- `evidence_path`: retained output path or file:line used for grading
- `evidence_excerpt`: exact or summarized output fragment that justifies the grade
- `reviewer_notes`: free-text scoring rationale
- `executed_at`: ISO-8601 UTC timestamp

Rules:

- one row per seed per run
- each row must match a completed `run-manifest.tsv` row for the same
  `run_id` + `eval_name`
- negative controls must use `CORRECT_SKIP` or `FALSE_POSITIVE`
- a benchmark claim requires at least 3 distinct `benchmark_full` runs after
  any agent, skill, or prompt change
- a targeted regression claim requires at least 3 distinct
  `targeted_regression` runs for each unresolved seed being re-tested

If the run data is not saved, the claim is exploratory, not benchmark-grade.

For historical baselines only, the scorer still interprets legacy
negative-control `MISSED` rows as a correct skip so older reports do not keep
showing the misleading 71.4%-style math. New saved runs must use
`CORRECT_SKIP`.

Optional run-result extension columns may also be added when a suite wants to
measure activation discipline rather than just catch/miss outcomes.

- `observed_conditional_skills` — comma-separated list of conditional skills
  the scorer observed in the agent output for that seed/run

When present, scorers may compare the observed set against
`expected_conditional_skills` and `expected_non_activations`.

## Two Rerun Loops

Use two different rerun modes on purpose:

1. **Benchmark full runs**
   Re-test the full suite when establishing or re-certifying benchmark claims.
   These runs must score every seed in the suite.
2. **Targeted regression runs**
   Re-test only the previously missed or partial seeds after a guard, prompt,
   or skill change. Do not waste reruns on seeds that were already stable.

Targeted regression runs are valid evidence for "did we fix the misses?" They
are not a replacement for periodic full-suite benchmark re-certification.

## Control Packs

Benchmark suites must include all three internal control types:

- `positive_control`: obvious must-catch seeds that verify the agent is awake
- `negative_control`: plausible-looking non-bugs that measure false positives
- `regression`: seeds preserved specifically to ensure earlier capability does
  not disappear when new guards are added

`controls.md` should list which seeds belong to each pack and why.

Targeted regression packs may be regression-only. In that mode, `controls.md`
must say which baseline benchmark suite they derive from and why only the
unresolved seeds were re-run.

## Difficulty Rules

Difficulty is no longer a vibe label. Use the calibration rules in
`eval-coverage-model.md`.

At minimum:

- **Easy**: one artifact or one location; no serious deception required
- **Medium**: cross-function or cross-artifact; at least one competing cue
- **Hard**: layered, distributed, semantic, ambiguity-based, or deception-heavy

If a seed is labeled `Hard`, its structure should justify the label.

## Scoring Rubric

Per seed:

| Score | Definition | Numeric |
|---|---|---|
| `CAUGHT` | Correct issue at correct severity/classification | 1.0 |
| `PARTIAL` | Related concern, but wrong severity, scope, or explanation | 0.5 |
| `MISSED` | Issue not flagged at all | 0.0 |
| `FALSE_POSITIVE` | Agent flagged a non-issue | 0.0 and counts against FPR |

Required suite-level reporting:

- mean score per run
- per-seed catch rate across saved runs
- severity accuracy across saved runs
- false positive rate
- per-difficulty breakdown
- per-bug-nature breakdown
- per-seed-structure breakdown
- per-dimension breakdown

Do not headline a single-run number as the capability score after a framework
change. Report the saved multi-run aggregate.

## Validation

Use the suite validator before claiming the suite is ready:

```bash
python3 harness-engineering/validators/validate_eval_suite.py <suite-dir> --require-run-results --min-runs 3
```

The validator checks:

- required suite files exist
- coverage cells are explicit
- required cells are populated by seeds
- seed metadata uses valid taxonomy values
- benchmark suites have positive, negative, and regression controls
- benchmark suites include advanced structures and difficulty spread
- saved run data covers all required seeds for the specified `run_scope`

If the validator fails, the suite is not benchmark-ready.

---

## Agent-Specific Input Designs

### Code Review Agent

**Input**: Pre-staged code with remaining bugs plus a fake Programmer handoff.

**Target coverage**:

- all Code Review dimensions
- bug natures such as invariant violation, semantic mismatch, omission, and
  severity misclassification
- structures beyond `single`, especially `camouflaged`, `distributed`, and
  `interference`

**Required control pressure**:

- regression seeds for previously promoted guards
- negative controls to verify CR does not invent issues in clean sections

### Programmer Agent

**Input**: Brownfield code plus a project brief.

**Target coverage**:

- coding foundations
- implementation guardrails
- function quality assessment
- both local defects and cross-record aggregate behavior

Programmer evals are still isolation evals, but they now need the same matrix,
control packs, and saved run-results as other agents.

### Spec Agent

**Input**: Vague or contradictory brief.

**Target coverage**:

- omission
- contradiction
- boundary ambiguity
- invariant omission
- implicit dependency
- untestable acceptance criteria

Strong Spec evals should lean heavily on `layered`, `camouflaged`, and
`interference` seeds because high-quality spec work is mostly judgment, not
surface bug spotting.

### Refactor Agent

**Input**: Working code plus review guidance.

**Target coverage**:

- cosmetic-fix traps
- behavior drift
- wrong abstraction target
- distributed dependency breakage
- test upkeep misses

### Architect, Security, TDD, Red Team

These agents should use the same structure: explicit matrix first, then seed
design, then saved multi-run scoring. Do not invent agent-specific suite rules
that bypass the shared coverage model.

---

## Harness Execution Protocol

### Before the eval

1. Define the suite's target dimensions.
2. Build `coverage-matrix.tsv`.
3. Mark nonsensical combinations as `pruned` with rationale.
4. Create `seed-catalog.tsv` and `seed-ledger.md`.
5. Define `positive_control`, `negative_control`, and `regression` packs in
   `controls.md`.
6. Stage the eval directory and upstream-deception artifacts.
7. Run `validate_eval_suite.py` without run requirements to catch schema and
   coverage issues before dispatch.
8. If the scope crosses the workload-confirmation threshold, pause and ask the
   user whether to proceed with the full run or narrow the scope.

### During the eval

9. Dispatch the matching repo persona in a fresh context.
   - Default to `repo_persona_subagent`.
   - Use `repo_persona_host` only when subagents are unavailable or disabled.
   - Use `external_peer_cli` only when the user explicitly asks for cross-model
     comparison.
10. Let the agent produce its normal output with no intervention.
11. Record the completed run in `run-manifest.tsv`, including hashes for the
    retained output artifact and transcript.
12. Score the run into `run-results.tsv`.

### After the eval

13. Re-run at least 3 times after any framework, guard, or prompt change.
14. Generate `coordinator-eval-summary.md` from saved run data.
15. Promote guards only from repeated, persisted misses or Critical one-offs
    according to `failure-promotion-policy.md`.

### Iteration

16. When Easy saturates, add harder structures before adding more Easy seeds.
17. When a new guard fixes one seed but destabilizes another, add or strengthen
    regression seeds rather than assuming the latest run is representative.
18. Retire low-signal seeds only after they stay stable across 3 or more
    benchmark runs and still leave the coverage matrix satisfied.

## Metrics To Track

| Metric | Definition | Target |
|---|---|---|
| Independent catch rate | Mean caught score across saved runs | Agent-dependent, but never single-run only |
| False positive rate | False positives / total findings | 0% for benchmark claims |
| Severity accuracy | Correct severity / caught-or-partial seeds | > 90% |
| Per-tier catch rate | Catch rate by `Easy`, `Medium`, `Hard` | Visible in every summary |
| Per-structure catch rate | Catch rate by structure type | Visible in every summary |
| Per-bug-nature catch rate | Catch rate by bug taxonomy | Visible in every summary |
| Per-domain-complexity catch rate | Catch rate by `textbook`, `production`, `staff`, `principal`, `distinguished` | Visible in every summary |
| Per-complexity-category catch rate | Catch rate by category (e.g., `concurrency_composition`) | Visible when staff+ seeds exist |
| Run variance | Spread across saved runs | Should shrink over time |
| Matrix completion | Covered required cells / required cells | 100% |

Catch-rate breakdowns that diagnose agent capability exclude negative-control
seeds. Negative controls are reported through the false-positive rate instead,
so a correctly skipped non-bug cannot inflate a concept, category, domain, or
dimension catch rate.

### Skill Gap Diagnostics

The per-complexity-category and per-engineering-concept catch rates are the
primary diagnostics for agent skill gaps.

**Confirmed skill gap criteria:**
- Any complexity category with < 50% catch rate across 3+ runs
- Any engineering concept with < 50% catch rate across 3+ runs
- Any concept that is completely missed (0% catch) in even a single run

**Report in `coordinator-eval-summary.md`:**
- Per-concept catch rate heatmap (concept × complexity tier)
- Ranked list of confirmed skill gaps (worst catch rate first)
- For each gap: concept code, complexity tier, missed seed IDs, what knowledge
  would have been required, and whether a relevant skill already exists
- Delta from previous run (did a recent change close a gap?)

**Do not automatically create skills, guards, or instructions from eval
results.** The report surfaces the gaps — the human decides what to address,
when, and how. Some gaps may be acceptable. Some may need a skill. Some may
need a different approach entirely.

## Definition Of Done

A suite is close to trustworthy when all of these are true:

1. every required coverage cell is explicit and populated
2. bug nature and seed structure are both tracked
3. positive, negative, and regression controls exist
4. at least 3 saved runs exist after the latest framework change
5. every run is persisted in `run-manifest.tsv` and every scored seed is persisted in `run-results.tsv`
6. the suite validator passes
7. the summary is derived from saved artifacts, not chat recollection

## Legacy Note

Earlier suites in this repo are still useful, but unless they are migrated to
the matrix-plus-runs model they should be treated as exploratory or pilot
evidence, not as stable benchmark infrastructure.

## Relationship To Other Harness Docs

- `eval-coverage-model.md` — canonical taxonomy and coverage rules
- `function-quality-seeded-evals.md` — domain-specific application for
  Programmer, Code Review, and Refactor
- `failure-promotion-policy.md` — promotion rules for repeated failures
- `agent-performance-scorecard.md` — roll-up view after suites are benchmarked
