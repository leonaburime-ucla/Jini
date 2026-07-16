# Gates and Handoffs

## Pre-Dispatch Gate Schema

Required fields:
- `feature_id`, `next_stage`
- `spec_hash_state`, `spec_hash_dispatch`, `spec_hash_match`
- `clarification_open_count`, `architect_dispatch_allowed`
- `retry_cluster.cluster_id`, `retry_cluster.retry_count`, `retry_cluster.retry_budget`, `retry_cluster.budget_exhausted`
- `escalation_required`, `escalation_reason`

Rules:
- If `spec_hash_match=false` -> block + escalate
- If `next_stage=architect` and `clarification_open_count>0` -> block
- If `retry_count >= retry_budget` -> block + escalate

## Compact Handoff Schema

Required fields:
- `feature_id`, `stage_from`, `stage_to`
- `spec_hash`, `adr_hash`, `tasks_hash`, `test_cert_hash`
- `status_summary`, `active_failures`, `risks`
- `next_assignee`, `human_decision_needed`

Constraints:
- Max 5 failure clusters, max 10 tests per cluster
- Max 5 risks
- No raw logs in payload

## YAML Skeleton

```yaml
feature_id: FEAT-042
stage_from: programmer
stage_to: testrunner
spec_hash: "sha256:..."
adr_hash: "sha256:..."
tasks_hash: "sha256:..."
test_cert_hash: "sha256:..."
status_summary:
  tests_passing: 91
  tests_total: 96
  acceptance_pass_percent: 94.8
active_failures: []
risks: []
next_assignee: testrunner
human_decision_needed: false
```
