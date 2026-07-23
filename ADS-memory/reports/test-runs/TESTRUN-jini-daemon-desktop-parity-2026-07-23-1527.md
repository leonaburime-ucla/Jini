# Test Run: Jini daemon and desktop parity smoke

- Date: 2026-07-23T15:27:13Z
- Runner: TestRunner Agent
- Scope: Current Jini daemon boot, HTTP reachability, desktop-host tests, and visible-host entry points
- Jini revision: `a374e633ce6e45acadc7cbc9cb196816769326f0`
- Analysis input:
  `ADS-memory/reports/codebase-analysis/ANALYSIS-001-jini-daemon-desktop-parity-2026-07-23.md`
- Spec/test certification: N/A — user-requested brownfield diagnostic, not a certified feature cycle
- Coverage profile/artifacts: N/A — coverage was not requested or declared for this diagnostic
- Mutation: N/A — slot not declared

## Follow-up after fixes

The blockers recorded by this diagnostic were addressed later on 2026-07-23:

- The model-proxy async lifecycle was fixed in `packages/http/src/model-proxy.ts`.
  `@jini/http` now passes **32/32 files and 895/895 tests**.
- A real Chrome reference host and Electron desktop shell now exist under
  `examples/`.
- A Playwright smoke sent a demo message through `POST /api/runs`, consumed the durable
  SSE stream, and rendered text plus a tool timeline with zero browser console errors.
- The native Electron process launched successfully against the same renderer.
- Relevant app/script typechecks and `pnpm guard` pass.

The historical result below explains the pre-fix state and is intentionally retained.

## Outcome

**PARTIAL / NOT READY FOR VISUAL PARITY TESTING**

The headless daemon boots and its core acceptance harness passes. The default node host exposes 78
live routes. The desktop-host adapter library passes all tests. The HTTP package is not green:
6 model-proxy tests fail. No browser or desktop application entry point exists, so the requested
visual parity journey cannot start.

## Fresh Build Gate

Command:

```text
pnpm --filter '@jini/node-host...' --if-present run build
```

Result: PASS. Thirteen packages in the node-host dependency closure built successfully.

Important finding: before this build, the workspace package exports served stale `dist` files.
The initial live daemon returned old `/health` and `/ready` payloads that contradicted current
source. After the dependency-closure build, the live payloads matched source:

- `/health` → `{"ok":true,"version":"0.1.0"}`
- `/ready` → `{"ok":true,"ready":true,"version":"0.1.0","checks":{"db":true,"notShuttingDown":true}}`

Classification: `PACKAGING/BUILD_DRIFT`. A workspace-local green smoke can test stale compiled
artifacts unless the build step is mandatory.

## Acceptance / Integration

Command:

```text
pnpm --dir examples/minimal-host start
```

Result: PASS, exit 0, marker `MINIMAL_HOST_BOOT_OK`.

This existing harness exercises:

- daemon boot;
- run create/list/status;
- native SSE stream and cursor reconnect;
- cancellation;
- stop/restart and durable replay;
- a real Node ACP subprocess fixture and permission response.

It passed both before and after the fresh dependency-closure build. The post-build pass is the
authoritative result.

## Persistent Daemon Smoke

A temporary daemon was started with a fresh data directory and stopped after probing.

Observed live:

| Request | Result |
|---|---|
| `GET /health` | 200, current versioned liveness payload |
| `GET /ready` | 200, DB + shutdown readiness checks |
| `GET /api/version` | 200, version `0.1.0` |
| `GET /api/daemon/status` | 200, bound host/port/dataDir/PID |
| `GET /api/agents` | 200, 24 agent definitions |
| `GET /api/runs` | 200, empty run list |
| `GET /api/memory` | 200, enabled durable note store |
| `GET /api/connectors/auth/session?token=smoke` | 503 `NOT_CONFIGURED`, proving the route is mounted and fails closed without a provider |
| `GET /` | 404 `Cannot GET /`, proving no web app/static fallback is mounted |

Runtime inspection of the Express request handler reported **78 registered routes**:
75 `/api/**` routes plus bare `/health`, `/ready`, and `/version`.

Not auto-mounted despite implementation in `@jini/http`:

- routine routes (7);
- delegated-tool route (1);
- AG-UI run stream (1).

## Package Suites

### `@jini/node-host`

Command: `pnpm --filter @jini/node-host test`

Result: PASS.

- Test files: 3/3
- Tests: 78/78
- Duration: 3.69s

Expected stderr from intentionally failing/denied media and unknown-agent cases was emitted inside
passing tests; it did not indicate suite failure.

### `@jini/desktop-host`

Command: `pnpm --filter @jini/desktop-host test`

Result: PASS.

- Test files: 28/28
- Tests: 179/179
- Duration: 4.32s

This proves adapter behavior against fake structural Electron/Tauri surfaces. It does not prove
that a native app launches; the package has no native runtime dependency or executable entry point.

### `@jini/http`

Command: `pnpm --filter @jini/http test`

Result: FAIL.

- Test files: 31 passed, 1 failed
- Tests: 889 passed, 6 failed (895 total)
- Failing file: `packages/http/src/__tests__/model-proxy.test.ts`

Failure cluster: Anthropic/OpenAI SSE tool-turn fixtures.

- Plain responses emit only the initial `status` event; expected `text_delta`/`end` events are absent.
- Injected Anthropic/OpenAI tool executors are never called.
- Runtime errors show `Cannot read properties of undefined (reading 'content')` in
  `packages/agent-runtime/src/providers/{anthropic-messages,openai-chat}.ts`.

Likely owner: Programmer for an implementation/fixture-contract reconciliation, with TDD
recertification if upstream response shapes intentionally changed. This exact six-test cluster was
already recorded as pre-existing in the July 23 live-parity report; it remains open in the current
working tree.

Classification: `IMPLEMENTATION_FIX_REQUIRED`.

## Visible Host Entry Points

Commands:

```text
pnpm -C examples/reference-web run dev
pnpm -C packages/desktop-host run start
```

Results:

- Browser host: FAIL, `ERR_PNPM_NO_SCRIPT Missing script: dev`
- Desktop host: FAIL, `ERR_PNPM_NO_SCRIPT_OR_SERVER Missing script start or file server.js`

These are expected structural failures, not environment/setup failures:

- `examples/reference-web` has zero source files.
- `@jini/desktop-host` is a library, not a native application.

## E2E

E2E: BLOCKED — the requested Chrome/Electron user journey has no application target. No Playwright
or desktop automation run can be meaningful until a visible composition root exists.

## Convergence

- Headless daemon acceptance: 100% for the executed minimal-host scenario.
- Node-host suite: 100%.
- Desktop-host adapter suite: 100%.
- HTTP suite: 99.33% test pass rate, but convergence is FAIL because 6 required tests fail.
- Visual app journey: 0% runnable; no target exists.
- Overall diagnostic gate: FAIL for “ready to compare/install the UI chat agentic control plane.”

## Cleanup

Both temporary daemon processes were stopped. Their two exact `/tmp/jini-daemon-smoke-*`
directories and the temporary curl response file were deleted. A pre-existing unrelated
`node scratch-run-daemon.ts` process (PID observed as 18492) was left untouched.
