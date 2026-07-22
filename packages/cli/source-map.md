# `@jini/cli` — provenance and classification

Origin: `leonaburime-ucla/open-design`, branch `main`, commit
`ab453241247865ebb2cd9259b37286282506fe65` (2026-07-02), cloned fresh into
`/tmp/od-source` for this task (the in-repo
`integrations/open-design/reference/` snapshot is a frozen extraction-time
copy and is explicitly unreliable for structural claims per that directory's
own `README.md`).

Read in full, start to finish, before any code was written:
`apps/daemon/src/cli.ts` (9,885 lines on this commit — the task brief's
"10,175 lines" figure was from a different commit/branch; this is the real
number on the branch this task was told to clone), plus every satellite file
it imports: `apps/daemon/src/daemon-url.ts` (119 lines),
`apps/daemon/src/artifacts-cli.ts` (152), `apps/daemon/src/handoff-cli.ts`
(176), `apps/daemon/src/codex-cli.ts` (121),
`apps/daemon/src/tools-connectors-cli.ts` (2,830),
`apps/daemon/src/tools-design-systems-cli.ts` (160),
`apps/daemon/src/tools-live-artifacts-cli.ts` (312),
`apps/daemon/src/export-cli-request.ts` (57),
`apps/daemon/src/export-cli-routing.ts` (15),
`apps/daemon/src/research/cli-args.ts` (15),
`apps/daemon/src/design-systems-cli-help.ts` (20),
`apps/daemon/src/brands-cli-help.ts` (43). There is no `apps/daemon/src/cli-help/`
directory and no committed `dist/cli/` tree on this branch/commit — searched
for both, neither exists. The "additional command groups visible in a
compiled `dist/cli/` tree" mentioned in the task brief (`automation`, `share`,
`ui`, `core`, `memory`, `brand`, `library`, `project`, `system`, `figma`,
`templates`) are **all present as source in `cli.ts` itself** (dispatched via
the top-level `SUBCOMMAND_MAP`, cli.ts:308-342) — no separate dist artifact
was needed to find them.

Per extraction-plan.md §3's one-line spec for `@jini/cli`: "CLI transport
(HTTP-client mode default; in-proc enters via identical app-service+principal
path)". Per §2.1, the kernel has **no** `Project`, `Conversation`, `Brand`,
`DesignSystem`, `Plugin`/marketplace, or `Automation` nouns — only `Run`,
`Agent`, `Tool`, `EventLog`, `Principal`. That single fact drives almost every
verdict below: OD's `cli.ts` is a thin HTTP client over OD's *product* API
(`/api/projects/:id/...`), and the overwhelming majority of its ~9,900 lines
existieren only because OD's product surface is large — not because CLI
transport is large. The generic slice this task actually ports is the part
that has nothing to do with what a "project" or a "plugin" is.

## Classification table

Verdict legend: **GENERIC** = ported into `packages/cli/src/`. **OD** =
explicitly not ported (product-specific). **UNCLEAR** = open question, not
ported, needs Coordinator/Software-Architect sign-off.

| Subcommand group / helper | OD source file : function(s) | Verdict | Reasoning |
|---|---|---|---|
| `parseFlags` | `cli.ts:1031` `parseFlags` | **GENERIC** | Pure `--flag value` / `--flag=value` / boolean-flag parser. Zero OD nouns; takes caller-supplied `string`/`boolean` Sets. Ported near-verbatim as `parseFlags`. |
| `positionalArgs` / `collectCliPositionals` | `cli.ts:1082` `positionalArgs`, `cli.ts:5625` `collectCliPositionals` | **GENERIC** | Two near-duplicate positional-arg extractors (the second adds `--` separator handling). Merged into one `positionalArgs` with a `stopAtDoubleDash` option — OD itself never unified them, but there is no reason for `@jini/cli` to carry the duplication forward. |
| daemon-URL resolution | `daemon-url.ts` `resolveDaemonUrl` + `cli.ts:1098` `cliDaemonUrl`/`cliDaemonBaseUrl` | **GENERIC** (pattern only) | The *resolution order* — explicit flag → env var → IPC/discovery probe → default — is exactly the generic "how does a CLI find its daemon" concern `@jini/cli` needs. The *implementation* is not portable as-is: it hardcodes `OD_DAEMON_URL`/`OD_SIDECAR_IPC_PATH`, imports `@open-design/sidecar` + `SIDECAR_ENV`/`SIDECAR_MESSAGES` (OD's own sidecar IPC protocol, not `@jini/sidecar`'s), and falls back to spawning `pnpm exec tools-dev status --json` (an OD monorepo-specific dev script). Ported as `resolveDaemonUrl` with the same 4-step order but a caller-injected discovery function (no IPC protocol assumed) and a caller-supplied env var name (defaults to none) — `@jini/sidecar`'s actual NDJSON-IPC surface (see `packages/sidecar/source-map.md`) was not wired in this pass; see "Deferred" below. |
| `surfaceFetchError` | `cli.ts:1007` | **GENERIC** | Formats a `fetch()` rejection (network-unreachable, sandbox-denied) into a stderr line + an `EPERM`/`ENETUNREACH` sandbox hint. No OD nouns beyond the word "Open Design" in the hint string, which is generalized to a caller-supplied product name (defaults to nothing). |
| `exitWithStructuredError` / `structuredHttpFailure` / `normalizeRecoverableErrorCode` / `structuredErrorData` | `cli.ts:1476-1538` | **GENERIC** (mechanism); OD (default code table) | The *mechanism* — map an error `code` to a stable exit code, write a `{ error: { code, message, data } }` envelope to stderr — is exactly the "structured error/exit-code handling" the task brief calls out as locked scope. OD's own `RECOVERABLE_EXIT_CODES` table (`cli.ts:284-298`) is product-specific (`plugin-not-found`, `snapshot-not-found`, `desktop-import-token-rejected`, …) and was **not** ported verbatim; `@jini/cli` ships a small generic default table (`daemon-not-running`, `missing-input`, `invalid-flag`) and lets a pack register additional `code → exitCode` entries, mirroring how `@jini/core`'s `PackContainer` scopes what a pack can see rather than exposing one global mutable map. |
| `postJsonToDaemon` | `cli.ts:5672` | **GENERIC** | `fetch(POST) → parse JSON → map daemon error envelope through the structured-error path` is pure HTTP-client-mode transport plumbing, reusable by any pack's `cli` registrar. Ported, generalized to accept the caller's own exit-code table instead of reading the module-level `RECOVERABLE_EXIT_CODES`. |
| `readPromptFromFlags` | `cli.ts:9225` (also duplicated/near-duplicated at `cli.ts:9229` inline in `automation`, `readMemoryPromptFile` at `cli.ts:8469`, and the `body`/`body-file` variant `readMemoryBodyFromFlags` at unread call site) | **GENERIC** | The `--prompt <text>` / `--prompt-file <path>` / `--prompt-file -` (stdin) convention recurs verbatim across `brand create`, `project create-design-system`, `run start`, `run redesign`, `files version-create`, `automation source ingest`, `memory rule add` — a real, repeated CLI convention with zero OD nouns in its own logic. Ported once as `readPromptFromFlags`; the OD callers each additionally support a `--body`/`--body-file` synonym pair, which was not ported (that naming choice is caller-specific, not part of the primitive). |
| Root dispatcher shape (`SUBCOMMAND_MAP`, first-non-flag-token routing) | `cli.ts:308-342`, `488-494` | **GENERIC** (pattern only) | "Look at the first positional arg, dispatch to a registered handler, fall through to root help" is the generic shape `@jini/cli`'s pack-registrar (`cli?: (reg, services) => void` per `packages/core/src/pack.ts`) needs. OD's actual `SUBCOMMAND_MAP` object (33 entries, all OD command names) was not ported — only the registrar pattern (`CommandRegistry.add(name, handler)` + `CommandRegistry.dispatch(argv)`) it implies. |
| Help-text rendering | `printRootHelp` (`cli.ts:530`) + every per-command `print*Help` function | **GENERIC** (pattern only); OD (content) | Every OD help string is 100% product content (mentions "od media generate", "Open Design daemon", plugin marketplace, …) and was not ported. What's generic is the *shape*: each command owns a `usage()` string, the root dispatcher aggregates them into a `--help`/no-args fallback. Ported as a minimal `renderUsage(lines: string[])` helper plus the convention that a registered command supplies its own usage text — no baked-in text. |
| `export` | `cli.ts:379` `runExport` + `export-cli-request.ts` + `export-cli-routing.ts` | OD | PDF/image/PPTX rasterization through OD's desktop Chromium renderer, `@open-design/contracts` `EXPORT_FORMATS`, project-scoped `/api/projects/:id/export/*` routes. No generic-engine equivalent exists (`@jini/deploy`'s `DeployTarget` is a different concern — publishing, not rendering). |
| `amr` | `cli.ts:625` `runAmr` | OD | OD's "Vela"/AMR wallet + account integration (`/api/integrations/vela/*`). Pure OD product feature. |
| `research search` | `cli.ts:692` `runResearch`/`runResearchSearch` + `research/cli-args.ts` | OD | Proxies Tavily search through `/api/research/search`. `research/cli-args.ts`'s `splitResearchSubcommand` is a trivial 10-line helper fully subsumed by the generic dispatcher pattern above — not separately portable. |
| `artifacts` | `cli.ts:749` `runArtifacts` + `artifacts-cli.ts` (152 lines) | OD | OD's normal-artifact creation flow (`/api/projects/:id/artifacts` via `postCreateArtifactRequest`), project/name/manifest-scoped. |
| `media generate` / `media wait` | `cli.ts:772-1005` | OD | OD's image/video/audio generation dispatcher. **Explicit overlap note**: `@jini/media` is being built as its own package in parallel — this group's eventual generic home (if any) is that package, not `@jini/cli`. Not ported here either way. |
| `mcp` / `mcp install` | `cli.ts:1148-1465` | **UNCLEAR** | MCP (Model Context Protocol) itself is a real, non-OD-specific, standardized protocol — a generic "`@jini/cli` runs a stdio MCP server proxying to the daemon" feature is plausible. But this implementation's actual tool surface (`list_projects`, `get_artifact`, `get_project`, `get_file`, `search_files`, `create_artifact` — all defined in `./mcp.js`, not read in this pass since it's not `cli.ts` itself) is entirely OD's project/file model. `mcp install <agent>` (`runMcpInstall`, `resolveMcpLaunchSpec`, `mcp-agent-install.ts`) wires a coding agent's *own* config to point at this OD-shaped server. Verdict left open rather than guessed: whoever picks this up next should decide whether "`@jini/cli` can host a generic MCP server for an arbitrary pack's tools" is worth building now, versus deferring until a second MCP-consuming pack exists (extraction-plan §7's two-consumer rule). |
| `plugin` (all ~40 subcommands: `list/search/stats/sources/info/manifest/install/upgrade/uninstall/apply/duplicate/canon/diff/doctor/replay/trust/snapshots/simulate/verify/events/run/scaffold/validate/pack/candidates/login/whoami/export/publish/publish-repo/open-design-pr/yank`) | `cli.ts:1540-4634` (largest single group, ~3,100 lines) | OD | OD's plugin marketplace + capability-grant + GitHub-backed community-catalog ecosystem. Hardcodes `nexu-io/open-design` as the upstream PR target (`runPluginOpenDesignPr`), shells out to `gh` for repo publishing (`execGhBuffered`/`spawnGhPassthrough`/`runPluginPublishRepo`). This is a real product ecosystem (registries, trust tiers, capability grants, snapshot replay), not a generic engine concern — matches the task brief's own strong-candidate call. |
| `marketplace` | `cli.ts:2015-2240` | OD | Federated plugin-catalog registration/search/trust, same ecosystem as `plugin`. |
| `ui` (`list/show/respond/revoke/prefill`) | `cli.ts:4640-4879` | OD | OD's GenUI surface inbox — form/choice/confirmation/oauth-prompt surfaces scoped to a `runId`/`projectId`. Not a kernel concept (`ToolExecutor`'s `ExecutionDelegate` per extraction-plan §2.5 is the closest kernel analog, but it's a callback contract, not a CLI surface). |
| `share` | `cli.ts:4950-5037` | OD | Social-share link builder for the OD repo / a deployed OD project (`/api/social-share`). |
| `figma` | `cli.ts:5039-5156` | OD | Figma-file import into an OD project, including `.fig` offline decode and an OAuth migration-scenario run via `pluginId: 'od-figma-migration'`. |
| `brand` / `brands` (`list/create/extract/continue/preview/finalize/extract-from-html/get/show/delete/remove`) | `cli.ts:5192-5607` + `brands-cli-help.ts` | OD | OD's Brands library — extraction pipeline that registers a `user:<id>` design system under the hood. |
| `project` (`create/create-design-system/duplicate/import/import-folder/list/info/delete/editors/open-in/handoff`) | `cli.ts:5709-5977` + `handoff-cli.ts` | OD | Every verb is scoped to OD's `Project` entity, which extraction-plan §2.1 explicitly excludes from the kernel ("NO projects... in the kernel"). `handoff` additionally imports `@open-design/contracts/api/handoff` types. |
| `run` (`start/list/info/cancel/watch/redesign/result-package`) | `cli.ts:5979-6226` | OD (bodies); see UNCLEAR row below for the streaming *pattern* | Every request body carries `projectId`/`skillId`/`pluginId`/`conversationId`/`designSystemId` — OD product nouns, not `@jini/protocol`'s `Run`. Not portable as-is. |
| `shell` | `cli.ts:6228-6348` | OD | Interactive PTY attached to a *project's* working directory (`/api/projects/:id/terminals`), raw-mode TTY bridging. Project-scoped, not a kernel concern. |
| `files` (`list/read/write/upload/delete/diff/versions/version-read/version-create/version-restore`) | `cli.ts:6350-6749` | OD | OD's project file/workspace + HTML-version-history domain. The unified-diff algorithm (`createUnifiedDiff`, `diffLineBody`, LCS-based) is generic *code* but operationally pointless to extract on its own — it only exists to diff two project files fetched from OD-specific routes. |
| `templates` | `cli.ts:6751-6910` | OD | OD's saved-project-template store (`NewProjectPanel`/`ExamplesTab` mirror), `/api/templates`. |
| `conversation` / `chat` | `cli.ts:6912-7073` | OD | OD's `Conversation` entity (also excluded from the kernel by §2.1), including Side-Chat fork/seed semantics. |
| `daemon start` | `cli.ts:7091-7122`, `7232-7261` | OD | Boots the *entire* OD desktop daemon (browser auto-open, `startDaemonRuntime` from `daemon-startup.js`, `OD_PORT`/`OD_BIND_HOST` env vars). This is OD's product bootstrap, not a generic "start `@jini/daemon`" concern — `@jini/node-host`'s `createLocalNodeDaemon` (per extraction-plan §2.4) is the actual generic analog, and it is not a CLI subcommand in this codebase's design (it's a composition preset a consumer calls from code). |
| `daemon db` (`status/verify/vacuum`) | `cli.ts:7124-7230` | OD | Introspects OD's own SQLite schema (plugin/snapshot tables specifically named in the help text). `@jini/sqlite`'s conformance suite (extraction-plan §8 task 8) is the generic-engine equivalent of "is my DB healthy," and it doesn't exist as a CLI surface here. |
| `daemon status` / `daemon stop` (bare, no `db`) | `cli.ts:7263-7293`, aliased as bare `status` at `cli.ts:7965` | **UNCLEAR** | The *pattern* — "hit a health endpoint, print `{bindHost, port, version, pid}`-shaped status; POST a shutdown endpoint" — is a plausible generic `@jini/cli` "daemon" command once `@jini/http` defines an equivalent route. Today `@jini/http` is a stub (`packages/http/src/index.ts` is a one-line placeholder) with no `/status`/`/shutdown` route to call, and OD's actual response fields (`installedPlugins`, `bindHost`) are OD-shaped. Not portable today; flagged rather than guessed at. |
| `atoms` (`list/show/info`) | `cli.ts:7307-7384` | OD | OD's first-party design-atom catalog + bundled `SKILL.md` bodies. |
| `library` (`list/get/rm/search/import/apply/edit-as-page/figma/sync/pair`) | `cli.ts:7416-7632` | OD | OD's design-asset library (images/design-systems/fonts captured via the browser-extension "Clipper"), `/api/library/*`. |
| `skills` / `craft` / `design-systems` (incl. `download/import-local/import-github/import-shadcn/rebuild-token-contract/rename`) | `cli.ts:7634-7963` + `design-systems-cli-help.ts` + `tools-design-systems-cli.ts` | OD | OD's skill/craft/design-system library and pull-layer file access. `tools-design-systems-cli.ts` (`od tools design-systems read`) is the agent-runtime-invoked sibling of the same feature. |
| `status` (bare alias) | `cli.ts:7965-7968` | **UNCLEAR** | Pure alias of `daemon status` — see that row. |
| `diagnostics export` | `cli.ts:7980-8041` | OD | Bundles daemon/web/desktop logs + machine info via `@open-design/diagnostics`, mirrors Settings → About → Export diagnostics. |
| `version` | `cli.ts:8043-8062` | **UNCLEAR** | Same shape as `daemon status`: hits `/api/version`, prints a string. Trivial to build generically once `@jini/http` has a version route; not portable today for the same "nothing to call" reason. |
| `doctor` | `cli.ts:8081-8188` | OD | Composite health check purpose-built for OD: daemon status + every installed plugin's doctor + skills/design-systems/atoms inventory. |
| `config` (`list/get/set/unset`) | `cli.ts:8190-8301` | OD | Wraps OD's own `/api/app-config` — provider API keys, "orbit settings," "pet config" per the source comment. Generic-shaped (GET/PUT a key-value bag) but the store itself is OD's app settings, not a kernel concept; `@jini/core`'s token/bindings system is the engine's actual generic configuration mechanism, and it's compile-time/composition-time, not a runtime CLI-editable bag. |
| `memory` (`tree/profile/rule/verify/config`) | `cli.ts:8311-9082` (~770 lines) | OD | OD's editable markdown memory tree injected into agent prompts — a specific product feature, not `@jini/daemon`'s `EventLog`/`RunLifecycle`. |
| `automation` (`template/source/proposal/list/get/create/update/run/runs/crystallize-run/pause/resume/delete`) | `cli.ts:9083-9885` (tail of file, ~800 lines) | OD | OD's Automations/routines feature (`/api/routines`, `/api/automation-*`). Unrelated to `automation/` at the Jini repo root (that's the AI-dev-shop control plane; this is OD's scheduled-agent-run product feature — exactly the kind of same-word-different-domain collision extraction-plan §12 C5 warns about). |
| `tools connectors` / `tools design-systems` / `tools live-artifacts` (`od tools ...`) | `cli.ts:496-525` dispatch + `tools-connectors-cli.ts` (2,830 lines) + `tools-design-systems-cli.ts` + `tools-live-artifacts-cli.ts` | OD | Agent-runtime-invoked wrapper commands (env vars `OD_NODE_BIN`/`OD_BIN`/`OD_DAEMON_URL`/`OD_TOOL_TOKEN`) for OD's connector/design-system/live-artifact tool surfaces. |
| `mcp live-artifacts` | `cli.ts:477-486` + `mcp-live-artifacts-server.js` (not read; out of scope, not `cli.ts`) | OD | Same live-artifacts domain as above, exposed as an MCP server. |
| codex MCP install wrapper | `codex-cli.ts` (121 lines) | OD | Thin `codex mcp add/remove/get` shell-out backing OD's Settings-panel "Install to Codex" toggle. Product UI plumbing, not CLI transport. |
| `execGhBuffered` / `spawnGhPassthrough` / `execFileBuffered` / `spawnPassthrough` (GitHub CLI process helpers) | `cli.ts:1888-1944` | OD | Named in the task brief as a "shared infra" candidate, but on inspection every call site is plugin-publishing (`plugin login/whoami/publish-repo/open-design-pr`) — there is no generic-transport caller. `execFileBuffered`/`spawnPassthrough` (the non-`gh`-specific halves) are marginally reusable "run a child process, buffer output" utilities, but nothing in the GENERIC bucket needs to shell out to a subprocess, so they were left with their only real caller (`plugin`) rather than extracted speculatively. |

## Deferred (explicit follow-ups, not silently dropped)

1. **Real daemon-URL discovery.** `resolveDaemonUrl` in this package accepts an injected `discover(env, timeoutMs) => Promise<string | null>` callback instead of assuming `@jini/sidecar`'s wire protocol; no adapter wiring `@jini/sidecar`'s actual NDJSON-IPC surface (`packages/sidecar/source-map.md`) to that callback was built in this pass. A follow-up should add a `packages/sidecar`-backed default discovery function once `@jini/sidecar`'s status-snapshot message shape is confirmed stable.
2. **`daemon status` / `daemon stop` / `version`** (the three UNCLEAR rows): buildable as real generic `@jini/cli` commands once `@jini/http` (currently a stub) defines equivalent routes. Left unbuilt rather than built against routes that don't exist.
3. **`mcp` bucket**: left as an open question per the UNCLEAR row above; needs a decision on whether a generic MCP-hosting feature belongs in `@jini/cli` before a second consumer exists (extraction-plan §7 two-consumer rule).
4. **`run watch`'s SSE→NDJSON streaming shape** (`streamRunEvents`, `cli.ts:6195-6226`): the mechanics (GET an SSE endpoint, translate frames to one-NDJSON-line-per-event on stdout, stop at a terminal `'end'` event) are a clean pattern that should inform a future generic `jini run watch <runId>` once `@jini/http` exposes a route over `@jini/daemon`'s `EventLog`. Not built now — there is no route to call — but recorded here so the next person doesn't have to re-derive the shape from OD's implementation.
5. **The OD-PRODUCT-SPECIFIC bucket itself** — none of it was ported, per the task's explicit instruction. This table exists so a future task porting `@jini/projects` (or whatever the eventual "project" pack turns out to be named — no such package is in the locked §3 set as of this writing) has a ready-made map of exactly which `cli.ts` verbs it would need to re-home, rather than re-reading the 9,885-line source from scratch.

## What was ported

See `packages/cli/src/`: `flags.ts` (`parseFlags`, `positionalArgs`), `daemon-url.ts`
(`resolveDaemonUrl`), `errors.ts` (`exitWithStructuredError`, `structuredHttpFailure`,
`CliExitCodes` default table), `http.ts` (`postJsonToDaemon`, `surfaceFetchError`),
`prompt.ts` (`readPromptFromFlags`), `usage.ts` (`renderUsage`), `command-registry.ts`
(`CommandRegistry`, the `SUBCOMMAND_MAP`-shaped dispatcher), `tokens.ts` (`CliTransportToken`
etc., following `packages/daemon/src/tokens.ts`'s naming precedent), `index.ts` (barrel).

## Dependencies

`@jini/core` (workspace) for `token()` — see `src/tokens.ts`. No `@open-design/*`
package is imported anywhere in `packages/cli/src/` (verified by `pnpm guard`'s
OD-noun/import lint, extraction-plan §7). Node built-ins only
(`node:process`, `node:fs/promises` for `readPromptFromFlags`'s file-read path).

## Barrel branch reconciliation (`cli-capability-barrels`, 2026-07-18)

A later task re-checked this package against OD's `cli-capability-barrels`
branch (`git diff --stat main...cli-capability-barrels`: 115 files, the bulk
of which is an unrelated `design-systems/` capability-barrel refactor that
rode along on the same branch — ignored, out of scope for `@jini/cli`). That
branch decomposes the same 9,885-line `cli.ts` this package was already
ported from into a `cli/` directory (`core/` foundation kernel + one
subdirectory per `od <subcommand>` family), per its own
`apps/daemon/src/cli/README.md`: "mechanical, byte-identical moves — 252/253
declaration bodies verified identical." Verified independently rather than
trusted: diffed `cli/core/flags.ts`, `daemon-url.ts`, `errors.ts` against
this package's existing `flags.ts`/`daemon-url.ts`/`errors.ts` — same logic,
confirming no new port work there.

**Two genuinely new, generic, OD-noun-free helpers found and ported** (both
absent from the original `cli.ts`-based pass — this barrel is the first
place they were read):

- **`coerceCliValue`** (`cli/core/flags.ts:108`) — `'true'`/`'false'` →
  boolean, a numeric literal → `number`, else pass through. Used by two
  independent domains (`cli/system/config.ts:91,93` and
  `cli/plugin/manage.ts:965` — `git grep coerceCliValue` on the branch
  confirms both call sites), the same two-domain-reuse bar this package's
  existing helpers were held to. Ported into `flags.ts` as `coerceCliValue`
  (`CoercedCliValue` return type), tests in `__tests__/flags.test.ts`.
- **`readMemoryBodyFromFlags`** (`cli/core/io.ts:15`) — the `--body`/
  `--body-file`/stdin sibling of the already-ported `readPromptFromFlags`,
  reused by `cli/memory/memory.ts:423` and `cli/automation/automation.ts:316`
  (two independent domains, per `git grep readMemoryBodyFromFlags` on the
  branch — the module's own docblock says as much: "Used by both the memory
  and automation domains"). This was looked at and explicitly *not* ported
  in the original pass (see the `readPromptFromFlags` row above: "the OD
  callers each additionally support a `--body`/`--body-file` synonym pair,
  which was not ported") — on closer reading here, that verdict undersold
  it: it isn't a caller-local synonym, it's an independently-reused sibling
  primitive with different semantics (empty `--body` counts as provided,
  unlike empty `--prompt`; stdin is drained via async-iteration, not
  event listeners). Ported into `prompt.ts` as `readBodyFromFlags` (de-branded
  name — no memory-domain coupling in the logic itself), tests in
  `__tests__/prompt.test.ts`.

**`LIBRARY_STRING_FLAGS`/`LIBRARY_BOOLEAN_FLAGS`** (`cli/core/flags.ts:16-19`,
shared by the library and system domains) were considered and declined: these
are literal flag-name whitelist data (`daemon-url`/`query`/`tag`,
`help`/`h`/`json`), not parsing logic — a caller can already express the same
thing as `new Set([...])` against this package's existing `parseFlags`. Same
reasoning the original pass used to decline porting OD's actual
`SUBCOMMAND_MAP` object: only the *mechanism* is generic, not the specific
name list.

**`streamRunEvents`** (`cli/core/run-events.ts`) — re-read, still correctly
deferred. Confirms deferred-item 4 above: no `@jini/http` route to call yet.

**`daemon start`** (`cli/system/daemon.ts` `runDaemonStart`) — re-read, still
correctly OD/blocked. It calls `startDaemonRuntime` from
`daemon-startup.js` (OD's product bootstrap), the exact piece this task was
told not to build (blocked on `@jini/node-host`'s `createLocalNodeDaemon`,
in flight on a separate, not-yet-merged branch as of this writing).

**Two rows re-verified as UNCLEAR-but-newly-buildable, deliberately still
not built:**

- **`daemon status` / `daemon stop`** (`cli/system/daemon.ts`
  `runDaemonStatus`/`runDaemonStop`) — the original UNCLEAR verdict's
  blocking condition ("`@jini/http` is a stub... no `/status`/`/shutdown`
  route to call") **no longer holds**: `@jini/http` now ships
  `daemonStatusRoute`/`daemonShutdownRoute` (`packages/http/src/daemon-status.ts`,
  merged in a later task than this package's original port). Not built
  here anyway, for two reasons: (1) the response shapes differ (`@jini/http`'s
  `DaemonStatusResponse` has `host`/`pid`/`dataDir`/`shuttingDown`, no
  `installedPlugins`; OD's has `bindHost`/`installedPlugins`, no `pid`) —
  encoding one shape into a concrete CLI command ahead of any actual consumer
  would be guessing at a contract nobody has committed to yet; (2) this
  package's own `index.ts` docblock already states "no pack has registered
  against `CommandRegistry` yet because no HTTP-client-mode pack exists in
  this repo to call" — building the *first* concrete command here, before any
  consumer, risks exactly the "declared port whose implementation doesn't
  hold up" failure mode this repo's audit history warns about (see
  `packages/memory/source-map.md`'s discussion of the same risk for
  `memory-llm.ts`). Left as a flagged, Coordinator-level opportunity, not a
  guess.
- **`mcp install`** (`cli/mcp/install.ts` `runMcpInstall`) — similarly
  newly-buildable-in-principle: `@jini/mcp` (merged after this package's
  original port) now has the agent-slug planner and JSON apply/remove
  primitives (`packages/mcp/src/agent-install/install.ts`) this command
  would wrap. Not built here for the same reason as above, plus the original
  UNCLEAR verdict's own open question — "whether '`@jini/cli` can host a
  generic MCP server for an arbitrary pack's tools' is worth building now,
  versus deferring until a second MCP-consuming pack exists
  (extraction-plan §7's two-consumer rule)" — is unresolved by anything found
  in this reconciliation pass; it is an architecture call, not a helper-port
  delta.

No other files under `cli-capability-barrels`'s `cli/` tree were found to
contain generic, OD-noun-free, currently-missing logic; every remaining
subdirectory (`automation/`, `brand/`, `export/`, `figma/`, `library/`,
`media/`, `memory/`, `plugin/`, `project/`, `research/`, `share/`,
`templates/`, `ui/`) is product-command implementation over OD's REST API,
matching the OD verdicts already recorded in the classification table above.

## 2026-07-21 addition — the first concrete `run` commands (`feat/http-routes-and-cli-commands`)

This package's own "What was ported" section above already ends with: "no pack has registered
against `CommandRegistry` yet because no HTTP-client-mode pack exists in this repo to call." That
gap is what this addition closes — not a port from OD's `cli.ts` (that file's `run` subcommand,
per the classification table's own `run` row, is OD-bodied: every request carries
`projectId`/`skillId`/`pluginId`/`conversationId`/`designSystemId`, none of which exist in the
kernel). Instead, `run-command.ts` is a fresh, thin CLI transport over `@jini/http`'s actual run
routes (`packages/http/src/runs.ts`, all already real on this branch): `POST /api/runs`,
`GET /api/runs` (added alongside this task — see `packages/http/source-map.md`'s matching entry),
`POST /api/runs/:runId/cancel`, and `GET /api/runs/:runId/events` (SSE).

**Commands added**: `run start --context-ref <ref> [--agent-id <id>] [--idempotency-key <key>]`,
`run list [--context-ref <ref>]`, `run cancel <runId> [--reason <text>]`, and
`run watch <runId> [--after-cursor <cursor>]`. Each parses its own flags via this package's
existing `flags.ts`, resolves the daemon base URL via a caller-supplied `resolveBaseUrl` callback
(deliberately not wired to a concrete `resolveDaemonUrl()` call here — that decision belongs to
whatever pack registers these commands for real, matching this file's stance of staying
transport-thin), calls `postJsonToDaemon`/`getJsonFromDaemon` exactly as they already exist, and
prints the daemon's JSON response. `registerRunCommands(registry, deps)` registers a single `run`
top-level command against `CommandRegistry` and hand-dispatches its first remaining token to one
of the four handlers (the same "look at the next token, dispatch, fall through to usage" shape
`command-registry.ts` itself documents as ported from OD's root router) — a pack that also
supports the CommandRegistry's `override` option can replace it.

**`getJsonFromDaemon` — a new sibling to `postJsonToDaemon`, not a rewrite.** `http.ts`'s
`postJsonToDaemon` was POST-only; `run list` and `run watch`'s initial SSE-stream request are GET
requests, and the task's own ground rules require reusing this package's already-hardened
transport rather than reintroducing unbounded I/O or raw error disclosure for a new GET path. The
POST-specific body/timeout/size-cap/structured-error logic was extracted into a private
`requestJsonFromDaemon(base, route, {method, body?}, options)`; `postJsonToDaemon` and
`getJsonFromDaemon` are now both thin wrappers over it that only fix `method`/`body` at their own
call site. This is a behavior-preserving extraction, verified by re-running the pre-existing
`http.test.ts` unchanged against the refactored file before adding a single new test — all 27
original assertions still pass byte-for-byte. `getJsonFromDaemon` carries the identical
timeout/size-cap/structured-error/redaction contract; it just never sends a body or a
`content-type` header.

**`run watch`'s SSE consumption — the mechanics this package's own deferred-item 4 above named,
now built.** No existing SSE client existed anywhere in `@jini/cli` to reuse (the CLI package had
never consumed a streaming response before this). `readSseFrames` parses the wire format
`@jini/http`'s `runs.ts` `formatSseEvent` actually emits (`id: <cursor>\nevent: <kind>\ndata:
<json>\n\n`) into one frame per blank-line-terminated block, translating each to one NDJSON line
on stdout and stopping at the canonical `RunProtocolEvent` terminal `'end'` kind — exactly the
pattern this file's own module docblock and this package's `source-map.md` (in the section above)
described as the target shape. A frame with no `data:` line (e.g. a bare heartbeat/comment) is
silently dropped rather than emitted as an empty line. Per this task's own ground rules (bounded
I/O, no unbounded reads), the frame-accumulation buffer is capped at 10MB (mirroring `http.ts`'s
`readJsonWithLimit` byte cap) — a daemon that never terminates a frame cannot grow memory without
bound; exceeding the cap (or any other stream-read failure) exits via the same structured-error
contract as every other failure in this file, not as an unhandled rejection. Each frame's `data` is
run through `redact.ts`'s `stripControlSequences` (not the fuller `sanitizeUntrustedText`, which
also truncates and secret-redacts) before being written: it is untrusted network content from a
prompt-influenced agent run and must not be able to inject terminal escapes, but it is the run's
actual event payload the user asked to watch, not incidental diagnostic text, so it is not
truncated or redacted the way an error message is.

**Not built**: a concrete `resolveDaemonUrl()`-backed default for `resolveBaseUrl`, and a `run get
<runId>` command (the underlying `GET /api/runs/:runId` route already exists in
`packages/http/src/runs.ts` but was not asked for in this pass's exact four-command scope — a
trivial follow-up given the route is real). Also not built: any wiring of this file's commands
into an actual bootable CLI entrypoint (`packages/cli/src/index.ts` remains a barrel only, per
extraction-plan's node-host/CLI-bootstrap gap) — `registerRunCommands` is ready for a future pack
to call, matching this package's established "no pack has registered yet" caveat.

Tests: `src/__tests__/run-command.test.ts` (46 tests) plus `src/__tests__/http.test.ts`'s new
`getJsonFromDaemon` describe block — 100% coverage on all 4 metrics for both `run-command.ts` and
the touched portions of `http.ts`'s new code paths (the pre-existing `readJsonWithLimit`
content-length/`.text()`-fallback gaps in `http.ts` predate this task and were not introduced or
widened by it — confirmed by diffing coverage against the unmodified file before this change).

## Dependencies (updated)

No new dependency. `run-command.ts` uses only this package's own existing exports
(`flags.ts`/`errors.ts`/`http.ts`/`redact.ts`/`usage.ts`/`command-registry.ts`) plus Node/Web
platform primitives (`fetch`, `ReadableStream`, `TextDecoder`) already implicitly available in
this package's runtime target.

## 2026-07-21 addition — `daemon status` / `daemon stop` commands (backlog pass)

Closes the two `UNCLEAR` rows this file's classification table names for `daemon status`/`daemon
stop`: the blocking condition ("`@jini/http` is a stub... no `/status`/`/shutdown` route to call")
no longer holds — `daemonStatusRoute`/`daemonShutdownRoute` (`packages/http/src/daemon-status.ts`)
have existed since the 2026-07-18 backend-routes port, and this file's own barrel-branch
reconciliation section already re-verified that months ago without building against it "to avoid
guessing at a contract nobody has committed to yet." That caveat no longer applies either: this
same package's `run-command.ts` (the section directly above) is now a real, tested, established
"first concrete command" precedent — `daemon-command.ts` follows the exact same shape rather than
pioneering a new one.

**Commands added**: `daemon status` (`GET /api/daemon/status`) and `daemon stop`
(`POST /api/daemon/shutdown`, an empty JSON body). Same `resolveBaseUrl`-callback,
`postJsonToDaemon`/`getJsonFromDaemon`-transport, print-the-JSON-response shape as
`run-command.ts`; `registerDaemonCommands(registry, deps)` registers a single `daemon` top-level
command dispatching `status`/`stop` on the next token.

**The shutdown route's `requireSameOrigin: true` gate needs no special handling from a CLI
caller.** A bare `fetch()` sends no `Origin` header; `guardSameOrigin`/`isLocalSameOrigin` falls
through to its Host-header check in that case, which passes as long as the resolved daemon URL's
host:port is one the daemon itself considers local (`packages/http/src/origin-validation.ts`'s
`isAllowedBrowserHost`) — the same call shape `run-command.ts` already uses, no extra headers
added here.

**Not built**: `version` (the third original `UNCLEAR` row, `GET /api/version`) — `@jini/http` has
no version route yet (`daemonStatusRoute`'s own `version` field is caller-injected, not a
standalone endpoint), so there is still nothing to call. Also not built: `daemon db`/`db verify`/
`db vacuum` (depend on a `storage/db-inspect.ts` port `packages/http/source-map.md` already notes
as not built), and real `@jini/sidecar`-backed daemon-URL discovery (`resolveDaemonUrl`'s injected
`discover` callback remains unwired — a separate backlog item, tracked independently).

Tests: `src/__tests__/daemon-command.test.ts` (19 tests) — 100% coverage on all 4 metrics,
including both commands' `--help`/default-writer/default-fetch paths, the shutdown POST body
shape, structured-error exits (both daemon-rejected and unknown-subcommand), and
`exitCodes`-table pass-through on both the success and error paths. No new dependency.

## 2026-07-21 investigation — real `@jini/sidecar`-backed daemon-URL discovery, still correctly not built

Checked whether `resolveDaemonUrl`'s injected `discover` callback (deferred-item 1 in this file's
own "Deferred" section, and its own barrel-branch-reconciliation section) is buildable yet. It is
not, and this is a confirmed finding, not a guess: `@jini/sidecar`'s `createJsonIpcServer` (per
`packages/sidecar/source-map.md`) is a fully generic, contract-driven NDJSON-over-socket/pipe
server — but `grep -rln "requestJsonIpc\|createJsonIpcServer\|bootstrapSidecarRuntime"
packages/node-host/src packages/daemon/src` finds zero call sites. `@jini/node-host`'s
`createLocalNodeDaemon` (`packages/node-host/src/create-local-node-daemon.ts`) resolves and
returns a real `LocalNodeDaemon.baseUrl` (see `resolveBoundPort`/`resolveReportHost`), but only
in-process, to whatever code called `createLocalNodeDaemon` directly — nothing persists that URL
anywhere a *separate* CLI process could find it (no IPC status server, no port file, no pidfile).

Building a CLI-side `discover()` implementation now would mean inventing an IPC message
contract/shape unilaterally inside a CLI backlog task and hoping a future daemon-side server
matches it — precisely the "declared port whose implementation doesn't hold up" failure mode this
file's own `daemon status`/`daemon stop` UNCLEAR-verdict history already declined twice (first
when `@jini/http` had no route to call, described above). Not built for the same reason. A real
fix needs daemon-side work first: `@jini/node-host`'s `createLocalNodeDaemon` (or a wrapping CLI
bootstrap) would need to boot a `@jini/sidecar` IPC server exposing at minimum a "status" message
`{host, port}` (or write a discoverable port/pidfile) before this package's `discover` callback has
anything real to probe. Tracked as a separate, node-host-scoped backlog item, not a `@jini/cli` one.

## 2026-07-21 addition — real local daemon-URL discovery (`local-daemon-discovery.ts`)

Closes deferred-item 1 above and the investigation immediately preceding this section: the
daemon-side prerequisite ("write a discoverable port/pidfile") is now built —
`@jini/node-host`'s `createLocalNodeDaemon` writes a `@jini/sidecar`-backed on-disk registry
record once it starts listening (see that package's own 2026-07-21 source-map.md entry, and
`@jini/sidecar`'s matching entry for the low-level `daemon-registry.ts` primitives). This addition
is the missing CLI-side reader for that record — a port/pidfile, not the IPC-server shape the
investigation above considered and declined ("no `@jini/sidecar` IPC server" was never actually
required — a flat JSON pointer file, read once, is sufficient for "find a URL," and doesn't need a
live daemon round-trip to work when the daemon might not even be running).

**`createLocalDaemonDiscovery({ dataDir } | { registryPath })`** builds a
`resolveDaemonUrl({ discover })`-compatible probe: it reads the registry record via
`@jini/sidecar`'s `readLiveDaemonRegistryRecord` (which already verifies the recording process's
pid is still alive — a stale record from a crashed daemon is never trusted, matching the task's
own "verify liveness, don't just trust the file" requirement) and returns its `url`, or `null`
when nothing live is found. Exactly like `resolveDaemonUrl` itself has no baked-in env var name or
default URL, this function has no baked-in `dataDir` — the caller (whatever wires a
`@jini/node-host` daemon and a `@jini/cli`-transport pack together for one product) supplies the
same `dataDir` (or an explicit `registryPath`, matching a non-default `discoveryFile` override on
the daemon side) to both sides. Throws synchronously at build time (not when the returned probe is
later invoked) if neither is given, matching this package's existing "fail loud on a caller
mis-config, don't silently no-op" stance (e.g. `resolveDaemonRegistryPath`'s own empty-`dataDir`
guard in `@jini/sidecar`).

The existing flag → env var → discover → default precedence in `resolveDaemonUrl` is untouched —
`createLocalDaemonDiscovery`'s output is just a value a caller may now pass as `discover`, proven
via a `resolveDaemonUrl` integration test showing an explicit flag still wins over local discovery,
and `defaultUrl` still applies when no live local daemon is found.

**Multiple daemons on one machine.** Not a new concern this addition had to design for: each
`createLocalNodeDaemon` call already requires its own `dataDir` (for its own sqlite file), and
`@jini/sidecar`'s registry path is derived from `dataDir` — so two daemons on one machine already
get two non-colliding registry records with zero extra configuration on either side.

**Tests**: `src/__tests__/local-daemon-discovery.test.ts` (7 tests) — discovery by `dataDir`,
discovery by explicit `registryPath` (proven to take precedence over a simultaneously-present
`dataDir`-derived record at a different port), `null` on a missing record, **`null` for a stale
record from a real spawned-then-awaited-exit child process** (not a mock — the actual "crashed
daemon" scenario), the build-time throw on missing config, and two `resolveDaemonUrl` integration
cases (flag beats discovery; discovery falls through to `defaultUrl`). 100/100/100/100 on
`local-daemon-discovery.ts`; package-wide `pnpm --dir packages/cli exec vitest run --coverage` is
99.68/98.47/97.36/99.68 (253 tests, 13 files) — the one pre-existing gap (`prompt.ts`,
97.7/88.4/85.71/97.7, lines 123-125) predates this change and was not introduced or widened by it.

## Dependencies (updated)

Adds `@jini/sidecar` (workspace) — `readLiveDaemonRegistryRecord`/`resolveDaemonRegistryPath`.
This is the first `@jini/cli` dependency on `@jini/sidecar`; both are in
`extraction-plan.md` §3's locked fourteen, so no `UNLOCKED.md` admission is needed
(`scripts/check-engine-boundaries.ts`'s R7 rule only restricts a locked package importing an
*unlocked* one).

## 2026-07-21 addition — `version` command, `run get <runId>`, and a bootable `jini` binary (`feat/http-routes-and-cli-commands`)

Three closely-related gaps closed in one pass: the last two `UNCLEAR`-then-deferred CLI surface
items, and the standing "no wiring of this file's commands into an actual bootable CLI
entrypoint" gap `run-command.ts`'s own 2026-07-21 addition section (above) flagged as not built.

**`version` command (`version-command.ts`, new file).** Closes the third original `UNCLEAR` row
this file's classification table names for `version` — the immediately-preceding `daemon
status`/`daemon stop` addition section explicitly left it unbuilt, reasoning "`@jini/http` has
no version route yet." On closer reading that was an overstatement: `daemonStatusRoute`'s
response body (`packages/http/src/daemon-status.ts`, `DaemonStatusResponse.version`) has carried
a `version` field the whole time — `daemon status` already prints it as part of the full status
envelope. No new HTTP route was needed; `versionCommand` just calls the same
`GET /api/daemon/status` route `daemon-command.ts` already calls and extracts+prints only the
`version` field. A 2xx response that omits (or mistypes) `version` exits via this package's
structured-error contract using the `daemon-not-running` code — the same fallback code
`structuredHttpFailure` itself already defaults to elsewhere — rather than inventing a new exit
code for this one caller. Same DI/testing/`resolveBaseUrl` conventions as `daemon-command.ts`'s
`daemon status`/`daemon stop` (this file duplicates rather than shares their small
`errorOptions`/`transportOptions`/`defaultWrite`/`defaultWriteErr` helpers, matching that file's
own precedent of each command module owning its copy). `registerVersionCommand(registry, deps)`
registers a single flat `version` command (no subcommands, unlike `run`/`daemon`).

Tests: `src/__tests__/version-command.test.ts` (17 tests) — 100/100/100/100 on all four coverage
metrics, including the missing-version-field path with both injected and default (real
`process.stderr`/`process.exit`) error sinks — the latter needed its own dedicated test distinct
from the "non-2xx daemon response" default-fallback test, since a 500 response is handled
entirely inside `http.ts`'s own `requestJsonFromDaemon` (its own default write/exit fallback) and
never reaches this file's `extractVersion`/`errorOptions` path at all; only a 2xx response missing
`version` does.

**`run get <runId>` (`run-command.ts`).** Wraps the already-real `GET /api/runs/:runId`
(`runStatusRoute`, `packages/http/src/runs.ts`) that `run-command.ts`'s original 2026-07-21
addition section explicitly named as "not built ... a trivial follow-up given the route is real."
`runGetCommand` follows `runCancelCommand`'s exact shape (positional `runId`, `missingInput` on
absent/empty, URL-encoded into the route, `getJsonFromDaemon` + `printJsonResult`).
`registerRunCommands`'s dispatcher gained a `case 'get'`; `RUN_USAGE` now reads
`run <start|list|get|cancel|watch> ...`. Tests added to the existing `run-command.test.ts`
(9 cases in a new `runGetCommand` describe block, plus one `registerRunCommands` dispatch case —
10 new tests total) — package-wide `run-command.ts` coverage remains 100/100/100/100 after the
addition.

**A bootable `jini` binary (`src/main.ts`, new file; `package.json` gains `"bin": { "jini":
"./dist/main.js" }`).** Until this file, every command module in this package was a library
building block only — `index.ts`'s own docblock said as much ("no pack has registered against
`CommandRegistry` yet because no HTTP-client-mode pack exists in this repo to call"), and nothing
actually parsed `process.argv`. `main.ts` is that entrypoint: a `#!/usr/bin/env node` shebang
file exporting a directly-testable `main(argv, deps)` plus a guarded top-level
`if (isMainModule) await main(process.argv.slice(2));` (the ESM equivalent of CommonJS's
`require.main === module`, using `fileURLToPath(import.meta.url) === process.argv[1]` — this
package's `packages/metatool/src/cli.ts` has a `#!/usr/bin/env node` shebang file but no such
guard and no `bin` wiring, since its `main` is never exported and only ever invoked via its own
top-level side effect; `main.ts` needed the guard specifically *because* it exports `main` for
unit testing, and an unguarded top-level call would fire on every test-file import). Deliberately
**not** re-exported from `index.ts` — that barrel must stay side-effect-free on import; a code
comment and `index.test.ts`'s new "does not export main.ts" case both guard against a future
accidental re-export.

Design decisions made in this pass, each documented in `main.ts`'s own module doc in full and
summarized here:

- **Daemon-URL resolution wires three already-built, previously-unconsumed pieces together**
  rather than inventing a fourth: an explicit `--daemon-url <url>` flag (highest precedence), a
  `JINI_DAEMON_URL` env var, and — when `--data-dir <path>` or `--registry-path <path>` is given
  — `local-daemon-discovery.ts`'s `createLocalDaemonDiscovery` (that module's own doc flagged
  itself as built-but-unconsumed; `main.ts` is that consumer). No baked-in `defaultUrl`: this
  package has never had a locked default daemon port (`@jini/node-host`'s
  `createLocalNodeDaemon` binds an ephemeral one), so with none of the three configured,
  `resolveDaemonUrl` throws and `main.ts`'s own error boundary (below) turns that into a clean
  structured-error exit rather than a silent wrong-port guess or a raw stack trace.
- **Global flags are stripped from `argv` in a single pass before dispatch**, not left for
  `CommandRegistry.dispatch`'s own `valueFlags` skip-ahead option. `valueFlags` correctly *finds*
  the command-name token when a global flag precedes it, but the `rest` array it then hands the
  matched handler still *contains* that leading flag+value ahead of whatever the handler expects
  as its own first token — harmless for a flat command, but `run-command.ts`/`daemon-command.ts`'s
  registered handlers immediately do their own second-level `const [sub, ...rest] = args`
  dispatch assuming `args[0]` is their immediate subcommand, with no tolerance for a stray leading
  flag. Rather than touch that already-tested, out-of-scope nested-dispatch assumption,
  `partitionGlobalArgv` (a dedicated single-pass scanner, not a `parseFlags` call — a strict
  known-flags `parseFlags` call would throw on any *subcommand's* own flag, and permissive-mode
  `parseFlags` doesn't reliably agree with "always consume the very next token" for a value flag
  immediately followed by another `--flag`) removes `--daemon-url`/`--data-dir`/`--registry-path`
  (and their values) from `argv` before any dispatch happens, so `run`/`daemon`/`version` always
  land as a clean first token no matter where on the command line those three flags were typed —
  including *between* a top-level command and its own subcommand token (`jini run --daemon-url
  <url> list`), which plain `valueFlags` skip-ahead could never have supported at all. Verified
  by a dedicated test proving exactly that interleaved-position case.
- **`--version`/`-v` (recognized only as the very first argv token) is a plain alias for `jini
  version`**, not a print of this package's own build number. `package.json` is `"private": true`
  with a placeholder `"0.0.0"` — not a real, published semver worth surfacing — so `--version`
  prints the *running daemon's* real version instead, which is arguably more useful to a user of
  a transport-only CLI, and keeps exactly one implementation (`version-command.ts`) to keep
  correct rather than two.
- **An error boundary around dispatch converts a raw, unhandled `Error` into this package's
  structured-error contract**, closing a real gap: `parseFlags` throws a plain `Error` for an
  unrecognized `--flag` or a value-less string flag (by design — see that module's own doc), but
  every existing command handler calls it unwrapped, so that throw would otherwise surface as an
  unhandled rejection with a raw stack trace instead of the `{ error: { code, message } }`
  envelope every *other* failure path in this package produces. The boundary must not, however,
  re-wrap an error that already represents a *legitimate* structured-error exit from a nested
  command (e.g. `run start`'s own `missing-input` on an absent `--context-ref`) — doing so would
  either double-report the same failure or mask the original exit code with a generic one. The
  fix: `main.ts`'s own `exit` wrapper (passed down to every registered command's `deps`) sets a
  local flag the instant it's invoked; the catch block re-throws untouched whenever that flag is
  already set, and only reformats a throw that reached the boundary with the flag still unset. In
  real operation (`process.exit`, which never returns) this distinction can never actually matter
  — nothing downstream of a real exit call ever reaches the catch — but it is exactly what makes
  this file's own tests (which, like every other test in this package, inject a *throwing* `exit`
  double to make that "never returns" behavior observable without ending the test process) able to
  assert on both cases correctly. Two dedicated tests prove each side: an unrecognized subcommand
  flag gets reformatted into `invalid-flag`, while a nested command's own `missing-input` exit
  passes through with its original code and message, called exactly once.

**The bin wiring itself.** `package.json`'s `build` script is now `tsc -p tsconfig.json && chmod
+x dist/main.js` — `tsc` preserves a leading `#!/usr/bin/env node` shebang line verbatim in
emitted JS (a long-standing, well-established compiler behavior; `packages/metatool/src/cli.ts`
already relies on the same preservation, though that package has no `bin` field to actually use
it), but it does not itself set the executable permission bit on the emitted file, so the `chmod
+x` step is required for `node_modules/.bin/jini` (or a global install) to be directly executable
rather than merely runnable via `node dist/main.js`. Verified by building for real (`pnpm --dir
packages/cli run build`) and confirming both the shebang line and the `rwxr-xr-x` permission bit
survive in `dist/main.js`, then smoke-testing `node dist/main.js` for the no-args/`--help`/
unknown-command/unreachable-daemon/missing-daemon-url/bogus-subcommand-flag cases end to end —
every one produced a clean single-line JSON error envelope with a sensible exit code, never a raw
stack trace.

Tests: `src/__tests__/main.test.ts` (30 tests, including three dedicated to the guarded
top-level-entrypoint block: real execution when `process.argv[1]` matches this module's own
resolved path via a fresh `vi.resetModules()` + dynamic `import()` — mirroring
`packages/metatool/src/__tests__/cli.test.ts`'s established pattern for getting real in-process
v8 coverage of a top-level side-effecting line — plus the two negative cases, non-matching path
and `process.argv[1]` undefined) — 100/100/100/100 on all four coverage metrics.

**Final package-wide numbers** (`pnpm --dir packages/cli test:coverage`, 15 files, 311 tests, all
passing): 99.73/98.72/97.8/99.73 (statements/branches/functions/lines). The one remaining gap is
`prompt.ts` lines 123-125, already documented in this file's previous addition as predating that
change; unchanged and not widened by this pass. `pnpm --dir packages/cli typecheck` and `pnpm
guard` (repo root) both clean.

### The `daemon start` scope question — re-affirmed, not re-opened

This task's own brief restated the standing architectural decision (`cli.ts:7091-7122`'s
classification-table row, reaffirmed in the barrel-branch-reconciliation section above) that
`daemon start` is OD's product bootstrap, not a generic `@jini/cli` concern, and explicitly
instructed against building it even if that reasoning seemed wrong, absent a flagged human
review. Nothing found in this pass changes that reasoning or the facts it rests on:
`@jini/node-host`'s `createLocalNodeDaemon` (the actual generic analog) remains, by
extraction-plan §2.4's own design, "a composition preset a consumer calls from code," not a CLI
subcommand — a `jini daemon start` would need to hardcode a concrete `dataDir`/port/host
composition decision that only a specific product (or `apps/reference-web`) actually owns, which
is precisely the kind of product-shaped decision this package's own `source-map.md` has
consistently kept out of `@jini/cli` (see the `daemon db`, `config`, and `memory` OD-verdict rows
above for the same pattern elsewhere). No new evidence surfaced to suggest this verdict should
change; it was not re-litigated further, and no `daemon start` command was added.

## Dependencies (updated)

No new dependency. `version-command.ts` and `main.ts` both use only this package's own existing
exports (`errors.ts`/`http.ts`/`usage.ts`/`command-registry.ts`/`daemon-url.ts`/
`local-daemon-discovery.ts`/`run-command.ts`/`daemon-command.ts`) plus Node built-ins
(`node:url`'s `fileURLToPath`, already indirectly available via `@jini/sidecar`'s own dependency
tree but now imported directly here for the first time).

## 2026-07-22 addition — genuine near-100% coverage: prompt.ts (audit fix)

`prompt.ts:123-125` (the original task item) plus several sibling gaps this pass's own fresh
coverage run surfaced (the prior text-reporter output truncated the uncovered-line list to just
the first entry):

- **`defaultReadStdin`'s already-aborted-before-reading-starts branch** (`reject(limits.signal.reason
  ?? new Error('stdin read aborted'))`, no test ever supplied an already-aborted signal to the
  stdin path specifically, only to the file path): new test.
- **`defaultReadFile`'s dead `typeof chunk === 'string'` branch**: `createReadStream` is never
  given an `encoding` option anywhere in this file (`ReadLimits` has no such field), so a 'data'
  chunk is always a real `Buffer`, never a `string` — genuinely dead code, not merely uncovered.
  Removed (a type assertion replaces the runtime branch, since `@types/node` still types the
  listener parameter as `string | Buffer` to accommodate a stream some other caller configured
  with an encoding).
- **`defaultReadFile`'s `finish()` idempotency guard** (`if (settled) return;`): re-derived, not
  assumed — Node's Readable stream contract guarantees at most one of 'end'/'error' fires, and
  `stream.destroy()` called with no error argument (the only way this file calls it) is documented
  to suppress any further 'error' emission from the destroy path itself. Genuinely unreachable
  through this file's own real `createReadStream` usage on a modern Node runtime; kept as real
  protection against a future Node version or non-conforming stream implementation, not forced —
  this package's `vitest.config.ts` threshold is set just below the measured 99.84% branch number
  rather than suppressed with a `/* v8 ignore */` comment, matching `@jini/registry`'s established
  precedent for the same category of finding.
- **`defaultReadStdin`'s `onError` handler**: never invoked by any test — new test emits a real
  `'error'` event on the faked `process.stdin`.
- **`defaultReadStdin`'s mid-read-abort `reason ?? new Error(...)` fallback**: the existing
  mid-read-abort test used a real `AbortController`, whose `signal.reason` is always a truthy
  `DOMException` on this Node runtime once aborted — never reaches the fallback. New test uses a
  minimal hand-built `AbortSignal`-shaped fake (`makeFakeSignal`, new test helper) with a
  controllable `undefined` reason.
- **`defaultReadBodyStdin`'s `addEventListener`/`onAbort`/`removeEventListener` (signal-present,
  not-yet-aborted) path**: every existing signal-based test for this function used an
  already-aborted signal, which short-circuits via `throwIfAborted()` before the abort listener is
  ever registered. New test uses `makeFakeSignal` plus a controllable async-generator fake stdin
  (parks mid-iteration on a promise the test resolves manually) so the abort genuinely fires after
  reading has started, exercising the real listener registration/invocation/teardown.
- **`defaultReadBodyStdin`'s Buffer-chunk branch**: every existing fake stdin fixture yielded
  `string` chunks; real `process.stdin`'s async iterator yields `Buffer` (this function never calls
  `setEncoding`). New test yields real `Buffer` chunks.

**Verified, personally, this session**: `pnpm --dir packages/cli exec tsc --noEmit`: clean.
`pnpm --dir packages/cli run test:coverage` — **317/317 tests pass** (12 new), package-wide
**100/99.84/100/100**, `prompt.ts` itself 100/98.64/100/100 with exactly the one documented branch
above remaining. Added a committed coverage threshold gate (`vitest.config.ts` had none before this
pass) at 100/99/100/100, matching this repo's established margin-below-measured convention.
