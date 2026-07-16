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
