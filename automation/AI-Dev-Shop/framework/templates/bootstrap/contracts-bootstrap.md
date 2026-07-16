# Contracts Bootstrap Guide

Step-by-step guide for setting up host-project contracts. Works for both new projects and existing codebases adopting AI Dev Shop.

## Prerequisites

- AI Dev Shop toolkit is installed in the repo
- `<ADS_MEMORY_ROOT>/governance/` directory exists (created during workspace bootstrap)

## Quick Start

Create the contracts directory:

```bash
mkdir -p <ADS_MEMORY_ROOT>/governance/contracts/
```

Then follow the path that matches your situation:

---

## Greenfield Path (New Project)

For new projects, set up all contracts before the first Programmer dispatch.

### Step 1: Computational Controls

Create `<ADS_MEMORY_ROOT>/governance/contracts/computational-controls.md`:

```markdown
# Computational Controls

## lint
- Command: <your lint command>
- Required: yes
- Blocking: yes

## typecheck
- Command: <your typecheck command, or "N/A — dynamically typed">
- Required: <yes/no>
- Blocking: <yes/no>

## build
- Command: <your build command>
- Required: yes
- Blocking: yes

## unit_tests
- Command: <your unit test command>
- Required: yes
- Blocking: yes

## integration_tests
- Command: <your integration test command, or "not yet available">
- Required: no
- Blocking: no

## static_analysis
- Command: <your analysis tool, or "none">
- Required: no
- Blocking: no
```

At minimum, fill in `build` and one test slot. Leave others as documented gaps if not ready yet.

### Step 2: Runtime Validation

Create `<ADS_MEMORY_ROOT>/governance/contracts/runtime-validation.md`:

```markdown
# Runtime Validation

## boot_command
- Command: <how to start the app>
- Working directory: <project root or specific path>
- Timeout: 60

## healthy_signal
- Signal type: <stdout_match | http_status | port_open | file_exists>
- Value: <what to look for>

## critical_path_check
- Description: <what this verifies>
- Method: <curl command, browser action, or script>
- Expected result: <what success looks like>

## negative_path_check
- Description: <what failure case this covers>
- Method: <how to trigger it>
- Expected result: <correct error handling behavior>

## artifact_capture_path
- Path: <ADS_MEMORY_ROOT>/reports/self-validation/artifacts/

## teardown_command
- Command: <how to stop the service>

## env_requirements
- Variables: <required env vars, or "none">
- Services: <required running services, or "none">
- Setup command: <one-time setup, or "none">
```

### Step 3: Architecture Fitness (when needed)

Create `<ADS_MEMORY_ROOT>/governance/contracts/architecture-fitness.md` when your project has meaningful architectural boundaries:

```markdown
# Architecture Fitness Rules

## <rule-name>
- Type: <dependency_direction | forbidden_import | boundary_ownership>
- Scope: <file glob>
- Description: <what this prevents>
- Severity: <blocking | advisory>
- Rationale: <why this boundary exists>
```

This contract is optional at project start. Add it when complexity warrants boundary enforcement.

### Step 4: Specs-As-Built Freshness (when enabled)

Create `<ADS_MEMORY_ROOT>/governance/contracts/specs-as-built-freshness.md` when the project treats `specs_as_built/` as current-state implementation documentation:

```markdown
# Specs-As-Built Freshness

- Enforcement: advisory
- Artifact root: <ADS_MEMORY_ROOT>/specs_as_built/
- Source root: <HOST_PROJECT_ROOT>
- Validator: python3 <AI_DEV_SHOP_ROOT>/harness-engineering/validators/validate_specs_as_built_freshness.py

## Hard Blocking Change Types

- public/exported function contract changes
- route/API/job/event/CLI behavior changes
- data model or schema changes
- validation/error behavior changes
- side effects, integrations, transaction behavior
- auth/authorization/security/privacy/compliance behavior

## Advisory Change Types

- private helper refactors
- cosmetic UI/CSS-only changes
- test-only or doc-only changes
- dependency bumps without behavior changes

## Notes

During a cross-language rewrite, component artifacts may temporarily use `status: rewriting` while `source_scope` moves to replacement files. Resolve rewriting status back to `generated` or `hybrid` before the rewrite is marked complete.
```

Start with `advisory` for brownfield extraction. Promote to `touched-scope` or `strict` after component metadata has reliable `source_scope` and `source_fingerprint` values.

### Step 5: Waivers

Create `<ADS_MEMORY_ROOT>/governance/contracts/waivers.md` for human-approved temporary exceptions:

```markdown
# Contract Waivers

| Date | Reviewer | Contract | Scope | Reason | Expiration / Revisit |
|---|---|---|---|---|---|
| | | | | | |
```

---

## Brownfield Path (Existing Project)

For existing projects, adopt contracts incrementally without blocking all current work.

### Phase 1: Inventory (no enforcement)

1. Run your existing quality commands manually and note them
2. Identify what exists: linter? type checker? test suite? build script?
3. Note known gaps — commands that should exist but don't yet

### Phase 2: Declare Computational Controls

Create `computational-controls.md` with what you have. For commands that don't exist yet, declare them as gaps:

```markdown
## typecheck
- Command: (gap — no type checker configured yet)
- Required: no
- Blocking: no
```

Once declared, touched-scope enforcement begins: modified files must pass declared blocking checks, but pre-existing failures in untouched code are grandfathered.

### Phase 3: Declare Runtime Validation (when you first touch runtime)

Don't create this contract until you have runtime-changing work. When you do, fill in what you know. Unknown fields can start empty — agents will report PARTIAL instead of PASS.

### Phase 4: Declare Architecture Fitness (when you want boundary enforcement)

Only add this when:
- You've identified repeated architectural violations worth preventing
- You have clear module boundaries worth protecting
- The team agrees on dependency direction rules

### Phase 5: Promote to Strict (optional)

When the team is confident in contract completeness, add to any contract header:

```markdown
- Enforcement: strict
```

This moves from touched-scope enforcement to full enforcement — all declared blocking checks apply regardless of which files were modified.

---

## Discovery Checklist

Use this to identify what your project already has:

- [ ] Package manager scripts (`package.json scripts`, `Makefile`, `pyproject.toml`)
- [ ] CI pipeline config (`.github/workflows/`, `.gitlab-ci.yml`) — what does CI already run?
- [ ] Existing lint config (`.eslintrc`, `ruff.toml`, `.golangci.yml`)
- [ ] Existing type check config (`tsconfig.json`, `mypy.ini`)
- [ ] Test runner config (`jest.config`, `pytest.ini`, `vitest.config`)
- [ ] Docker/compose files (for boot commands)
- [ ] Health check endpoints (for healthy signal)
- [ ] README run instructions (often contains the boot command)

---

## What Not To Do

- Do not invent commands that don't exist yet — declare gaps honestly
- Do not copy CI commands blindly — some CI commands require CI-only infrastructure
- Do not declare architecture rules for boundaries the team hasn't agreed on
- Do not set blocking enforcement on checks that currently fail — fix first or grandfather
