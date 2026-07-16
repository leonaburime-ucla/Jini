# Eval 1 — Branch Creation at TDD Dispatch

## Scenario
You are the Coordinator. ADR is approved, tasks.md is generated. You are about to dispatch the TDD agent for feature 305 (payment-webhooks).

## Context
- Pipeline feature: 305-payment-webhooks
- ADR approved at: reports/pipeline/305-payment-webhooks/adr.md
- Tasks generated at: reports/pipeline/305-payment-webhooks/tasks.md
- Current branch: main

## What To Check
- Does the Coordinator create branch `feature/305-payment-webhooks` before TDD dispatch?
- Does it record the branch in pipeline-state.md?
- Does it NOT start TDD work on main?
