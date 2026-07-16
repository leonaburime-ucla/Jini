# Self-Validation Harness: Generic Web App

- App / Feature: <name>
- Owner: <agent or human>
- Run Date: <ISO-8601>

## Environment Preflight

- install command: `<npm install / pnpm install / yarn install>`
- required env vars confirmed: <yes/no + list>
- local dependencies available: <database, queue, browser, mock server>

## Boot

- app command: `<dev or preview command>`
- expected healthy signal: <port open, "ready" log line, health endpoint>
- startup timeout: <seconds>

## Log Checks

- no boot crash or unhandled rejection
- no missing env/config errors
- no migration/startup error messages

## Critical Path Check

- route or page: `<url>`
- user action: <what to click or submit>
- expected result: <DOM/API/result>

## Negative Or Edge Check

- scenario: <empty state, invalid input, network failure, permissions issue>
- expected result: <error message / disabled state / fallback>

## Failure Artifacts

- screenshot path: <if applicable>
- log offload path: <if applicable>
- DOM/network offload path: <if applicable>

## Retry Pass

- change attempted after failure: <summary>
- rerun result: <pass/fail>
- bounded diagnosis pass used: <yes/no + short note>

## Handoff Summary

- runtime status: <PASS/PARTIAL/BLOCKER>
- verified paths:
  - <path 1>
  - <path 2>
- remaining risks:
  - <risk 1>
