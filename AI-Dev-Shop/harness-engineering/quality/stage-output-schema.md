# Stage-Output Schema Enforcement

Defines machine-validated output contracts for multi-stage handoffs in downstream harnesses. Applies to specialized business workflows (compliance, legal, financial) where stage outputs must be verifiable without human inspection of prose.

## Relationship to Pipeline State

The code pipeline uses `framework/workflows/pipeline-state-format.md` with artifact paths and hashes per completed stage. This doc extends that pattern to domain-specific downstream harnesses where:

- stages are not code pipeline stages but domain processing phases
- outputs may be structured data, not markdown artifacts
- validation must be automated, not human-eyeballed

## Schema Contract Model

Every stage in a downstream harness declares its output schema. The schema is a machine-readable block embedded in or adjacent to the stage output artifact.

### Required Common Fields

Every stage output must include:

```yaml
schema_version: "1.0"
stage_id: <unique stage identifier>
stage_type: <classification from stage-type registry>
harness_id: <downstream harness identifier>
run_id: <matches parent harness run>
produced_at: <ISO-8601 UTC>
produced_by: <agent or system that produced this output>
input_hash: <sha256 of inputs consumed>
output_hash: <sha256 of this output's content payload>
status: COMPLETE | PARTIAL | FAILED
```

### Stage-Type Overlays

Each `stage_type` declares additional required fields beyond the common set. Examples:

| Stage Type | Additional Required Fields |
|-----------|---------------------------|
| `clause_review` | `clauses_reviewed`, `findings[]`, `playbook_version`, `compliance_status` |
| `fact_check` | `claims_checked`, `sources_cited[]`, `confidence_scores[]`, `unverified_claims[]` |
| `financial_validation` | `records_processed`, `rules_applied[]`, `exceptions[]`, `reconciliation_status` |
| `legal_risk_assessment` | `risk_items[]`, `severity_distribution`, `recommended_actions[]`, `review_scope` |

Downstream harness authors define their own stage-type overlays. Each overlay must be declared before the harness runs — not invented at runtime.

### Machine-Readable Block Format

Stage outputs must include a YAML or JSON frontmatter block (not prose headings). Acceptable formats:

1. YAML frontmatter at top of markdown artifact (between `---` fences)
2. Standalone `.json` or `.yaml` sidecar file named `<stage_id>-output.json`
3. Embedded JSON block in markdown with `<!-- STAGE_OUTPUT_SCHEMA -->` comment marker

Prose-only stage outputs without a machine-readable block are non-compliant.

## Validation Rules

### Validation Modes

| Mode | Behavior |
|------|----------|
| `strict` | All required fields present, types correct, values non-empty. Missing or malformed = FAIL. |
| `lenient` | Required fields checked for presence only. Type mismatches logged as warnings, not failures. |

Default mode: `strict` for production runs, `lenient` for development/testing.

### Validation Timing

- Validate immediately after stage completion, before the next stage consumes the output
- A stage must not begin if its declared input schema does not match the preceding stage's validated output schema
- Validation results are appended to the harness trace log

### Type Enforcement

- Timestamps: ISO-8601 UTC
- Hashes: lowercase hex, 64 characters (sha256)
- Arrays: non-null, may be empty when explicitly allowed by overlay
- Status enums: exact string match from declared set
- Counts: non-negative integers

## Failure Behavior

When validation fails:

1. **Log the failure** as a trace event: `event: SCHEMA_VALIDATION_FAILED`, `status: FAILED`, with field-level error details
2. **Block the next stage** from consuming invalid output
3. **Classify the failure:**
   - `missing_required_field` — field absent entirely
   - `type_mismatch` — field present but wrong type
   - `value_constraint_violated` — field present, correct type, but violates a declared constraint (e.g., negative count)
   - `schema_version_mismatch` — output declares a schema version the consuming stage does not support
4. **Route to recovery:**
   - If retry budget allows: re-dispatch the producing stage
   - If retry budget exhausted: escalate to human with the validation error details
   - Never silently skip or patch invalid output

## Schema Versioning

- Schema versions use semver: `MAJOR.MINOR`
- MAJOR bump: breaking change (field removed, type changed, new required field)
- MINOR bump: additive change (new optional field, relaxed constraint)
- A consuming stage declares which schema versions it accepts (e.g., `accepts: ["1.0", "1.1"]`)
- Version mismatch is a validation failure, not silent degradation

## Integration with Trace Schema

Schema validation events map to `framework/workflows/trace-schema.md` as:

```yaml
event: SCHEMA_VALIDATION_FAILED | SCHEMA_VALIDATION_PASSED
stage: <producing stage>
errors: [<field-level error messages>]
tags: [schema-validation, <harness_id>]
```

## Non-Goals

- This doc does not define specific domain schemas — those belong to each downstream harness's own configuration
- This doc does not implement validators — it defines what validators must enforce
- This doc does not replace `pipeline-state-format.md` for the code pipeline — it extends the pattern to domain harnesses

## References

- `framework/workflows/pipeline-state-format.md`
- `framework/workflows/trace-schema.md`
- `framework/workflows/job-lifecycle.md`
- `harness-engineering/quality/phase-checkpoint-template.md`
