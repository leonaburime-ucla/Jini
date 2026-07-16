# Coordinator Verification Packet

- Feature: FEAT-<NNN> — <feature name>
- Spec ID: <SPEC-id>
- Spec Version: <version>
- Active Spec Hash: <sha256>
- Packet Created At: <ISO-8601 UTC>
- Packet Created By: Coordinator
- Source TestRunner Report: <path or N/A>
- Source Test Certification: <path>
- Source Tasks: <path>
- Advisory-Only Review: yes/no

This packet is Coordinator-owned. It summarizes accepted verification evidence
for downstream review. Specialist agents validate the packet for freshness and
completeness but do not edit it, wait on its producers, or dispatch other agents.

## Hash Verification

| Artifact | Path | Expected Hash | Verification Command | Status |
|---|---|---|---|---|
| Active spec | `<path>` | sha256:<hash> | `<command>` | PASS / FAIL |
| Test certification | `<path>` | sha256:<hash from pipeline-state> | `<command>` | PASS / FAIL |

## Test File Inventory Check

| Test File | Certified sha256 | Current sha256 | Expected Test Count | Status |
|---|---|---|---:|---|
| `tests/example.test.ts` | sha256:<hash> | sha256:<hash> | 3 | PASS / FAIL |

## Suite Status

| Suite | Required? | Command | Executed Tests | Expected Tests | Result | Coverage Artifact |
|---|---|---|---:|---:|---|---|
| unit | yes/no | `<command>` | <N> | <N> | PASS / FAIL / N/A | `<path>` |
| integration | yes/no | `<command>` | <N> | <N> | PASS / FAIL / N/A | `<path>` |
| e2e | yes/no | `<command>` | <N> | <N> | PASS / FAIL / N/A | `<path>` |

## Coverage Gate Status

| Suite | Lines | Branches | Functions | Statements | Status |
|---|---:|---:|---:|---:|---|
| unit | <actual>/<target> | <actual>/<target> | <actual>/<target> | <actual>/<target> | PASS / FAIL / N/A |
| integration | <actual>/<target> | <actual>/<target> | <actual>/<target> | <actual>/<target> | PASS / FAIL / N/A |
| e2e | <actual>/<target> | <actual>/<target> | <actual>/<target> | <actual>/<target> | PASS / FAIL / N/A |

## Flaky Test Status

| Test ID | Registry Entry | Approval Fields Present | Expires At | Status |
|---|---|---|---|---|
| `<test id>` | `<path or N/A>` | yes/no | <date or N/A> | NONE / KNOWN_APPROVED / UNAPPROVED |

## Convergence Gate

- Threshold Source: `tasks.md` default / human-approved override
- P1 Acceptance Tests: <passed>/<total>
- Invariant Tests: <passed>/<total>
- Required Coverage Gates: PASS / FAIL / N/A
- Empty/Skipped-Only Suite Check: PASS / FAIL
- Unapproved Flaky Tests: none / listed below
- Overall Verification Status: PASS / FAIL / UNAVAILABLE / BLOCKED
- Code Review Gate Status: READY / NOT_READY / WAIVED

## Waiver

Only complete when `Code Review Gate Status` is `WAIVED`.

- Human Reviewer: <name>
- Approved At: <ISO-8601 UTC>
- Scope: <what is waived>
- Reason: <why waiver is accepted>
- Remaining Risk: <risk summary>
