# `@jini/sidecar` — provenance

Origin: `nexu-io/open-design` (fork `leonaburime-ucla/open-design`), branch `main`,
commit `951fa5f1541c3b7af23ccb07e3e60b294def56b1` (2026-07-12), local reference
clone `/Users/la/Desktop/Programming/OSS-Repos/open-design-agentic`.

Per extraction-plan.md §8 task 4: "`@jini/platform` + `@jini/sidecar` verbatim,
path-mirrored + patch-router." The origin package is already written against a
host-supplied `SidecarContractDescriptor<TStamp>` (defaults, env var names,
normalizers) rather than hardcoded OD values, so the extraction here is close to
a pure identity-string strip, not a re-architecture — extraction-plan §7 C7 notes
`@jini/sidecar` is "extractable" with the main follow-up work (typed codec/
capability negotiation for third-party protocol messages) being later,
security-hardening work, not this task.

| Jini file | Origin file | Transform |
|---|---|---|
| `src/types.ts` | `packages/sidecar/src/types.ts` | Verbatim. Pure type declarations: `SidecarStampShape`, `SidecarContractDescriptor`, the resolution-option types, `SidecarRuntimeContext`, `PortAllocation`/`PortRequest`, `JsonIpcHandler`/`JsonIpcServerHandle`. No OD nouns — every product-specific value already lives behind the generic `contract`/`TStamp` parameters. |
| `src/ipc-path.ts` | `packages/sidecar/src/ipc-path.ts` | Verbatim. Windows named-pipe detection + IPC path validation. No OD nouns. |
| `src/net.ts` | `packages/sidecar/src/net.ts` | Verbatim. Generic promise-based TCP server close/listen helpers shared by `port.ts` and `json-ipc.ts`. No OD nouns. |
| `src/port.ts` | `packages/sidecar/src/port.ts` | Verbatim. Forced/dynamic TCP port allocation with a `reserved` set. No OD nouns. |
| `src/json-file.ts` | `packages/sidecar/src/json-file.ts` | Verbatim. Forgiving JSON read, atomic write, best-effort remove, guarded pointer removal. No OD nouns. |
| `src/bootstrap.ts` | `packages/sidecar/src/bootstrap.ts` | Ported with 1 type-strictness edit only (no behavior change) — see below. Launch-env composition + runtime bootstrap/validation, entirely contract-driven (`options.contract.env.*`). No OD nouns. |
| `src/paths.ts` | `packages/sidecar/src/paths.ts` | Ported with 2 identity-strips (comments only) — see below. Namespace/runtime-path resolution, entirely contract-driven (`contract.defaults.*`, `contract.normalize*`). No OD nouns in the logic itself; only two doc-comment mentions of the origin product name. |
| `src/json-ipc.ts` | `packages/sidecar/src/json-ipc.ts` | Ported with 1 identity-strip (env var name) + 1 identity-strip (log line prefix) — see below. NDJSON-over-socket/pipe server and client, with opt-in tracing and stale-socket cleanup. The tracing mechanism itself is generic; only the trace-gate env var name and the trace log's product-name prefix were OD-specific. |
| `src/index.ts` | `packages/sidecar/src/index.ts` | Ported with 1 identity-strip (module doc comment) — see below. Root barrel; re-exports the same public surface under the same names. |

## Identity strips (per root `AGENTS.md` hard boundary: no `Open Design`/`OD_`/`--od-stamp`/`/tmp/open-design` in `packages/@jini/**`)

| File | Origin | Change | Reason |
|---|---|---|---|
| `src/index.ts` | `@module @open-design/sidecar` | → `@module @jini/sidecar` | Module doc comment named the OD package; renamed to the Jini package, no behavior change. |
| `src/json-ipc.ts` | env var `OD_JSON_IPC_TRACE` (doc comment + `process.env.OD_JSON_IPC_TRACE` read) | → `JINI_JSON_IPC_TRACE` | The only OD-prefixed (`OD_`) env var in either package. Renamed the gate variable; behavior (opt-in tracing) unchanged. |
| `src/json-ipc.ts` | `console.error("[open-design sidecar] json ipc trace", ...)` | → `console.error("[jini sidecar] json ipc trace", ...)` | Log-line product-name prefix; renamed, no behavior change. |
| `src/paths.ts` | doc comment: `"...all from a host contract so no Open Design-specific strings are hardcoded here."` | → `"...so no product-specific strings are hardcoded here."` | Doc-comment-only; the code itself already took no OD-specific strings (that's the point of the sentence) — only the wording named the product. |
| `src/paths.ts` | doc comment: `"...so this generic helper does not have to hardcode Open Design's mode strings."` | → `"...so this generic helper does not have to hardcode the host product's mode strings."` | Same — doc-comment-only. |

## Strictness-only edits (Jini's stricter `tsconfig.base.json`, no behavior change)

Jini's root `tsconfig.base.json` sets `exactOptionalPropertyTypes: true`, which
OD's own `tsconfig.json` does not set. This flags `bootstrapSidecarRuntime`'s
call into `resolveSidecarBase({ base: options.base, ..., projectRoot:
options.projectRoot, ... })`: `options.base`/`options.projectRoot` are typed
`string | null | undefined` / `string | undefined` (both are optional fields on
`BootstrapSidecarRuntimeOptions`), but `BaseResolutionOptions` declares `base?:
string | null` and `projectRoot?: string` — under `exactOptionalPropertyTypes`,
an optional property may be *omitted* or hold its declared type, but not
explicitly hold `undefined`. Fixed in `src/bootstrap.ts` by normalizing
`options.base ?? null` (both `undefined` and `null` already fell through the
same `base ?? env[...] ?? ...` fallback chain inside `resolveSidecarBase`, so
this is a no-op on behavior) and by only spreading `projectRoot` into the call
object when it is not `undefined` (so an omitted `projectRoot` stays omitted,
letting `resolveSidecarBase`'s own default parameter — `process.cwd()` — apply
exactly as before).

## Dependencies

No runtime dependencies in the origin package (devDependencies only: `@types/node`,
`esbuild`, `typescript`, `vitest`). Uses the same root `@types/node` devDependency
added for `@jini/platform` (see its source-map.md).

## Not ported (out of scope for this task)

Nothing was left out — every file in the origin `packages/sidecar/src/` ported
(verbatim or with the identity/strictness edits above). The origin `tests/index.test.ts`
(257 lines, a single fake-contract suite) was adapted rather than copied
byte-for-byte: `src/index.test.ts` here keeps the same fake-contract structure and
test cases (path boundary, IPC round-trip + tracing + UTF-8 chunk-boundary
regression, bootstrap/launch-env, `resolveRuntimeNamespaceRoot` dev-vs-packaged
cases) but renames the trace env var, log prefix, and temp-dir/test-title
strings that referenced "Open Design" in the origin test, and adds two new
cases (`allocatePort` dynamic/forced-conflict, `requestJsonIpc` timeout) that the
origin suite didn't directly cover for this package's exported surface.

Out of scope per the task directive (not touched, not read for modification):
`packages/sidecar-proto`, `packages/host`, and the corresponding OD packages —
later-task material.

## Explicitly deferred (task 1 dependency)

The "patch-router" half of task 4's gate ("a real historical `packages/platform`
patch routes cleanly" — the sidecar package shares the same gate) depends on
task 1 (harnesses + sync-ownership manifest), which has not been done yet. Not
attempted here — see the Programmer handoff report for this task.

## 2026-07-21 addition — `daemon-registry.ts` (local daemon-URL discovery, first real consumer)

Origin: none — this is new, greenfield code, not an OD port. Written to close a real gap
`packages/cli/source-map.md`'s own 2026-07-21 investigation found: `@jini/node-host`'s
`createLocalNodeDaemon` resolves a real listening URL but "nothing persists that URL anywhere a
*separate* CLI process could find it (no IPC status server, no port file, no pidfile)" — and that
investigation explicitly named this package's own `createJsonIpcServer`/`requestJsonIpc` as
unused (`grep -rln "requestJsonIpc\|createJsonIpcServer\|bootstrapSidecarRuntime"
packages/node-host/src packages/daemon/src` found zero call sites at the time). This addition is
this package's **first real consumer among the locked packages** — before this, `@jini/cli` and
`@jini/node-host` both existed without ever importing `@jini/sidecar`.

**Why a flat JSON pointer file, not the full NDJSON-IPC surface (`json-ipc.ts`).** The problem is
"read a URL once, from a separate process, without a live daemon round-trip" — the daemon may not
even be running yet (or may have just crashed) when the read happens, so a socket-based RPC adds a
connection-refused failure mode for no benefit over a file read. This package already has the
exact right-shaped primitive for that: `json-file.ts`'s `writeJsonFile`/`readJsonFile` (atomic
temp-file-rename write, forgiving read) are the same tools `paths.ts`'s own `current.json`
namespace pointer (`resolvePointerPath`) already uses for an analogous "what's currently running"
question. `daemon-registry.ts` is built directly on those two functions plus one genuinely new
primitive this package had no prior need for:

- **`isProcessAlive(pid)`** — a `process.kill(pid, 0)` liveness probe (no signal is actually sent;
  `0` only tests deliverability). Returns `true` on success or `EPERM` (process exists, just not
  signalable by this user — still "alive" for discovery purposes), `false` for `ESRCH` (no such
  process), a non-positive/non-integer input, or any other unexpected error (treated
  conservatively as not-confirmed-alive). This is the "verify liveness, don't just trust the file"
  half of the task's own edge-case list — a naive reader that only checked file existence would
  hand back a stale daemon's URL after a crash.
- **`resolveDaemonRegistryPath(dataDir, fileName?)`** — `<dataDir>/daemon.json` by default, a
  sibling of `@jini/sqlite`'s own `<dataDir>/events.db`. Deliberately `dataDir`-scoped rather than
  a single machine-wide well-known path — see `@jini/node-host`'s matching source-map.md entry for
  why that's the right answer to "is multi-daemon-per-machine a real scenario here."
- **`writeDaemonRegistryRecord`/`removeDaemonRegistryRecordIfCurrent`** — thin, typed wrappers over
  `writeJsonFile`/`readJsonFile`+`removeFile`. The guarded-removal shape (only remove if the
  record's `pid` still matches the caller's) is the identical pattern `json-file.ts`'s existing
  `removePointerIfCurrent` already established for its own pointer file — reused here, not
  reinvented, for the same reason: a slow-shutting-down old process must never delete a newer
  process's already-written record.
- **`readLiveDaemonRegistryRecord`** — the combined "read, validate shape, verify liveness"
  primitive a CLI-side discovery probe actually needs in one call: a missing file, a
  malformed/foreign JSON record, and a well-formed record whose `pid` is dead all resolve to
  `null` (never throw) — discovery failing is an ordinary, expected outcome, not an exceptional
  one.

**Concurrent writes.** Handled entirely by the pre-existing `writeJsonFile` atomic
temp-file-rename primitive this module reuses rather than reimplements — every reader observes a
fully-written record or none at all, never a torn/partial one. Not re-tested here beyond a
sequential-writes-converge-to-the-last-one case (`daemon-registry.test.ts`); a true
same-millisecond simultaneous-writer collision on `writeJsonFile`'s own `${filePath}.${pid}.${Date.now()}.tmp`
naming is a narrow, pre-existing characteristic of that already-shipped primitive, not something
this addition introduces or was asked to fix.

**Tests**: `src/__tests__/daemon-registry.test.ts` (19 tests) — round-trip, missing/malformed
record, the crashed-daemon stale-pid case via a **real spawned-then-awaited-exit child process**
(not a mock) for both `readLiveDaemonRegistryRecord` and `isProcessAlive` directly, guarded
removal (match/no-match/absent), and `isProcessAlive`'s branches (current-process alive, exited
child dead, non-integer/zero/negative inputs never even reach `process.kill`, mocked
`EPERM`/`ESRCH`/unrecognized-error responses). 100/100/100/100 on `daemon-registry.ts` itself;
package-wide `pnpm --dir packages/sidecar exec vitest run --coverage` is 98.42/92.23/98.21/98.42
(66 tests total, 2 files), above this package's existing 97/89/98/97 ratchet-baseline gate.

## Dependencies (updated)

No new dependency — `daemon-registry.ts` uses only this package's own existing `json-file.ts`
exports plus `node:path` and the global `process`.
