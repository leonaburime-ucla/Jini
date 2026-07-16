# Specs-As-Built Freshness Contract

Host projects declare how generated and hybrid `specs_as_built/` artifacts stay synchronized with source code.

## Host Declaration Location

`<ADS_MEMORY_ROOT>/governance/contracts/specs-as-built-freshness.md`

## Required Fields

### artifact_root

- **Path**: default `<ADS_MEMORY_ROOT>/specs_as_built/`
- **Required**: yes when specs-as-built is enabled
- **Purpose**: curated current-state documentation root

### source_root

- **Path**: default host project root
- **Required**: yes
- **Purpose**: source tree used to resolve `source_scope` patterns

### validator

- **Command**: default `python3 <AI_DEV_SHOP_ROOT>/harness-engineering/validators/validate_specs_as_built_freshness.py`
- **Required**: yes when specs-as-built is enabled
- **Blocking**: project-defined; recommended blocking for material public behavior changes

### enforcement

One of:

- `advisory`: validator reports freshness gaps but does not block
- `touched-scope`: validator blocks only when modified source intersects declared `source_scope`
- `strict`: validator blocks any stale metadata, missing source scope, or fingerprint mismatch

### hard_blocking_change_types

Recommended defaults:

- public/exported function contract changes
- route/API/job/event/CLI behavior changes
- data model or schema changes
- validation/error behavior changes
- side effects, integrations, transaction behavior
- auth/authorization/security/privacy/compliance behavior

### advisory_change_types

Recommended defaults:

- private helper refactors
- cosmetic UI/CSS-only changes
- test-only or doc-only changes
- dependency bumps without behavior changes

## Artifact Metadata Contract

Generated and hybrid artifacts should expose metadata through markdown frontmatter or component `_meta.yaml`:

```yaml
artifact_type: specs_as_built
artifact_role: component_contracts
component_id: CMP-billing
status: generated
source_scope:
  - src/billing/**
source_fingerprint: sha256:<hash>
last_verified_at: 2026-05-24T19:43:39Z
last_verified_commit: <git-sha>
reverse_spec_run: ADS-memory/reports/reverse-spec/<run-id>/
```

## Behavior When Contract Is Missing

See [enforcement.md](enforcement.md) for the general enforcement model.

Summary:

- Greenfield projects that enable specs-as-built should declare this contract before treating `specs_as_built/` as authoritative.
- Brownfield projects may start in advisory mode while the initial baseline is being extracted.
- If no `specs_as_built/` root exists, the validator reports that freshness enforcement is not active.

## Behavior When Freshness Fails

- **Fingerprint mismatch**: source changed since the artifact was verified. In strict or touched-scope mode, this blocks material changes unless the artifact is marked `status: stale` with a waiver or follow-up.
- **Rewrite in progress**: `status: rewriting` is allowed only during an active language/runtime migration. It must include a replacement source-scope note or waiver once new-language files exist, and it must be resolved back to `generated` or `hybrid` before the rewrite is considered complete.
- **Missing source scope**: artifact cannot be mechanically checked. Advisory by default; blocking in strict mode.
- **Missing source files**: declared scope no longer resolves. Blocking in strict mode; advisory in brownfield/touched-scope mode until component boundaries are repaired.
- **Missing reverse-spec run**: advisory unless the project requires evidence links for all specs-as-built artifacts.

## Stage Gate Behavior

1. Before **Done**: Coordinator runs the validator when code changes are material to public behavior or declared component source scopes.
2. Before **Code Review**: reviewer checks whether modified files intersect `source_scope` for generated component artifacts.
3. During **reverse-spec**: extraction records raw evidence and updates `specs_as_built/` freshness metadata.
4. During **brownfield adoption**: gaps are logged as advisory until the user promotes enforcement.

## Waiver Protocol

Use `<ADS_MEMORY_ROOT>/governance/contracts/waivers.md`.

Waivers must include:

- affected component or artifact
- source files changed
- reason freshness was not updated
- owner
- expiry or follow-up date
- accepted risk
