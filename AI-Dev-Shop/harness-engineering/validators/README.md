# Harness Validators

These validators are the first mechanical enforcement layer for this repo.

## Hard Validators

- `validate_path_references.py`
  - checks that repo-local markdown path references point to real files or directories
- `validate_contracts.py`
  - checks framework contract specs, template host declaration skeletons, and live host declarations when present for required files, headings, slots, and links
- `validate_registry_integrity.py`
  - checks that `skills-registry.md` entries point to real files
  - fails when canonical skill files exist on disk but are not registered
  - allows explicit exclusions only through `framework/routing/skills-registry-exceptions.md`
- `validate_evaluator_artifacts.py`
  - checks retained evaluator contracts and evaluator reports for required fields and sections
  - fails when a `progress-ledger.md` marks `evaluator_mode: required` but no retained evaluator contract is recorded
- `validate_load_bearing_audits.py`
  - checks retained `project-knowledge-template/reports/maintenance/harness-load-bearing-*.md` reports for required sections and decision labels
- `validate_debate_routing_guard.py`
  - checks that debate requests default to Swarm Consensus with external peer LLMs
  - fails when the guard against silent platform-subagent fallback is removed from root, Coordinator, slash-command, or Swarm Consensus docs
- `validate_slash_command_parity.py`
  - detects STALE installed slash commands: `.claude/commands/<cmd>.md` present but differing from the canonical `framework/slash-commands/<cmd>.md` source
  - fails (VIOLATION) only on divergence (stale content); MISSING (opt-in / not installed) and EXTRA copies are informational notes, not failures
  - project-scoped `gstack-*` commands are opt-in (`--include-project`); a MISSING one is never a failure
  - FIX telemetry points at `install-slash-commands.sh --install --overwrite`
- `validate_swarm_model_identity_guard.py`
  - checks that Swarm Consensus preflight shows peer model identity first
  - fails when CLI version strings can be presented as model names or model versions
- `validate_specs_as_built_freshness.py`
  - checks `ADS-memory/specs_as_built/` metadata when present
  - recomputes source-scope fingerprints and fails on concrete stale generated/hybrid artifacts
  - checks the generation manifest scaffold and minimum component folder shape when components are present
  - no-ops for projects that have not adopted specs-as-built yet
- `validate_eval_suite.py`
  - validates seeded eval suite metadata and saved run results
  - checks coverage-matrix cells, seed-catalog taxonomy values, benchmark-vs-regression suite rules, run-manifest execution proof, scope-confirmation metadata, run-results evidence, and per-run benchmark completeness
  - intended for targeted use on `harness-engineering/agent-evals/<agent>-evals/<suite-id>/` rather than repo-wide `run-all.sh`
## Advisory Audit

- `doc_garden_audit.py`
  - reports repo-health signals that maintainers should review regularly
  - does not fail the run by itself
- `doc_staleness_audit.py`
  - checks a narrow watchlist of high-risk docs against concrete source-of-truth targets and review cadence
  - advisory only; intended to catch silent routing/workflow drift early
- `generate_maintenance_report.py`
  - refreshes `project-knowledge-template/reports/maintenance/harness-maintenance.md` from current repo state
  - intended for scheduled maintenance workflows and manual maintainer passes
- `probe_host_capabilities.sh`
  - checks version-sensitive host capabilities against the local environment when a reliable probe exists
  - prints `enabled`, `unavailable`, or `unverified` instead of relying on stale memory or docs alone
  - intended for explicit audits, troubleshooting, or filtered host checks rather than mandatory startup
- `check_graphify_capability.sh`
  - checks whether Graphify is installed, whether the managed upstream checkout exists, and which installer path (`uv`, `pipx`, or local Python) is available
  - read-only by default; clones into `integrations/graphify/upstream/` only with `--download`, updates only with `--update`, and refreshes copied skill references only with `--sync-skill`
  - used by Coordinator and CodeBase Analyzer before relying on Graphify-backed repo maps
- `check_codebase_memory_capability.sh`
  - checks whether Codebase Memory MCP is installed, whether the managed upstream checkout exists, and whether the local binary under `integrations/codebase-memory-mcp/bin/` is usable
  - read-only by default; clones into `integrations/codebase-memory-mcp/upstream/` only with `--download`, updates only with `--update`, and installs the local binary only with `--install-binary`
  - used by Coordinator and CodeBase Analyzer before relying on Codebase Memory MCP-backed repo maps
- `check_graphify_freshness.py`
  - prepares reports-backed Graphify output under `<ADS_MEMORY_ROOT>/reports/graphify-out/<target-name>/`
  - prints the path to use as `GRAPHIFY_OUT` so Graphify writes directly into the reports location
  - writes and checks `.ads-graphify-status.json` beside the reports-backed graph output
  - records generation time, target git state, source mtime, Graphify version, mode, and semantic-pass approval
  - advisory by default; use `--strict` when a stale graph should fail a workflow
- `resolve_subagent_mode.sh`
  - resolves whether the current run should default to `subagent-assisted` or `single-agent` mode
  - emits startup-friendly copy that includes the token-cost tradeoff and user toggles
  - probes only the current host's `subagent_spawning` status so startup stays cheap

## Run Everything

```bash
bash harness-engineering/validators/run-all.sh
```

## Probe Current Host Capabilities

```bash
bash harness-engineering/validators/probe_host_capabilities.sh --host <detected-host>
```

Check whether live browser automation is enabled on the current host:

```bash
bash harness-engineering/validators/probe_host_capabilities.sh --host <detected-host> --capability browser_automation
```

Check whether live Supabase verification is enabled on the current host:

```bash
bash harness-engineering/validators/probe_host_capabilities.sh --host <detected-host> --capability supabase_mcp
```

Check whether Graphify is available for repo mapping:

```bash
bash harness-engineering/validators/check_graphify_capability.sh
```

Check whether Codebase Memory MCP is available for repo mapping:

```bash
bash harness-engineering/validators/check_codebase_memory_capability.sh
```

Download or update the managed Graphify checkout inside AI Dev Shop:

```bash
bash harness-engineering/validators/check_graphify_capability.sh --download
bash harness-engineering/validators/check_graphify_capability.sh --update
bash harness-engineering/validators/check_graphify_capability.sh --update --sync-skill
```

Write or check Graphify freshness metadata for a target repo:

```bash
GRAPHIFY_OUT="$(python3 harness-engineering/validators/check_graphify_freshness.py <target-repo> --prepare-output --print-output-path)" \
  graphify update <target-repo> --force
python3 harness-engineering/validators/check_graphify_freshness.py <target-repo> --write --mode code_update
python3 harness-engineering/validators/check_graphify_freshness.py <target-repo>
```

If an older run already created a non-empty `<target-repo>/graphify-out/`
directory at the target root, migrate it into the reports location first:

```bash
python3 harness-engineering/validators/check_graphify_freshness.py <target-repo> --prepare-output --migrate-existing-output
```

Resolve startup mode for the current host:

```bash
bash harness-engineering/validators/resolve_subagent_mode.sh --host <detected-host>
```

Validate a Speckit package before planning:

```bash
python3 framework/spec-providers/speckit/validators/validate_spec_package.py <spec-folder>
```

Provider-local validator:

- `framework/spec-providers/speckit/validators/validate_spec_package.py`
  - validates the strict Speckit compatibility package
  - checks required files, unresolved clarification markers, manifest integrity, traceability seeding, and DoD completion
  - intended as a targeted pre-handoff validator before `/plan`, not as a repo-wide `run-all.sh` check

Validate a seeded eval suite before using it as benchmark evidence:

```bash
python3 harness-engineering/validators/validate_eval_suite.py harness-engineering/agent-evals/<agent>-evals/<suite-id> --require-run-results --min-runs 3
```

Score a validated suite and generate the aggregate metrics report:

```bash
python3 harness-engineering/quality/scripts/score_eval_suite.py harness-engineering/agent-evals/<agent>-evals/<suite-id>
```

Score with attention-budget regression detection against a baseline:

```bash
python3 harness-engineering/quality/scripts/score_eval_suite.py harness-engineering/agent-evals/<agent>-evals/<suite-id> \
  --baseline-results <path-to-previous-run-results.tsv>
```

Validate a targeted regression pack that intentionally reruns only previously
missed or partial seeds:

```bash
python3 harness-engineering/validators/validate_eval_suite.py harness-engineering/agent-evals/<agent>-evals/<suite-id> --suite-kind targeted_regression --require-run-results --min-runs 3
```

## Error Format

Hard validators use agent-repair-friendly messages:

- `VIOLATION`: what is broken
- `FIX`: the smallest acceptable repair path
