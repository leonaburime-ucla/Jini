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

## 2026-07-22 addition — genuine 100%-minus-4-provably-unreachable-branches coverage (audit fix, coverage pass)

Per this task's standing "check every other package with a source-map.md for coverage gaps
beyond the named list" rule: `packages/sidecar` (alongside `packages/platform`) was discovered
mid-sweep, not in the original named list. A prior step in this same task added `isRoot`-guarded
`it.skipIf` around this package's `chmod(0o000)`-based permission-denial tests (root's
CAP_DAC_OVERRIDE bypasses directory/file permission bits) in `index.test.ts` (2 tests) — see that
file's own `isRoot` comment. This entry documents closing the gaps that regression left behind,
plus the separate, pre-existing gaps in `port.ts`/`json-ipc.ts` this package's own prior
vitest.config.ts comment had already flagged and deferred.

**Method for every chmod-regression / OS-dependent gap**: `vi.mock("node:fs/promises", ...)` and
`vi.mock("node:net", ...)` at the top of `index.test.ts`, each wrapping the specific functions
needed (`lstat`/`mkdir` for fs; `createServer`/`createConnection` for net) in `vi.fn(actual.fn)`
(default: real behavior), then `.mockImplementationOnce`/`.mockImplementation` per test to inject
a real-shaped error or a deterministic race — identical technique and identical empirical
justification to `packages/platform`'s own 2026-07-22 entry (`vi.spyOn` on a `node:fs/promises` or
`node:net` namespace object fails outright — frozen ESM module-namespace bindings — and this
package's source files call these as plain destructured imports, so `vi.mock` replacing the whole
module for every importer is what actually reaches the real call sites).

**`port.ts`** (4 pre-existing gaps, unrelated to the chmod regression — this file had no
`isRoot`-skipped tests at all):
- `allocateForcedPort`'s `errorCode(error) ?? errorMessage(error)` fallback chain: a real
  `listenOnPort` bind failure always carries a `.code` (EADDRINUSE/EACCES/...), so reaching
  `errorMessage`'s side, and separately `errorCode`'s own "code explicitly null" and
  "non-Error thrown value" sub-branches, needed a mocked `net.createServer()` whose returned
  server's `.listen()` is overridden to synchronously emit a fabricated error instead of actually
  attempting to bind — three new tests, one per fallback shape (codeless `Error`, explicit
  `code: null`, a plain string throw).
- `probeEphemeralPort`'s `address == null || typeof address === "string"` guard: never true for
  a real TCP bind (a `host`-bound socket's `.address()` is always a real `AddressInfo` while
  listening) — reached by mocking `createServer()`'s returned server's own `.address()` method to
  report `null`.
- `port.ts`: **100/100/100/100**.

**`index.test.ts` → `json-ipc.ts`** (the 2 chmod-regression gaps, replaced with `vi.mock`-based
always-run twins, plus a substantial pool of separate pre-existing gaps found during the sweep):
- The 2 `isRoot`-skipped tests ("propagates a non-ENOENT error from the stale-socket lstat check",
  "rejects when probing a stale socket fails with something other than ENOENT/ECONNREFUSED") each
  got a `vi.mock`-based always-run twin: the first via a mocked `lstat` throwing a codeless/
  explicit-null-code error (also closing `errorCode`'s own two sub-branches, matching
  `packages/platform/fs.ts`'s identical pair); the second via a fake socket (a real
  `node:events.EventEmitter` stood in for `net.Socket`, stubbed with `destroy`/`write`/`end`) that
  emits a scripted `'error'` with an `EACCES` code deterministically instead of chasing that exact
  race on a real dead socket.
- `jsonIpcError` and `prepareIpcPath` exported (previously module-private) for direct unit
  testing, matching `packages/platform/asset-cache.ts`'s established "extract into a
  directly-testable pure function" convention:
  - `jsonIpcError`'s `code`-present branch: its only in-tree caller (a `JSON.parse` frame-parse
    failure) always passes a codeless `SyntaxError`, so that branch is real, generically useful
    behavior (any future caller with a Node-style errno error benefits) with no in-tree caller
    that has one in hand today. Directly tested with a manufactured `ErrnoException`, a codeless
    `SyntaxError`, and a non-Error string (`errorMessage`'s own non-Error branch).
  - `prepareIpcPath`'s Windows-named-pipe early return: real, load-bearing behavior, but this
    repo's CI runs on Linux, so no test can actually *bind* a named pipe end-to-end to observe it
    (the pre-existing test for this silently no-op'd off Windows via a bare `if (...) return;`
    instead of `it.skipIf`, matching a same-shaped bug independently found and fixed in
    `packages/platform/proxy-env.ts`'s `resolveSystemProxyEnv` darwin test — see that package's
    own 2026-07-22 entry). Fixed by testing the exported function directly: mocked `mkdir`/`lstat`
    to throw if called at all, proving a pipe path triggers zero filesystem staging on every
    platform this runs on.
- `staleUnixSocketExists`'s own `if (settled) return;` double-settle guard: investigated for a
  race test and found genuinely unreachable — `.once()` self-removes *before* invoking its
  listener, and `settle` itself calls `socket.removeAllListeners()` as its first side effect, so
  no code path can invoke either handler twice. Verified empirically by attempting to force it
  via a fake socket: emitting a second event finds zero listeners and crashes the process outright
  (Node's special "throw on unhandled 'error'" behavior) — itself proof the guard is unreachable,
  since a real double-fire would crash the same way. Removed via a real refactor (the flag and
  guard deleted, not asserted away) rather than left as untestable dead code — unlike
  `requestJsonIpc`'s own, analogous `settled` guard on the client side, which does NOT call
  `removeAllListeners()` and so genuinely can double-fire (its own persistent `.on()` listeners
  stay registered) — kept, and closed with a real test (a fake socket emitting a successful
  response followed by a trailing `'error'`).
- `summarizeJsonIpcMessage`'s whole-message-not-an-object branch and its object-with-no-string-
  `type` branch: both real, reachable behavior (a client can legitimately send any JSON value as
  the whole request payload) — closed with new `requestJsonIpc` calls sending a bare string and an
  object with no `type` field.
- A genuine server-side socket `'error'` event (ECONNRESET-shaped) had literally zero test
  coverage at the *statement* level, not just a branch gap — no existing test caused the server's
  per-connection socket to ever error at all. Closed by wrapping the mocked `net.createServer`'s
  real connection listener to fire a genuine `'error'` event (a real `Error` instance) on the
  real per-connection socket right after connecting, then `destroy()` it to complete the
  simulated reset — deterministic, and a real socket throughout (not a fake one), matching the
  same "wrap the real thing, inject only the trigger" style as `port.ts`'s tests above.
- `requestJsonIpc`'s `response.error?.message ?? "IPC request failed"` fallback (both the trace
  payload and the constructed rejection's own message): the response is untrusted wire JSON from
  the peer, and a buggy/malicious peer can send `{ok:false,error:{}}` with no `message` field at
  all — closed with a fake-socket test sending exactly that.
- **Four branches confirmed genuinely unreachable**, each independently verified this session
  (not inherited from an earlier claim):
  - The idle-timer callback's `if (handled) return;` (`createJsonIpcServer`): every real path that
    sets `handled = true` (a complete frame, or the oversized-frame guard) calls
    `clearTimeout(idleTimer)` in the same synchronous prefix of a single `data`-listener
    invocation, and Node/V8's single-threaded execution model means nothing (including this
    timer's own callback) can run in between — so the timer can never fire once `handled` is true.
  - Three `error instanceof Error ? error.message : String(error)` trace-formatting expressions
    (server socket-error, client socket-error, server frame-parse-failure): a `Socket`'s
    `'error'` listener is typed `Error` by `@types/node` itself (verified against the installed
    `net.d.ts` this session) and Node's own implementation never emits anything else for it; a
    `JSON.parse` failure is always a real `SyntaxError`. Forcing the non-Error side would require
    manually `.emit()`-ing a fabricated value on a socket, which isn't real socket behavior — the
    same reasoning `packages/platform`'s `proxy-env.ts` entry applies to its own outer `catch`.

**Package-wide, verified personally this session**: `pnpm --dir packages/sidecar exec tsc
--noEmit`: clean. `pnpm --dir packages/sidecar run test:coverage`: **81 tests (79 passed, 2
skipped — the 2 already-`isRoot`-skipped chmod tests, each with a real, always-run `vi.mock`-based
twin providing the actual coverage), genuine 100/98.34/100/100 package-wide** — every uncovered
branch remaining is one of the 4 documented above. `pnpm --dir packages/sidecar run build`: clean.
`vitest.config.ts`'s committed threshold raised from 97/89/98/97 to 100/98/100/100 (a small margin
under the real branches number, matching `packages/registry/vitest.config.ts`'s own
just-under-measured convention, to leave room for the 4 permanently-unreachable branches without
the threshold silently sliding if a future change reduces real coverage elsewhere).
