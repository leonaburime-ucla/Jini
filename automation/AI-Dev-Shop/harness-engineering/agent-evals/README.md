# Agent Evals

Committed seeded eval suites live here.

## Eval Design Resources

Load these files when creating or revising evals for any agent:

- **`bug-taxonomy.md`** — Canonical pool of 200+ issue types: real bugs,
  negative controls, traps, ambiguities, design trade-offs, severity traps.
  All agent-neutral. This is the MENU of what to plant.

- **`eval-design-playbook.md`** — Lessons learned and design rules from
  building the CR eval suite. Covers brief design, fixture design, NC design,
  scoring, process, cross-model testing, and anti-patterns. Load this FIRST
  when starting eval work.

Rule: the taxonomy is a menu. The per-eval `seed-ledger.md` is the oracle
(hidden from the evaluated agent) where evidence paths, scoring criteria,
and expected severity live.

## Layout

- `architect-evals/`
- `codebase-analyzer-evals/` — benchmark suite generated; no saved runs yet
- `code-review-evals/`
- `database-evals/` — design-only; benchmark suite not generated yet
- `devops-evals/` — design-only; benchmark suite not generated yet
- `docs-evals/` — benchmark suite generated; no saved runs yet
- `programmer-evals/`
- `qa-e2e-evals/` — design-only; benchmark suite not generated yet
- `red-team-evals/` — v1 benchmark suite generated; v2 depth design pending regeneration
- `refactor-evals/` — design-only; benchmark suite not generated yet
- `spec-evals/` — benchmark suite generated for Speckit + OpenSpec; no saved runs yet
- `security-evals/` — design-only; benchmark suite not generated yet
- `supabase-evals/` — design-only; benchmark suite not generated yet
- `system-blueprint-evals/` — benchmark suite generated; no saved runs yet
- `tdd-evals/` — benchmark suite generated; first targeted run retained
- `testrunner-evals/` — benchmark suite generated; first targeted run retained

Keep suite-local artifacts together:

- `run-manifest.tsv` — run-level execution proof, artifact paths, hashes, and scope-confirmation status
- `run-results.tsv` — per-seed grading rows with evidence excerpts

The canonical suite definition and its retained run history should stay
colocalized under the owning agent bucket.

## Directory Naming Guide

| Name | Scope | Purpose |
|------|-------|---------|
| `eval-results/` | Run-level (`runs/run-001/eval-results/`) | Agent output from a specific eval run: the results file the agent writes during execution |

Additionally, `seed-state/eval-results/` in code-review evals contains the
**fake handoff** that is INPUT to the CR agent (part of the seeded fixture),
not agent output.

## Execution Guard (Blocking)

Each eval MUST run in its own isolated subagent context. Do not batch
multiple evals into a single subagent.

Rules:

1. **One subagent per eval.** Each eval gets a fresh subagent loaded with
   only that eval's `project-brief.md`, `prompts/`, and `seed-state/`.
   Cross-eval context bleed invalidates results.
2. **Agent persona bootstrap required.** The subagent must be bootstrapped
   with the correct agent persona per `AGENTS.md` Delegated Agent Bootstrap.
   Load the persona that matches the owning eval bucket.
3. **No shared state between evals.** Each subagent starts from the clean
   `runs/<run-id>/` directory created by `prepare_eval_run.py`. Do not
   carry findings, context, or corrections from one eval into another.
4. **Parallel is fine, batching is not.** Running 9 subagents in parallel
   (one per eval) is encouraged. Running 1 subagent sequentially across all
   9 evals is a blocking violation.

Why: seeded evals are designed so each eval has its own independent project
brief, its own bugs, and its own fake context. Mixing eval contexts causes
the agent to import assumptions from unrelated projects, miss seeds due to
context window saturation, and produce results that cannot be scored per-eval.

## After Each Run — Coordinator Responsibilities

The subagent writes its results to `eval-results/eval-results-run.md` inside
its run directory. The coordinator (whoever dispatches the run) is responsible
for updating the suite-level `run-manifest.tsv` first, then `run-results.tsv`.

Manifest row fields:

`run_id`, `eval_name`, `run_scope` (benchmark_full / targeted_regression),
`execution_mode` (repo_persona_subagent / repo_persona_host /
external_peer_cli), `agent`, `model_id`, `model_label`, `execution_status`,
`scope_confirmation` (confirmed / not_required), `scope_confirmation_notes`,
`started_at`, `completed_at`, `artifact_path`, `artifact_sha256`,
`transcript_path`, `transcript_sha256`.

Seed grading row fields:

`run_id`, `eval_name`, `run_scope` (benchmark_full / targeted_regression),
`execution_mode` (repo_persona_subagent / repo_persona_host /
external_peer_cli), `agent`, `model_id`, `model_label`, `seed_id`,
`result` (CAUGHT / PARTIAL / MISSED / FALSE_POSITIVE / CORRECT_SKIP),
`severity_correct`, `evidence_path`, `evidence_excerpt`, `reviewer_notes`,
`executed_at`.

The subagent must include its model name and version in the eval-results
file. The coordinator copies that into the manifest/results TSVs. Do not rely
on the subagent to write suite TSVs directly — it only has access to its own
run directory.

For large runs, pause before dispatch. If the plan spans more than 10 seeds,
more than one eval, or obvious manual grading, ask the user to confirm the
scope and record that approval as `scope_confirmation = confirmed` in
`run-manifest.tsv`.
