---
name: specs-as-built
version: 1.1.0
last_updated: 2026-05-25
description: Artifact contract for curated post-implementation and brownfield as-built knowledge.
---

# Specs As Built

`specs_as_built/` is the curated current-state documentation surface generated from implemented code and reverse-spec evidence. It exists for maintainers, migration work, and LLM agents that need to understand or rebuild an existing system without rediscovering behavior directly from source every time.

It is not the provider-native forward spec surface. AI Dev Shop stores provider-native forward specs and planning artifacts under `<ADS_MEMORY_ROOT>/specs/` by default. Upstream providers may describe roots such as `<repo>/specs/<feature-id>/`, but AI Dev Shop maps durable project-owned planning output into `<ADS_MEMORY_ROOT>/specs/` unless the user explicitly chooses another durable location.

## Canonical Location

```text
<ADS_MEMORY_ROOT>/specs_as_built/
```

Raw extraction evidence stays separate:

```text
<ADS_MEMORY_ROOT>/reports/reverse-spec/<run-or-module>/
```

## Folder Contract

```text
<ADS_MEMORY_ROOT>/specs_as_built/
  README.md
  system-overview.md
  architecture.md
  dependency-graph.yaml
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
    <spec-id-or-run-id>-impact.md

  _meta/
    generation-manifest.yaml
    freshness-policy.md
```

### Root Files

- `README.md`: starting point for humans and agents; explains how to navigate this folder.
- `system-overview.md`: current system purpose, major runtime flows, and bounded context summary.
- `architecture.md`: current architecture, dependency shape, storage, integration, and operational assumptions.
- `dependency-graph.yaml`: machine-readable component dependency graph for rebuild order, integration topology, event channels, shared stores, and external systems.
- `global-ubiquitous-language.md`: cross-component vocabulary and business terms.

Root files must not own detailed component contracts. They summarize and route.

### `components/`

Components are the canonical owners of current implementation truth. A component is a stable business/technical boundary such as `billing`, `auth`, or `search-indexing`.

Component folders own:

- public API and entrypoint contracts
- data and state contracts
- error behavior
- side effects and integrations
- meaningful function contracts
- component-specific migration guidance
- links to tests, requirements, and reverse-spec evidence
- freshness metadata

Component contracts must use stable, language-agnostic IDs as the primary keys for traceability. Source-language symbol names are attributes, not identifiers. Recommended prefixes:

- `CMP-<component>` for components
- `API-<component>-<slug>` for public entrypoints
- `DATA-<component>-<slug>` for data contracts
- `ERR-<component>-<slug>` for error contracts
- `EFFECT-<component>-<slug>` for side effects
- `FUNC-<component>-<slug-or-nnn>` for functions

Stable IDs let changelog entries, tests, and migration notes survive renames during Ruby-to-Python, Ruby-to-Go, Ruby-to-Rust, or similar rewrites.

Component folders must not own historical spec deltas. Use `changelog/` for those.

### Component Contract YAML Schemas

Each YAML file under `components/<component>/contracts/` should use these top-level shapes. Fields may be extended, but generators and curators should preserve the required keys.

#### `api.yaml`

```yaml
component_id: CMP-billing
endpoints:
  - id: API-billing-create-invoice
    source_name: InvoicesController#create
    method: POST
    path: /invoices
    auth: required
    request: <schema or reference>
    response: <schema or reference>
    errors:
      - ERR-billing-invalid-customer
    side_effects:
      - EFFECT-billing-enqueue-invoice-email
```

#### `data.yaml`

```yaml
component_id: CMP-billing
models:
  - id: DATA-billing-invoice
    source_name: Invoice
    fields:
      - name: total_cents
        type: integer
        required: true
        constraints:
          - non_negative
relationships:
  - from: DATA-billing-invoice
    to: DATA-billing-customer
    cardinality: many_to_one
```

#### `errors.yaml`

```yaml
component_id: CMP-billing
errors:
  - id: ERR-billing-invalid-customer
    source_name: InvalidCustomerError
    condition: customer does not exist or is not billable
    status: 422
    message_pattern: <user-visible or API-visible pattern>
    recovery: caller must choose a valid billable customer
```

#### `side-effects.yaml`

```yaml
component_id: CMP-billing
effects:
  - id: EFFECT-billing-enqueue-invoice-email
    trigger: API-billing-create-invoice
    target: invoice-email queue
    payload: <schema or reference>
    idempotency: <key or strategy>
    failure_behavior: retry with backoff; does not roll back invoice creation
```

#### `functions.yaml`

```yaml
component_id: CMP-billing
functions:
  - id: FUNC-billing-calculate-total
    source_name: Billing::Totals.calculate
    visibility: public
    responsibility: compute invoice total from line items and discounts
    inputs:
      - name: line_items
        type: array<line_item>
        validation: non_empty
    output:
      type: money
      validation: non_negative
    errors:
      - ERR-billing-invalid-discount
    side_effects: []
    preconditions:
      - all line items use the same currency
    postconditions:
      - output equals subtotal minus valid discounts plus tax
```

### Component `_meta.yaml` Required Fields

Every generated or hybrid component folder must include `_meta.yaml`:

```yaml
artifact_type: specs_as_built
artifact_role: component_contracts
component_id: CMP-billing
status: generated
source_scope:
  - src/billing/**
source_fingerprint: sha256:<hash>
last_verified_at: 2026-05-25T03:15:27Z
last_verified_commit: <git-sha>
reverse_spec_run: ADS-memory/reports/reverse-spec/<run-id>/
```

Allowed `status` values:

- `generated`: produced directly from reverse-spec extraction
- `hybrid`: generated output curated by a human or agent
- `stale`: source has changed and the artifact is knowingly out of date under a waiver/follow-up
- `rewriting`: source is actively moving to a new language/runtime and `source_scope` must be updated as replacement code lands

Optional fields: `owner`, `stale_waiver_link`, `stale_follow_up_date`, `rewrite_target_language`, `replacement_component_id`, and `notes`.

### Global Dependency Graph

`dependency-graph.yaml` is the machine-readable topology used to order rewrites and verify integration preservation. Minimum shape:

```yaml
version: 1
components:
  - id: CMP-billing
    path: components/billing/
dependencies:
  - from: CMP-billing
    to: CMP-auth
    type: authz_check
    via: API-auth-current-user
    criticality: high
external_systems:
  - id: EXT-stripe
    used_by:
      - CMP-billing
```

### `changelog/`

`changelog/<spec-id-or-run-id>-impact.md` records immutable historical impact:

- which spec/change introduced or modified behavior
- which components were touched
- material drift from original intent
- links to current component docs
- links to raw reverse-spec evidence

Changelog entries are append-only history. They must not claim to be current system truth after later changes modify the same component.

### `_meta/`

`_meta/generation-manifest.yaml` records generator versions, run IDs, and artifact provenance.

`_meta/freshness-policy.md` records which source changes are hard-blocking, advisory, or waived for freshness enforcement.

## Forward Spec Bridge

Provider-native feature folders may include a thin bridge file:

```text
<ADS_MEMORY_ROOT>/specs/<feature-id>/as-built-impact.md
```

This file links to:

- `<ADS_MEMORY_ROOT>/specs_as_built/changelog/<feature-id>-impact.md`
- affected component folders
- relevant raw reverse-spec report(s)

It must not duplicate component contracts or become another source of implementation truth.

## Generation Workflow

### Brownfield

1. Run reverse-spec extraction on bounded code scopes.
2. Save raw evidence to `<ADS_MEMORY_ROOT>/reports/reverse-spec/<run-or-module>/`.
3. Curate the extracted evidence into `specs_as_built/components/`.
4. Populate root overview, architecture, and migration notes.
5. Record source scope and freshness metadata for every generated or hybrid component artifact.
6. Create forward specs only for future changes or rewrite waves.

### Greenfield

1. Create the provider-native forward spec.
2. Implement and verify the feature.
3. Run reverse-spec on the changed scope after code exists.
4. Save raw evidence to `reports/reverse-spec/`.
5. Update `specs_as_built/components/`.
6. Add a changelog impact entry.
7. Add or update the provider-native `as-built-impact.md` bridge file.
8. Run the specs-as-built freshness validator.

## Freshness Metadata

Generated and hybrid artifacts should include frontmatter or component `_meta.yaml` with:

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

Use `status: stale` only as an explicit temporary marker when the project accepts a known freshness gap. Stale markers should link to an owner and follow-up date in the relevant drift or waiver record.

Use `status: rewriting` during cross-language migration when the source scope is intentionally moving. A rewriting artifact must name the replacement source scope in notes or metadata as soon as the new-language files exist. Before the rewrite is marked done, update `source_scope`, recompute `source_fingerprint`, and return status to `generated` or `hybrid`.

## Component Removal

When a component's entire source scope is deleted, renamed, or merged into another component, do not leave a zombie component folder with unresolvable `source_scope`. Record the removal or merge in `specs_as_built/changelog/<component-or-run-id>-removed-impact.md`, link to the replacement component when one exists, and remove or archive the stale component folder as part of the same reverse-spec/update run.

## Enforcement

Freshness is enforced by:

```text
harness-engineering/validators/validate_specs_as_built_freshness.py
```

Hard-blocking changes:

- public or exported function contract changes
- route, API, job, event, or CLI behavior changes
- data model or schema changes
- validation or error behavior changes
- side effects, integrations, or transaction behavior changes
- auth, authorization, security, privacy, or compliance behavior changes

Advisory changes:

- private helper refactors that do not change behavior
- cosmetic UI/CSS-only changes
- test-only or doc-only changes
- dependency bumps with no behavior change

Waivers follow the host-project contract waiver protocol in `<ADS_MEMORY_ROOT>/governance/contracts/waivers.md`.
