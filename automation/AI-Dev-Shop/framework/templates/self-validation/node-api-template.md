# Self-Validation Harness: Node API

- Service: <name>
- Owner: <agent or human>
- Run Date: <ISO-8601>

## Environment Preflight

- install command: `<npm install / pnpm install>`
- build command: `<npm run build>`
- required env vars: <list>
- backing services: <db/redis/queue>

## Boot

- server command: `<npm run dev / npm start>`
- health check: `curl -f <health-url>`
- startup timeout: <seconds>

## Log Checks

- boot completed without crash
- dependency connections succeeded
- no auth/config/schema errors on startup

## Primary API Check

- request: `<method> <path>`
- payload / params: <example>
- expected status + body: <result>

## Negative Or Edge Check

- scenario: <invalid payload / unauthorized / missing resource>
- expected status + body: <result>

## Failure Artifacts

- request/response offload: <path>
- server log offload: <path>

## Retry Pass

- fix attempted: <summary>
- rerun result: <pass/fail>
- bounded diagnosis pass used: <yes/no + short note>

## Handoff Summary

- runtime status: <PASS/PARTIAL/BLOCKER>
- validated endpoints:
  - <endpoint 1>
  - <endpoint 2>
- remaining risks:
  - <risk 1>
