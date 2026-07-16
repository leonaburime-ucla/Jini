# Architecture Fitness Contract

Host projects declare their architectural boundaries here so agents can enforce dependency rules and ownership without guessing.

## Host Declaration Location

`<ADS_MEMORY_ROOT>/governance/contracts/architecture-fitness.md`

## Rule Format

Each rule is a structured entry:

### Rule Entry Fields

- **Name**: short identifier (e.g., `no-ui-imports-from-data-layer`)
- **Type**: one of `dependency_direction`, `forbidden_import`, `boundary_ownership`
- **Scope**: file glob or module path defining where this rule applies (e.g., `src/data/**`, `packages/api/`)
- **Description**: what this rule prevents and why
- **Severity**: `blocking` or `advisory`
- **Rationale**: why this boundary exists (helps agents make judgment calls at edges)

Type-specific fields:

**dependency_direction** rules also declare:
- **Source**: the module/layer that should NOT import from target (glob)
- **Forbidden target**: the module/layer that must not be imported (glob)
- **Allowed alternative**: what the source should use instead (e.g., "service layer at src/services/")

**forbidden_import** rules also declare:
- **Forbidden pattern**: the import path or module that must not appear (glob or regex)
- **Applies to**: which files are checked (glob, defaults to Scope)

**boundary_ownership** rules also declare:
- **Owner**: team or role responsible for approving changes
- **Approval required**: what constitutes approval (e.g., "security review sign-off in PR", "architect ACK in handoff")

### Example Rules

**Dependency direction:**
- Name: `ui-cannot-import-data-layer`
- Type: `dependency_direction`
- Scope: `src/ui/**`
- Description: UI components must not import from `src/data/` directly; use the service layer
- Severity: blocking
- Rationale: keeps UI testable without database mocks

**Forbidden import:**
- Name: `no-internal-api-from-external`
- Type: `forbidden_import`
- Scope: `src/external-api/**`
- Description: external API handlers must not import internal-only modules from `src/internal/`
- Severity: blocking
- Rationale: internal modules may expose sensitive data structures

**Boundary ownership:**
- Name: `auth-module-ownership`
- Type: `boundary_ownership`
- Scope: `src/auth/**`
- Description: changes to auth module require security review sign-off
- Severity: blocking
- Rationale: auth changes have security implications that need human review

## Enforcement Scope

Architecture fitness rules enforce **only on files modified in the current work** by default.

- Agents do not audit the entire codebase against architecture rules on every run
- If a modified file introduces a new violation, it blocks (for blocking rules) or warns (for advisory rules)
- Pre-existing violations in untouched files are grandfathered until explicitly addressed
- Whole-project enforcement can be requested explicitly by the user or during a dedicated refactoring pass

## Validator Priority Rule

When product-facing functional checks and architecture-fitness checks conflict:

1. **Hard architecture/security rules always block.** A blocking dependency violation or security boundary breach cannot be waived by product priority alone.
2. **Advisory architecture rules yield to product-facing fixes.** If fixing a user-visible bug requires an import that violates an advisory rule, the fix proceeds and the violation is reported as a waiver with a remediation note.
3. **Product-facing validation is reported first.** In handoff summaries and code review, functional correctness findings appear before advisory architecture findings.

This rule prevents architecture purity from blocking urgent product work, while preserving hard safety boundaries.

## How Rules Flow Into Pipeline Stages

| Stage | How architecture fitness is used |
|-------|--------------------------------|
| Software Architect | ADR must acknowledge declared boundaries; new patterns must not contradict blocking rules |
| Programmer | Modified files checked against rules before handoff |
| Code Review | Reviewer checks modified files against full rule set; flags violations |
| Refactor | May address grandfathered violations as dedicated cleanup work |

## Behavior When Contract Is Missing

See [enforcement.md](enforcement.md). Summary:

- No architecture rules declared = no architecture enforcement
- Agents proceed normally; Code Review uses general best practices instead of declared rules
- Coordinator notes absence in pipeline start summary if the project has meaningful complexity

## Relationship to Static Analysis

If the host project has a static analysis tool that enforces architectural rules (e.g., eslint import rules, ArchUnit, dependency-cruiser), declare that tool in the `static_analysis` slot of the [Computational Controls Contract](computational-controls.md). The architecture-fitness contract adds semantic meaning and priority rules on top of what the tool mechanically checks.
