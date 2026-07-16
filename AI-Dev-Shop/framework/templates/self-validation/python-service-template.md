# Self-Validation Harness: Python Service

- Service: <name>
- Owner: <agent or human>
- Run Date: <ISO-8601>

## Environment Preflight

- dependency install: `<uv sync / pip install -r requirements.txt>`
- required env vars: <list>
- backing services: <db/cache/queue>

## Boot

- service command: `<uv run ... / python -m ...>`
- health check: `<curl command or test client check>`
- startup timeout: <seconds>

## Log Checks

- no import/config errors
- no migration/connection failures
- worker/background process started if required

## Primary Runtime Check

- request or job: <what to run>
- expected behavior: <result>

## Negative Or Edge Check

- scenario: <bad input / permission denial / timeout path>
- expected behavior: <result>

## Failure Artifacts

- traceback/log offload: <path>
- request payload offload: <path>

## Retry Pass

- fix attempted: <summary>
- rerun result: <pass/fail>
- bounded diagnosis pass used: <yes/no + short note>

## Handoff Summary

- runtime status: <PASS/PARTIAL/BLOCKER>
- verified behaviors:
  - <behavior 1>
  - <behavior 2>
- remaining risks:
  - <risk 1>
