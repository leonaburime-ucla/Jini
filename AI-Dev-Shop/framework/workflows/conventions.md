---
name: conventions
version: 1.4.0
last_updated: 2026-05-24
description: Output root, spec folder structure, and reports folder structure for all pipeline artifacts.
---

# Conventions

## Output Root

`<AI_DEV_SHOP_ROOT>` means the path to this toolkit folder (usually `AI-Dev-Shop/`).
`<ADS_MEMORY_ROOT>` means the sibling project-owned workspace folder where AI Dev Shop writes durable project state (default: `ADS-memory/` next to the toolkit folder inside the host repo).
Resolve the active planning provider from `<AI_DEV_SHOP_ROOT>/framework/spec-providers/active-provider.md` before assuming planning filenames or folder structure.
Provider-native forward specs and planning artifacts are written under `<ADS_MEMORY_ROOT>/specs/` by default so project planning state stays durable with the host project and outside the updateable toolkit. Use another durable project-owned location only when the user explicitly asks for that override. Pipeline artifacts retained by AI Dev Shop core (ADR, research, tasks, test-certification, red-team findings, pipeline state) are written under `<ADS_MEMORY_ROOT>/reports/pipeline/<NNN>-<feature-name>/`. Reports (analysis, test runs, code review, security, observer, consensus, external audit) live in `<ADS_MEMORY_ROOT>/reports/` subfolders.
For long-running or resumable work, use a `progress-ledger.md` in the appropriate reports folder per `<AI_DEV_SHOP_ROOT>/harness-engineering/runtime/session-continuity.md`.
For large raw outputs, logs, or traces, use offload files per `<AI_DEV_SHOP_ROOT>/harness-engineering/runtime/context-offloading.md`.
For runtime-changing work that needs app-level validation before handoff, use a self-validation report per `<AI_DEV_SHOP_ROOT>/harness-engineering/runtime/self-validation.md`.
For work that requires an independent evaluator loop, use retained evaluator artifacts per `<AI_DEV_SHOP_ROOT>/harness-engineering/quality/evaluation-loops.md`.
Use `<ADS_MEMORY_ROOT>/.local-artifacts/` for ignored local-only scratch artifacts such as exploratory consensus runs, raw peer stdout/stderr captures, temporary prompts, and host-specific smoke-test baselines that are not meant to ship with the repo.
Promote artifacts from `<ADS_MEMORY_ROOT>/.local-artifacts/` into `<ADS_MEMORY_ROOT>/reports/` only when the user explicitly wants them retained as reusable project evidence.
Use `<ADS_MEMORY_ROOT>/specs_as_built/` for curated current-state implementation knowledge produced from reverse-spec or post-implementation capture. Raw extraction evidence stays under `<ADS_MEMORY_ROOT>/reports/reverse-spec/`; provider-native forward specs stay under `<ADS_MEMORY_ROOT>/specs/`.
Use `<ADS_MEMORY_ROOT>/knowledge/` for durable project conventions, learnings, notes, and structured memory entries.
Use `<ADS_MEMORY_ROOT>/governance/constitution.md` as the live constitution for the host project. Keep the toolkit's bootstrap default in `<AI_DEV_SHOP_ROOT>/framework/templates/bootstrap/constitution-template.md`.

**Project-owned writable root:** `<ADS_MEMORY_ROOT>/specs/`, `<ADS_MEMORY_ROOT>/reports/`, `<ADS_MEMORY_ROOT>/specs_as_built/`, `<ADS_MEMORY_ROOT>/knowledge/`, `<ADS_MEMORY_ROOT>/governance/`, `<ADS_MEMORY_ROOT>/meta/`, `<ADS_MEMORY_ROOT>/tmp/`, `<ADS_MEMORY_ROOT>/.local-artifacts/`
**Read-only during normal feature work under `<AI_DEV_SHOP_ROOT>`:** `agents/`, `skills/`, `framework/`, `harness-engineering/`, and the repo-local `project-knowledge-template/` template. If the user explicitly asks to maintain or upgrade the toolkit itself, treat that as framework maintainer work and allow edits in these directories.

---

## Artifact Intent Policy

Before writing any new artifact, classify it into one of these buckets:

1. **Pipeline-required**
   - Examples: ADRs, `tasks.md`, `test-certification.md`, red-team findings, `pipeline-state.md`, required codebase-analysis outputs
   - Behavior: save automatically to `<ADS_MEMORY_ROOT>/reports/` in the canonical path defined by the workflow
2. **Optional retained**
   - Examples: exploratory research summaries, consensus reports, architecture comparisons, reusable context packets, host compatibility baselines
   - Behavior: if the user has not already said to save it, ask whether to retain it in `<ADS_MEMORY_ROOT>/reports/`, keep it `local only`, or return it `inline only`
3. **Local scratch / raw evidence**
   - Examples: temporary prompts, raw stdout/stderr captures, ad hoc smoke tests, one-off logs, intermediate notes
   - Behavior: save to `<ADS_MEMORY_ROOT>/.local-artifacts/` by default unless the user explicitly wants it promoted into `<ADS_MEMORY_ROOT>/reports/`

Rule of thumb:
- `<ADS_MEMORY_ROOT>/reports/` is for canonical retained artifacts the project may rely on later
- `<ADS_MEMORY_ROOT>/.local-artifacts/` is for personal iteration output and disposable session evidence
- Do not ask permission before writing pipeline-required artifacts that the framework depends on

---

## Host-Project Contracts

Host projects declare executable quality contracts that agents consume at each pipeline stage. These are machine-actionable declarations — not guidelines.

**Framework specs** (what contracts must contain): `<AI_DEV_SHOP_ROOT>/framework/contracts/`
**Host declarations** (project-specific values): `<ADS_MEMORY_ROOT>/governance/contracts/`

| Contract | Host file | Purpose |
|----------|-----------|---------|
| Computational Controls | `governance/contracts/computational-controls.md` | Lint, typecheck, build, test commands |
| Runtime Validation | `governance/contracts/runtime-validation.md` | Boot, health, critical path, teardown |
| Architecture Fitness | `governance/contracts/architecture-fitness.md` | Dependency rules, forbidden imports, boundaries |
| Specs-As-Built Freshness | `governance/contracts/specs-as-built-freshness.md` | Source-scope freshness for generated current-state docs |

Enforcement behavior (missing/failing/stale contracts) is defined in `<AI_DEV_SHOP_ROOT>/framework/contracts/enforcement.md`.

Bootstrap guide for new and existing projects: `<AI_DEV_SHOP_ROOT>/framework/templates/bootstrap/contracts-bootstrap.md`.

---

## Planning Surface Convention

Planning artifacts live under `<ADS_MEMORY_ROOT>/specs/` by default. The exact file set and provider-local substructure come from the active provider profile. Upstream providers may document roots such as `<repo>/specs/`, `openspec/`, or `_bmad-output/`; AI Dev Shop maps project-owned planning output into `<ADS_MEMORY_ROOT>/specs/` unless the user explicitly chooses another durable location.

Required provider-recorded paths:
- `spec_provider`
- `provider_native_root`
- `provider_output_root`
- `spec_entrypoint_path`
- `spec_readiness_artifact`

Optional but recommended:
- `spec_support_paths`

### Default Speckit Example

```
<ADS_MEMORY_ROOT>/specs/<NNN>-<feature-name>/
  feature.spec.md          (canonical spec — use framework/spec-providers/speckit/templates/spec-system/feature.spec.md)
  api.spec.md              (typed API contracts — if applicable)
  state.spec.md            (state shapes and transitions — if applicable)
  orchestrator.spec.md     (orchestrator output model — if applicable)
  ui.spec.md               (UI component contracts — if applicable)
  errors.spec.md           (error code registry — if applicable)
  behavior.spec.md         (deterministic behavior rules — if applicable)
  traceability.spec.md     (REQ-to-function-to-test matrix)
  spec-manifest.md         (lists actual filenames, omitted files, and naming choice)
  spec-dod.md              (DoD checklist — must pass before Software Architect dispatch)
```

## Specs-As-Built Convention

Curated post-implementation and brownfield current-state documentation lives under `<ADS_MEMORY_ROOT>/specs_as_built/`. This is the rebuild/migration reading surface and should be generated from code plus reverse-spec evidence.

```
<ADS_MEMORY_ROOT>/specs_as_built/
  README.md
  system-overview.md
  architecture.md
  global-ubiquitous-language.md
  components/
    <component>/
      README.md
      contracts/
        api.yaml
        data.yaml
        errors.yaml
        side-effects.yaml
        functions.yaml
      migration-guide.md
      traceability.md
      _meta.yaml
  changelog/
    <spec-id>-impact.md
  _meta/
    generation-manifest.yaml
    freshness-policy.md
```

Rules:
- `components/` owns current implementation truth.
- `changelog/` owns immutable historical impact records for specs or reverse-spec slices.
- provider-native feature folders under `<ADS_MEMORY_ROOT>/specs/` may contain a thin `as-built-impact.md` bridge that links to `specs_as_built/`; it must not duplicate component contracts.
- raw reverse-spec evidence stays under `<ADS_MEMORY_ROOT>/reports/reverse-spec/`.
- generated and hybrid artifacts should record source-scope freshness metadata per `<AI_DEV_SHOP_ROOT>/framework/contracts/specs-as-built-freshness.md`.

## Pipeline Artifact Folder Convention

All pipeline artifacts for a feature live under `<ADS_MEMORY_ROOT>/reports/pipeline/`:

```
<ADS_MEMORY_ROOT>/reports/pipeline/<NNN>-<feature-name>/
  pipeline-state.md       (Coordinator state — created at spec time, updated every stage; legacy runs may still have `.pipeline-state.md`)
  progress-ledger.md       (human/agent-readable resume ledger for long-running work)
  evaluator-contract-<slug>.md   (required when evaluator_mode is required for this feature run)
  evaluator-report-<slug>-<YYYY-MM-DD-HHmm>.md   (retained evaluator findings when kept as evidence)
  offloads/                (optional raw logs, traces, JSON blobs, large diffs for this feature)
  adr.md                   (architecture decision record)
  research.md              (if produced by Software Architect)
  tasks.md                 (generated by Coordinator after ADR approval)
  test-certification.md    (generated by TDD Agent)
  red-team-findings.md     (generated by Red-Team Agent — audit trail)
```

`<NNN>` is a zero-padded three-digit FEAT number (001, 002, ...). `<feature-name>` is 2–4 words, lowercase-hyphenated. Example: `ADS-memory/reports/pipeline/003-csv-invoice-export/`. Scan existing `<ADS_MEMORY_ROOT>/reports/pipeline/` folders for the next available number — never reuse. The pipeline state should record the provider, the provider-native spec entrypoint, and the readiness artifact for the run. Existing `spec_path` fields remain valid compatibility fields for the default Speckit provider.

---

## Local Scratch Artifact Convention

Use `<ADS_MEMORY_ROOT>/.local-artifacts/` for local-only, ignored outputs that help the current session but are not canonical repo artifacts.

```text
<ADS_MEMORY_ROOT>/.local-artifacts/
  swarm-consensus/
    prompts/
    context/
    runs/
    offloads/
    smoke-tests/
  external-audit/
    packets/
    runs/
    offloads/
```

**Rules:**
- `<ADS_MEMORY_ROOT>/.local-artifacts/` should be gitignored and is safe for personal iteration outputs once the workspace `.gitignore` template is applied.
- Use it by default for ad hoc consensus runs, temporary context packets, raw CLI captures, and smoke-test artifacts.
- If a debate, context packet, or smoke-test result becomes worth keeping for future project use, copy or rewrite the final retained artifact into `<ADS_MEMORY_ROOT>/reports/`.
- Optional reports outside swarm consensus follow the same rule: local by default unless the user explicitly retains them.

---

## Reports Folder Convention

All agent reports live under a single centralized folder in the sibling project workspace. This is the single source of truth for retained artifacts outside of spec files.

```
<ADS_MEMORY_ROOT>/reports/
  pipeline/
    <NNN>-<feature-name>/    (per-feature — see Pipeline Artifact Folder Convention above)
  codebase-analysis/
    ANALYSIS-<id>-<YYYY-MM-DD>.md     (CodeBase Analyzer — findings report)
    MIGRATION-<id>-<YYYY-MM-DD>.md    (CodeBase Analyzer — migration plan, if requested)
  test-runs/
    TESTRUN-<feature-id>-<YYYY-MM-DD-HHmm>.md  (TestRunner — one file per run, never overwritten)
  security/
    SEC-<feature-id>-<YYYY-MM-DD>.md  (Security Agent — threat findings)
  code-review/
    CR-<feature-id>-<YYYY-MM-DD>.md   (Code Review Agent — findings)
  observer/
    timeline-CYCLE-<NNN>.md           (Observer — per-cycle timeline log)
    pattern-report-<YYYY-WNN>.md      (Observer — weekly pattern report)
  swarm-consensus/
    smoke-tests/
      <timestamp>-cli-smoke-test.md   (user-approved retained host capability baseline)
    context/
      CTX-<slug>-<YYYY-MM-DD>.md      (user-approved shared packet used by all consensus participants)
    runs/
      <timestamp>-consensus-report.md (user-approved templated consensus report)
  external-audit/
    packets/
      <timestamp>-audit-packet.md     (optional retained packet summarizing the work given to the external auditor)
    runs/
      <timestamp>-external-audit-report.md  (user-approved external audit report with Coordinator synthesis)
  continuity/
    <workstream>/progress-ledger.md   (non-feature resumable work such as toolkit maintenance)
    <workstream>/evaluator-contract-<slug>.md   (non-feature retained evaluator contract)
    <workstream>/evaluator-report-<slug>-<YYYY-MM-DD-HHmm>.md   (non-feature retained evaluator report)
  offloads/
    <workstream>/<timestamp>-<slug>.md  (large logs, diffs, traces, JSON blobs)
  self-validation/
    SV-<feature-or-workstream>-<YYYY-MM-DD-HHmm>.md  (runtime validation report)
  maintenance/
    harness-maintenance.md            (generated cleanup/health report)
    harness-load-bearing-<YYYY-MM-DD>.md  (retained load-bearing harness audit)
```

**Rules:**
- `<ADS_MEMORY_ROOT>/reports/` is for retained project artifacts, not disposable session scratch
- All agents write retained reports here — do not scatter canonical report files elsewhere
- Test run reports are timestamped and never overwritten — each run is a separate audit artifact
- The Programmer reads test state by running tests fresh, not by reading reports — reports are audit trail only
- Provider-native forward specs and planning artifacts live under `<ADS_MEMORY_ROOT>/specs/`, outside `<ADS_MEMORY_ROOT>/reports/`, unless the user explicitly chooses another durable project-owned location
- Pipeline artifacts (adr.md, tasks.md, test-certification.md, red-team-findings.md) live in `<ADS_MEMORY_ROOT>/reports/pipeline/<NNN>-<feature-name>/`, not scattered elsewhere
