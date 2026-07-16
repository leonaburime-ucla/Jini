# `@jini/protocol` — provenance

Origin: `nexu-io/open-design` (fork `leonaburime-ucla/open-design`), branch `main`,
commit `951fa5f1541c3b7af23ccb07e3e60b294def56b1` (2026-07-12), local reference
clone `/Users/la/Desktop/Programming/OSS-Repos/open-design-agentic`.

Per extraction-plan.md §8 task 2: "`@jini/protocol` — run events/errors/cursors/
cancellation/idempotency, seeded from `packages/contracts` with OD nouns stripped."

| Jini file | Origin file(s) | Transform |
|---|---|---|
| `src/common.ts` | `packages/contracts/src/common.ts` | Verbatim generic shapes (`JsonValue`, `BoundedJsonConstraints`, `OkResponse`, `IdResponse`, `EntityResponse`, `EntityListResponse`, `Nullable`). Dropped `LIVE_ARTIFACT_BOUNDED_JSON_CONSTRAINTS` (a product-specific constant value) — packs supply their own values against the generic interface. |
| `src/errors.ts` | `packages/contracts/src/errors.ts` | Kept the generic error envelope (`ApiError`, `ApiErrorResponse`, `ApiValidationIssue`, `ApiValidationErrorDetails`, `createApiError`, `createApiErrorResponse`) and only the transport/tool-boundary-generic codes from the ~80-entry `API_ERROR_CODES` union (renamed `GENERIC_ERROR_CODES`). Dropped every product code (`AMR_*`, `ARTIFACT_*`, `CONNECTOR_*`, `MEDIA_*`, `LIVE_ARTIFACT_*`, `PROJECT_NOT_FOUND`, `ROLE_MARKER_HALLUCINATION`, `TOOL_LOOP_DETECTED`, etc.) and widened `ApiErrorCode` from a closed union to `GenericErrorCode \| (string & {})` so a pack's own codes type-check without a kernel edit. Dropped the OD-shaped `taskId` field on `ApiError` (collides with the automation-domain `WorkItem`/`JobAttempt` vocabulary — see the vocabulary firewall in root `AGENTS.md`). Renamed `SseErrorPayload` → `RunErrorPayload` (transport-neutral). |
| `src/events.ts` | `packages/contracts/src/sse/common.ts` + the generic slice of `packages/contracts/src/sse/chat.ts` | `SseTransportEvent<Name, Payload>` → `RunEvent<Name, Payload>` (renamed off "SSE" — SSE is one transport projection among HTTP/CLI/MCP/sidecar per §12 C2). Kept the generic run lifecycle payloads (`start`/`stdout`/`stderr`/`error`/`end`, and the `agent` sub-payloads `status`/`text_delta`/`thinking_start`/`thinking_delta`/`tool_use`/`tool_input_delta`/`tool_result`/`usage`/`raw`). Dropped OD/pack-shaped payloads: `conversation_title`, `fabricated_role_marker`, `tool_loop` (gated by OD's `OD_TOOL_LOOP_GUARD`), `live_artifact`/`live_artifact_refresh`/`artifact` SSE payloads, `browser_action_request` (depends on OD's `agent-tools` capability vocabulary). Dropped daemon-internal fields on the start payload (`cwd`, `projectId`, `model`, `reasoning`, `bin`) — kept `runId`/`agentId`/`protocolVersion`/`idempotencyKey`. These dropped shapes are exactly the kind of thing a pack layers on top of the same `RunEvent` envelope; they are not lost, just not kernel-owned. |
| `src/run.ts` | `packages/contracts/src/tasks.ts` | `TASK_STATES`/`TaskState`/`TaskStatus` → `RUN_STATES`/`RunState`/`RunStatus` (renamed off "Task" — that word is reserved for the automation domain's `WorkItem`/`JobAttempt`, not the engine's `Run`; see the vocabulary firewall). Added `TERMINAL_RUN_STATES`/`isTerminalRunState` and `RunCancelRequest` (new, not lifted — extraction-plan task 2 calls for an explicit cancellation contract that the origin file didn't have). |

Explicitly not ported here (still OD-only / later-task material): `execution-profile.ts`
(product-specific run mode), `agent-tools/*` (capability/tool vocabulary — task 6
`ToolExecutor` territory), everything else in `packages/contracts/src/index.ts`'s
barrel (`api/*`, `brands`, `plugins`, `figma`, `media`, `connectors`, `design-systems`,
`prompts`, `critique`, `analytics`, `artifacts/od-card`) — all product surfaces per
`docs/jini-port/recon/r1-daemon.md`.

**Provenance correction (2026-07-16):** the origin commit above is the tip of
the local `open-design-agentic` clone's `main` branch, which turns out to be a
personal integration branch diverged from true upstream `nexu-io/open-design`
`main` (see `docs/jini-port/od-reference-branches.md`), not upstream `main`
itself. Practical effect on this file: `GENERIC_ERROR_CODES` includes
`TOOL_NOT_AVAILABLE`, which is only present in the local branch's
not-yet-upstream `browser-actions`/`agent-tools` work — `common.ts` and the
rest of `errors.ts`'s kept codes are verified byte-identical to true upstream.
Not reverted; it's a reasonable generic tool-boundary code either way.
