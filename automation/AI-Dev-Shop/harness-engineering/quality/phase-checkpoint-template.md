# Phase-Checkpoint Template

Reusable checkpoint artifact format for long-running downstream harnesses. Enables restart from phase N instead of re-running from scratch.

## When This Applies

Use this template when building harnesses for:

- Multi-day compliance reviews
- Legal clause analysis pipelines
- Financial audit and reconciliation workflows
- Multi-phase document processing
- Any domain harness where a full re-run costs more than 30 minutes of compute or human time

## When Checkpoints Are Mandatory

A checkpoint must be written:

- After every phase that produces a durable output artifact
- Before any phase that requires human approval to continue
- Before any phase that calls an external paid service
- At any phase boundary where the next phase's inputs cannot be reconstructed cheaply from source

Checkpoints are optional for:

- Sub-second phases with trivial outputs
- Phases whose outputs are fully deterministic from their inputs (can be recomputed cheaply)

## Checkpoint Artifact Format

```yaml
---
checkpoint_version: "1.0"
harness_id: <downstream harness identifier>
run_id: <matches parent harness run>
phase_id: <unique phase identifier within this harness>
phase_sequence: <integer, 1-indexed position in the phase chain>
phase_name: <human-readable phase name>
produced_at: <ISO-8601 UTC>
produced_by: <agent or system>
---

## Inputs Consumed

- input_artifacts:
  - path: <artifact path>
    hash: <sha256>
  - path: <artifact path>
    hash: <sha256>
- parameters:
  - <key>: <value>
- prior_checkpoint: <path to previous phase checkpoint, or "none" for phase 1>

## Outputs Produced

- output_artifacts:
  - path: <artifact path>
    hash: <sha256>
    sensitivity: <public | internal | restricted>
  - path: <artifact path>
    hash: <sha256>
    sensitivity: <public | internal | restricted>

## State Snapshot

- decisions_made:
  - <decision ID>: <outcome>
- intermediate_state:
  - <key>: <value or path to state file>
- excluded_from_snapshot: <list of keys intentionally omitted, with reason>

## Resumption Preconditions

- required_artifacts_exist: [<list of paths that must be present and hash-matching>]
- required_external_state: [<list of external conditions, e.g. "API key valid", "database accessible">]
- max_staleness: <duration, e.g. "72h" — checkpoint invalid after this time without re-validation>
- schema_version_compatible: <minimum schema version the resuming phase accepts>
```

## Staleness and Invalidation

A checkpoint becomes invalid when:

| Condition | Action |
|-----------|--------|
| `max_staleness` exceeded | Re-validate inputs before resuming; if inputs changed, re-run from the affected phase |
| Input artifact hash mismatch | Checkpoint invalid — re-run from this phase |
| Upstream spec or config changed | Invalidate all checkpoints after the change point |
| Schema version incompatible | Checkpoint invalid — re-run with current schema |
| External dependency unavailable | Block resumption, do not silently skip the dependency |

### Staleness Defaults

- Compliance/legal harnesses: `max_staleness: 72h`
- Financial harnesses: `max_staleness: 24h`
- Document processing: `max_staleness: 168h` (7 days)

Override per-harness when domain requirements dictate shorter windows.

## Sensitive State Handling

For legal, financial, and compliance harnesses where intermediate state may contain sensitive data:

- Mark output sensitivity: `public`, `internal`, or `restricted`
- `restricted` artifacts must not be logged in plaintext trace entries
- Checkpoint state snapshots for `restricted` outputs store only the hash and path, not content
- Define retention policy per harness: how long checkpoints with restricted data persist after run completion
- On run cancellation or failure, restricted checkpoints follow the harness's data-retention rules (not automatic deletion)

## Resumption Protocol

When resuming from a checkpoint:

1. Locate the latest valid checkpoint for the target phase
2. Verify all `required_artifacts_exist` paths are present with matching hashes
3. Verify `max_staleness` has not been exceeded
4. Verify `schema_version_compatible` against the current phase implementation
5. Verify `required_external_state` conditions hold
6. If all pass: resume from the next phase, using this checkpoint's outputs as inputs
7. If any fail: walk backward to the latest valid checkpoint and resume from there
8. If no valid checkpoint exists: restart from phase 1

## Storage Convention

Checkpoints are stored at:

```
<harness_output_root>/checkpoints/<run_id>/phase-<sequence>-<phase_id>.yaml
```

One checkpoint file per completed phase. Never overwrite — append new checkpoint files for retried phases with a retry suffix: `phase-<sequence>-<phase_id>-retry-<N>.yaml`.

## Non-Goals

- This template does not define domain-specific phase logic — only the checkpoint contract
- This template does not implement checkpoint validation code — it defines what validators must check
- This template does not replace `pipeline-state-format.md` for code pipeline stages

## References

- `framework/workflows/pipeline-state-format.md`
- `framework/workflows/recovery-playbook.md`
- `harness-engineering/runtime/session-continuity.md`
- `harness-engineering/quality/stage-output-schema.md`
