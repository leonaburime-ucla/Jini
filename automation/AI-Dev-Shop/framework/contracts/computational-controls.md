# Computational Controls Contract

Host projects declare their executable quality checks here so agents can run them without guessing.

## Host Declaration Location

`<ADS_MEMORY_ROOT>/governance/contracts/computational-controls.md`

## Named Command Slots

Every host project should declare as many of these as apply. Each slot is a single executable command.

### lint

- **Command**: the exact shell command to run (e.g., `npm run lint`, `ruff check .`)
- **Working directory**: project root unless specified (monorepos: specify package path)
- **Required**: yes/no — whether this slot must be filled before implementation work begins
- **Blocking**: yes/no — whether failure stops the pipeline or produces a warning
- **Timeout**: maximum seconds before the command is killed (default: 120)
- **Success criteria**: exit code 0 unless otherwise specified

### typecheck

- **Command**: e.g., `npx tsc --noEmit`, `mypy src/`
- **Working directory**: project root unless specified
- **Required**: yes/no
- **Blocking**: yes/no
- **Timeout**: default 180
- **Success criteria**: exit code 0

### build

- **Command**: e.g., `npm run build`, `cargo build --release`
- **Working directory**: project root unless specified
- **Required**: yes/no
- **Blocking**: yes (build failures always block)
- **Timeout**: default 300
- **Success criteria**: exit code 0

### unit_tests

- **Command**: e.g., `npm test`, `pytest tests/unit/`
- **Working directory**: project root unless specified
- **Required**: yes/no
- **Blocking**: yes/no
- **Timeout**: default 300
- **Success criteria**: exit code 0

### integration_tests

- **Command**: e.g., `npm run test:integration`, `pytest tests/integration/`
- **Working directory**: project root unless specified
- **Required**: yes/no
- **Blocking**: yes/no
- **Timeout**: default 600
- **Success criteria**: exit code 0
- **Environment**: note any required services (database, Redis, etc.)

### mutation_tests

- **Command**: e.g., `npx stryker run --mutate '{touched_files}'`, `mutmut run --paths-to-mutate={touched_files}`
- **Working directory**: project root unless specified
- **Required**: yes/no
- **Blocking**: conditional (default behavior is escalation; hard-blocks only on >10% score regression — full gate logic in `<AI_DEV_SHOP_ROOT>/harness-engineering/sensors/mutation-quality.md`)
- **Timeout**: default 600 (mutation testing is expensive; projects may increase)
- **Success criteria**: exit code 0 (gate behavior beyond exit code — including absolute thresholds, regression checks, and first-run baseline — is defined in `<AI_DEV_SHOP_ROOT>/harness-engineering/sensors/mutation-quality.md`)
- **Scope placeholder**: `{touched_files}` is replaced at runtime with the list of modified source files that have corresponding test files (mutating untested files produces no meaningful signal). Format per tool syntax (comma-separated glob for Stryker, space-separated for mutmut, etc.)
- **Baseline location**: `<ADS_MEMORY_ROOT>/.local-artifacts/sensors/mutation-baseline.json`
- **Notes**: triggered by TestRunner after green suite + coverage evaluation. If this slot is not declared, the mutation quality sensor is inactive (advisory note only).

### static_analysis

- **Command**: e.g., `npm run analyze`, `semgrep --config=auto`
- **Working directory**: project root unless specified
- **Required**: yes/no
- **Blocking**: yes/no
- **Timeout**: default 300
- **Success criteria**: exit code 0

## When Agents Execute These Slots

| Stage | Slots used |
|-------|-----------|
| Programmer (during implementation) | lint, typecheck, build, unit_tests |
| Programmer (before handoff) | all declared slots except mutation_tests |
| TestRunner | unit_tests, integration_tests, mutation_tests* |
| Code Review | lint, typecheck, static_analysis |

*`mutation_tests` runs conditionally after `unit_tests` and `integration_tests` pass. See TestRunner agent skills for sequencing details.

## Behavior When Contract Is Missing

See [enforcement.md](enforcement.md) for the full enforcement model. Summary:

- **Greenfield project**: Coordinator warns at pipeline start. Programmer stage is blocked until at least `build` and one test slot are declared.
- **Brownfield project**: Advisory mode. Coordinator logs that the contract is absent. Agents proceed but handoffs note that no executable controls were verified.

## Behavior When a Check Fails

- **Blocking slot fails**: the stage cannot hand off. The agent must attempt one fix cycle, then report failure.
- **Non-blocking slot fails**: the failure is reported in the handoff summary. Downstream stages are informed. Pipeline continues.

## Behavior When a Slot Is Declared but Empty

A slot declared as required but with no command means the host acknowledges the gap. The Coordinator treats this as a known gap and reports it at pipeline start. It does not block unless enforcement is set to strict.

## Working Directory Resolution

Commands run from the host project root by default — not the toolkit root.

- `<HOST_PROJECT_ROOT>` is the root of the host repository (where `.git/` lives)
- If `<AI_DEV_SHOP_ROOT>` is a subfolder install, commands still resolve against `<HOST_PROJECT_ROOT>`
- Per-slot working directory overrides are relative to `<HOST_PROJECT_ROOT>`

## Touched-Scope Enforcement for Project-Wide Commands

Many tools (linters, type checkers) check the entire project and return a single exit code. In brownfield projects with baseline failures, agents must distinguish new violations from pre-existing ones.

Resolution order:
1. **Scoped command variant** (preferred): if the tool supports file arguments, declare a `scoped_command` alongside `command`. Example: `command: npm run lint` / `scoped_command: npx eslint {files}`. Agents use the scoped variant and pass only modified files.
2. **Diff-based attribution**: if no scoped variant exists, run the command, capture output, and attribute failures to modified files only. Pre-existing failures in untouched files are ignored for enforcement purposes.
3. **Baseline fingerprint**: if output attribution is impractical, run the command once at contract creation to capture a baseline failure set. New failures beyond baseline are violations; baseline failures are grandfathered.

If none of these methods can distinguish new from baseline failures, treat the slot as **advisory** (not blocking) until a scoped command is available.

## Monorepo Support

For monorepos with multiple packages, declare slots per package scope:

- Use a separate command slot entry per package, or
- Use a root-level command that handles routing internally (e.g., `turbo run lint`)
- Specify the working directory for each slot when it differs from `<HOST_PROJECT_ROOT>`
