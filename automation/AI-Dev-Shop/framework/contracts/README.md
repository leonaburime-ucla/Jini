# Host-Project Contracts

Contracts are machine-actionable declarations that tell agents exactly what commands to run, what signals to check, and what boundaries to enforce — without guessing.

## Contract Types

| Contract | What it declares | File |
|----------|-----------------|------|
| [Computational Controls](computational-controls.md) | Lint, typecheck, build, test, and static analysis commands | Required for all implementation work |
| [Runtime Validation](runtime-validation.md) | Boot command, health signal, critical path check, teardown | Required for runtime-changing work |
| [Architecture Fitness](architecture-fitness.md) | Dependency rules, forbidden imports, ownership boundaries | Required when architecture rules exist |
| [Specs-As-Built Freshness](specs-as-built-freshness.md) | Source-to-as-built freshness metadata and validator enforcement | Required when `specs_as_built/` is treated as current-state documentation |

## Where Contracts Live

- **Framework specs** (what contracts must contain): `<AI_DEV_SHOP_ROOT>/framework/contracts/`
- **Host declarations** (project-specific values): `<ADS_MEMORY_ROOT>/governance/contracts/`

## Lifecycle

See [enforcement.md](enforcement.md) for contract states, consequences, and brownfield adoption rules.

See `<AI_DEV_SHOP_ROOT>/framework/templates/bootstrap/contracts-bootstrap.md` for step-by-step setup.

## Which Stages Consume Contracts

- **Programmer**: computational controls (all slots), runtime validation (when runtime-changing)
- **TestRunner**: computational controls (test slots)
- **Code Review**: architecture fitness, computational controls (lint, typecheck, static_analysis)
- **Architect**: architecture fitness (for ADR alignment)
- **Coordinator**: enforcement status at every stage gate
- **Reverse-Spec / Done Gate**: specs-as-built freshness when generated current-state docs are enabled
