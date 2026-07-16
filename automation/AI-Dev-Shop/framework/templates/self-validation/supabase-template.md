# Self-Validation Harness: Supabase Stack

- Project / Feature: <name>
- Owner: <agent or human>
- Run Date: <ISO-8601>

## Environment Preflight

- local or remote target: <local branch / hosted project>
- migrations applied: <yes/no + command>
- required secrets configured: <yes/no>

## Boot / Connectivity

- app command: <if app is part of the check>
- Supabase reachability check: `<CLI/API/health command>`
- startup timeout: <seconds>

## Log Checks

- no migration failures
- no edge function boot errors
- no auth/storage policy errors in startup logs

## Primary Validation

- flow checked: <db write / edge function / auth flow / storage upload>
- expected result: <result>

## Negative Or Edge Check

- scenario: <unauthorized access / invalid payload / policy denial>
- expected result: <result>

## Failure Artifacts

- SQL/log offload: <path>
- edge-function log offload: <path>
- client request offload: <path>

## Retry Pass

- fix attempted: <summary>
- rerun result: <pass/fail>
- bounded diagnosis pass used: <yes/no + short note>

## Handoff Summary

- runtime status: <PASS/PARTIAL/BLOCKER>
- validated surfaces:
  - <surface 1>
  - <surface 2>
- remaining risks:
  - <risk 1>
