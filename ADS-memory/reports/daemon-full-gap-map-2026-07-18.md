# OD daemon → Jini: full gap map + port plan (2026-07-18)

**Purpose:** the user wants the *full functionality* of OD's daemon in Jini, not the
current thin kernel slice. This maps every top-level module of OD `apps/daemon/src`
(~174K non-test lines) against what actually exists in `@jini/*`, classifies each as
engine-generic vs OD-product, and gives a dependency-ordered build order to a
**runnable full daemon**. Approve/adjust the scope and order before any porting.

## How the presence column was established

Not asserted — measured. Five adversarial auditors verified the backend packages this
session against the real OD clone at `/Users/la/Desktop/Programming/OSS-Repos/open-design`.
Every "✅ ported" / "⚠️ partial" row below is backed by a diff- or test-level check
(daemon, cli, sqlite, node-host, http, protocol, core, sidecar, platform, agent-runtime).
Packages marked "(unaudited)" have a `@jini/*` counterpart that was NOT checked this
session (memory, registry, deploy, media) — treat their state as claimed, not verified.

Legend: ✅ ported & verified · ⚠️ partial · ❌ absent · 🟩 engine-generic · 🟦 OD-product · 🟨 mixed/triage

## A. DIRECTORIES in apps/daemon/src

| dir | lines | files | class | in Jini | where / gap |
|---|--:|--:|:--:|:--:|---|
| `routes` | 16,309 | 32 | 🟨 | ❌ | only status/shutdown pair in `@jini/http`; the generic run/artifact/health routes + all product routes absent |
| `brands` | 13,748 | 35 | 🟦 | ❌ | OD product; out of scope for neutral engine |
| `plugins` | 12,777 | 55 | 🟨 | ❌ | plugin *host* is engine infra (model on OD `packages/plugin-runtime`); marketplace/content is product. asset-cache already → `@jini/platform` |
| `runtimes` | 11,733 | 64 | 🟩 | ⚠️ | **execution primitives ported → `@jini/agent-runtime`**; lifecycle kernel → `@jini/daemon`. Orchestration (`start-chat-run.ts`, 3,715 ln) ABSENT |
| `design-systems` | 10,005 | 15 | 🟦 | ❌ | OD product |
| `media` | 6,074 | 9 | 🟩 | ⚠️ | `@jini/media` stub — gateway substrate only, real per-vendor dispatch deferred (unaudited) |
| `connectors` | 4,598 | 7 | 🟦 | ❌ | OD product data connectors |
| `prompts` | 4,506 | 9 | 🟨 | ❌ | prompt *content* is product; any generic composition infra would need triage |
| `critique` | 4,294 | 21 | 🟦 | ❌ | OD "Critique-Theater" telemetry; auditors flagged as product-specific |
| `live-artifacts` | 3,532 | 6 | 🟨 | ❌ | live-render engine; generic-leaning but OD-flavored — triage |
| `integrations` | 3,393 | 13 | 🟩 | ✅ | 9/13 → `@jini/agent-runtime` (4 `vela*` vendor files excluded, honestly) |
| `agent-protocol` | 3,000 | 17 | 🟩 | ✅ | → `@jini/agent-runtime` (ACP + pi-rpc), verified |
| `design` | 1,543 | 4 | 🟦 | ❌ | OD product |
| `artifacts` | 1,075 | 6 | 🟩 | ✅ | → `@jini/daemon`, verified (store + publication guard) |
| `services` | 925 | 5 | 🟨 | ⚠️ | login-shell → `@jini/platform`; rest absent |
| `storage` | 846 | 4 | 🟩 | ✅ | aws-sigv4 + project-storage→blob → `@jini/platform`; db config → `@jini/sqlite` |
| `figma` | 728 | 2 | 🟦 | ❌ | OD product |
| `migration` | 713 | 3 | 🟩 | ✅ | → `@jini/daemon`, verified (legacy data migrator) |
| `registry` | 668 | 4 | 🟩 | ⚠️ | `@jini/registry` + protocol schemas exist (unaudited) |
| `genui` | 612 | 4 | 🟦 | ❌ | product generative-UI |
| `media-adapters` | 588 | 5 | 🟩 | ⚠️ | → `@jini/media` (partial, unaudited) |
| `qa` | 564 | 2 | 🟦 | ❌ | internal/product QA |
| `http` | 460 | 10 | 🟩 | ✅ | → `@jini/http`, verified (transport toolkit) |
| `sidecar` | 265 | 2 | 🟩 | ✅ | → `@jini/sidecar`, verified (byte-identical) |
| `research` | 251 | 3 | 🟦 | ❌ | product feature |
| `browser` | 207 | 3 | 🟨 | ❌ | browser-automation capability; triage |
| `deploy` | 162 | 1 | 🟩 | ⚠️ | `@jini/deploy` (partial, unaudited) |
| `tools` | 137 | 1 | 🟩 | ❌ | triage |
| `metrics` | 128 | 1 | 🟦 | ❌ | product telemetry |
| `logging` | 72 | 1 | 🟦 | ❌ | product telemetry |
| `cli-help` | 71 | 3 | 🟩 | ❌ | generic CLI help text |
| `projects` | 8 | 1 | 🟨 | ❌ | stub |

## B. TOP-LEVEL FILES in apps/daemon/src (the critical spine + big product files)

| file | lines | class | in Jini | where / gap |
|---|--:|:--:|:--:|---|
| `cli.ts` | 10,175 | 🟨 | ⚠️ | generic flag/http/prompt helpers → `@jini/cli` (647 ln). **`daemon start` bootstrap + all subcommands ABSENT** |
| `server.ts` | 8,723 | 🟩 | ❌ | **the actual Express app + `.listen()` + wiring — ABSENT.** `@jini/http` only mounts routes onto a caller-supplied app, never boots one |
| `connectionTest.ts` | 2,950 | 🟩 | ⚠️ | SSRF-guard subset → `@jini/agent-runtime`; full connection testing absent |
| `tools-connectors-cli.ts` | 2,840 | 🟦 | ❌ | product connectors CLI |
| `db.ts` | 2,400 | 🟩 | ⚠️ | config + inspect → `@jini/sqlite`. **The schema (runs/conversations/messages/etc.) ABSENT**; only a new `jini_event_log` table exists |
| `langfuse-trace.ts` | 2,073 | 🟦 | ❌ | vendor telemetry |
| `deploy.ts` | 2,012 | 🟩 | ⚠️ | `@jini/deploy` (partial, unaudited) |
| `mcp.ts` | 1,858 | 🟩 | ❌ | **MCP protocol host — ABSENT** (only mcp-oauth PKCE subset in agent-runtime) |
| `byok-tools.ts` | 1,691 | 🟨 | ❌ | BYOK tool surface; triage |
| `projects.ts` | 1,614 | 🟦 | ❌ | product project mgmt |
| `import-export-routes.ts` | 1,610 | 🟦 | ❌ | product routes |
| `memory-llm.ts` / `memory-connectors.ts` / `memory.ts` | 4,047 | 🟨 | ⚠️ | `@jini/memory` = generic note-store only; OD mining/connectors deferred (unaudited) |
| `mcp-config.ts` / `mcp-routes.ts` / `mcp-agent-install.ts` | 2,154 | 🟩 | ❌ | MCP config/serving/install — ABSENT |
| `langfuse-bridge.ts` | 1,207 | 🟦 | ❌ | vendor telemetry |
| `skills.ts` | 1,042 | 🟩 | ⚠️ | skill *loader* generic; 160 skill markdowns ported separately per agent-runtime source-map |
| `lint-artifact.ts` | 1,000 | 🟩 | ❌ | artifact lint; generic-leaning, triage |
| `run-failure-classification.ts` | 874 | 🟩 | ⚠️ | AccountFailureClassifier seam injected in agent-runtime; full classifier absent |
| `app-config.ts` | 841 | 🟩 | ⚠️ | partial via platform |
| `redact.ts` / `api-token-auth.ts` / `origin-validation.ts` | — | 🟩 | ✅ | → `@jini/core`, verified |
| plus ~90 smaller files (routines, orbit, analytics, brand-routes, library*, automation-*, transcript-export, trace-*, prompt-telemetry …) | ~40K | mostly 🟦 | ❌ | overwhelmingly product/telemetry |

## C. The verdict in one line

**Engine-generic execution *primitives* are substantially ported and well-tested
(agent-runtime, http, core, platform, sidecar, artifacts, migration). The *service
spine* that makes it a runnable daemon — `server.ts`, `cli.ts` bootstrap, `db.ts`
schema, `routes/`, `mcp.ts`, and the `start-chat-run.ts` run orchestration — is
absent. Product modules (~60K lines: brands, design-systems, connectors, critique,
figma, genui, langfuse, …) are absent by design and stay out of the neutral engine.**

## D. Dependency-ordered build plan → runnable full generic daemon

Product 🟦 modules are excluded (they belong in a consumer/adapter like
`foundry/integrations/open-design`, per the repo's neutrality boundary). Each phase is
checkpointed: commit + push after each unit, not just at phase end.

- **Phase 0 — Triage + assembly spine (prove it boots).**
  Resolve 🟨 generic-vs-product for `plugins/`, `live-artifacts/`, `routes/`,
  `browser/`, `byok-tools`, `lint-artifact`. Then build `createLocalNodeDaemon` in
  `@jini/node-host`: port the *generic spine* of `server.ts` (app + middleware +
  `.listen()`) and `cli.ts` `daemon start`, wiring `@jini/core` DI + `@jini/sqlite`
  + `@jini/http` (actually call `express()`/`listen`) + `@jini/agent-runtime`.
  **Exit:** `jini daemon start` boots and serves `/status`.
- **Phase 1 — Persistence.** Port the generic `db.ts` schema (runs, conversations,
  messages, artifacts, events) into `@jini/sqlite`; make `EventLog` durable.
- **Phase 2 — Run orchestration.** Generalize `start-chat-run.ts` (3,715 ln) into
  `@jini/daemon`: the loop that accepts a run, drives `@jini/agent-runtime`, streams
  events to `EventLog`, applies close-status. **This is the keystone** — it connects
  the ported primitives into actual execution.
- **Phase 3 — Service surface.** Port the generic `routes/` subset (run
  create/list/get/stream/cancel, artifacts, health, version) into `@jini/http`,
  mounted by the Phase-0 spine.
- **Phase 4 — MCP host.** Port `mcp.ts` + `mcp-config` + `mcp-routes` into a new
  `@jini/mcp` (or into agent-runtime) so the daemon serves MCP.
- **Phase 5 — Plugin host.** Port the generic `plugins/` host into
  `@jini/plugin-runtime` (OD `packages/plugin-runtime` is the model).
- **Phase 6 — Capability completion.** Finish `@jini/media` dispatch, `@jini/memory`,
  `@jini/registry`, `@jini/deploy` to real wired functionality (audit each first —
  they were not verified this session).

**Rough generic-engine scope still to port:** server/cli-bootstrap ~12K · db schema
~2K · run orchestration ~4K · generic routes ~6-8K · mcp host ~4K · plugin host ~8-10K
· capability completion ~10K ≈ **45-50K lines of real work** (vs ~60K of product
modules intentionally excluded).

## PART 2 — Everything beyond the daemon (the rest of the full picture)

The daemon is only ~28% of OD (~174K of ~615K lines). This session audited ONLY the
daemon-backed packages. Everything below is either mapped-by-size-but-unaudited or
not mapped at all. Status: ✅ audited this session · ⚠️ Jini counterpart exists, NOT
verified · ❓ no correspondence established · ⬜ out of scope.

### F. OD source coverage (all apps + packages)

| OD area | lines | Jini counterpart | status |
|---|--:|---|:--:|
| `apps/daemon` (generic slice) | 174,602 | daemon/cli/sqlite/http/core/agent-runtime/platform/sidecar | ✅ audited + gap-mapped (Part 1) |
| **`apps/web/src/components`** | **160,894** | `@jini/ui` (30K) + renderers-react + chat-react | ⚠️ **biggest unknown — 2× the daemon, 0% verified** |
| `apps/web/src/i18n` | 114,036 | — | ⬜ mostly generated locale strings, not functional code |
| `apps/web/src/runtime` | 13,293 | chat-core / agent-runtime? | ❓ unmapped |
| `apps/web/src/{providers,state,artifacts,utils,edit-mode,media,hooks,onboarding,observability,analytics}` | ~22,000 | @jini/ui, renderers-react, chat-* | ❓ largely unmapped |
| `apps/landing-page` | 81,609 | — | ⬜ marketing, out of scope |
| `apps/desktop` | 10,401 | `@jini/desktop-host` (2,072) | ⚠️ unverified |
| `apps/packaged` | 3,602 | desktop-host? | ❓ |
| `packages/contracts` | 18,207 | `@jini/protocol` (432) | ⚠️ **~2% mapped; ~17.7K of DTOs unmapped** |
| `packages/download` | 1,651 | `@jini/platform` (download.ts) | ✅ audited (via platform) |
| `packages/platform` `packages/sidecar` `packages/sidecar-proto` | ~3,595 | @jini/platform, @jini/sidecar | ✅ audited |
| `packages/plugin-runtime` | 1,104 | — (Phase 5 target) | ❌ absent |
| `packages/host` | 1,030 | @jini/platform? | ❓ |
| `packages/diagnostics` | 687 | `@jini/diagnostics` (624) | ⚠️ unverified |
| `packages/{launcher-proto,registry-protocol,release,agui-adapter,components,metatool}` | ~1,731 | protocol/registry/metatool/misc | ⚠️/❓ mostly unverified |

### G. Jini packages NOT audited this session (~46.5K src lines of unverified claims)

| Jini package | src lines | claimed OD origin | audited? |
|---|--:|---|:--:|
| `ui` | 30,091 | apps/web/src/components | ❌ NO |
| `renderers-react` | 3,879 | apps/web (renderers/artifacts) | ❌ NO |
| `chat-react` | 3,083 | apps/web (chat UI) | ❌ NO |
| `chat-core` | 2,817 | apps/web (chat logic) | ❌ NO |
| `desktop-host` | 2,072 | apps/desktop | ❌ NO |
| `deploy` | 1,473 | apps/daemon/deploy + deploy.ts | ❌ NO |
| `media` | 1,175 | apps/daemon/media + media-adapters | ❌ NO |
| `memory` | 998 | apps/daemon/memory* | ❌ NO |
| `registry` | 686 | apps/daemon/registry + registry-protocol | ❌ NO |
| `diagnostics` | 624 | packages/diagnostics | ❌ NO |
| `capability-providers` | 442 | **greenfield — no OD source** | ❌ NO |
| `metatool` | 202 | packages/metatool | ❌ NO |

### H. The headline outside the daemon

**The frontend is the daemon problem again, bigger and still open.** OD ships
**160,894 lines of UI components**; Jini's `ui` is 30K claiming to be the neutral
extraction — and not one line of it has been verified this session. Same unanswered
question as the daemon ("faithful extraction, or thin/padded?"), on a 2× surface.
Second: OD `packages/contracts` is 18K of DTOs and only ~432 lines surfaced in
`@jini/protocol` — the rest is unmapped. Backend audit = 5 of 22 packages' worth of
trust; **17 packages (~46.5K lines) remain unverified.**

## PART 3 — `@jini/ui` audit result (2026-07-18, inline via graph + direct reads)

Method: OD component sizes measured directly (`wc -l`, the graph's `lines` field is
unpopulated); OD ground-truth located via codebase-memory-mcp; Jini slices read
directly; package-wide hollow-test scan. Sampled 2 of 21 vertical slices deeply
(connectors, memory) + full-package structural/test scan. NOT every slice deep-diffed.

**Coverage delta — DEFENSIBLE.** ~30K of generic widgets extracted from OD's ~160K
`apps/web/src/components`. OD's largest components are skipped, correctly, because
they're product-specific: `FileViewer.tsx` (14,495), `ProjectView.tsx` (10,058),
`DesignSystemFlow` (5,481), `HomeHero` (5,026), design/brand/pet/plugins-home. The
port targets reusable widgets (connectors, memory, settings-dialog shell, sketch
editor, asset grid/tree, viewer shell), often as ~25% slices of larger OD files.
`chat`/composer components (~14K) belong to `chat-react`/`renderers-react` (separate,
still unaudited).

**Fidelity (sampled) — REAL, not padded.** `features/connectors` (2,311) and
`features/memory` (4,452) are genuine decompositions of OD monoliths into
component/hook/rule/port modules with a dependency-injection test seam, i18n, and a
paired test per source file. Jini-bigger-than-OD is explained by decomposition +
tests + extracted ports, not padding. Package-wide: 255 test files, 4,743 `expect()`,
2,568 cases, **zero** `expect(true)`, **zero** `.skip/.todo/.only`, zero OD identity
strings in sampled slices. `ConnectorsBrowser.tsx` is substantive component logic with
a provenance doc-comment, not a stub.

**Verdict: SOLID-PORT (sampled).** Consistent with the backend pattern — real,
de-branded, heavily-tested extractions. Residual risk: 19 of 21 slices not
deep-diffed, and `chat-react`/`chat-core`/`renderers-react`/`desktop-host` + the
new-addition packages remain unaudited.

## PART 4 — Bottom line across everything audited

Audited this session: **10 backend packages + agent-runtime + `ui` (sampled)**. Every
one came back a real, faithful, de-branded, tested port — several to an "exemplary"
standard under adversarial diffing. **The "cheated / ported almost nothing" thesis does
not hold.** The accurate finding is different and more useful:

1. **What exists is genuine and high-quality** — not fabricated, not hollow-tested.
2. **Scope is a deliberate, honestly-documented slice** — the generic/reusable parts;
   product code is skipped by design (neutral-engine constraint).
3. **The real gap is ASSEMBLY, not authenticity.** No runnable daemon (backend service
   spine — `server.ts`/`cli.ts` bootstrap/`routes`/`mcp.ts`/`start-chat-run` — absent),
   and the `ui` widgets aren't assembled into a running app either. You have excellent
   *parts*, not yet a *product*.
4. **Minor doc overstatements exist** (home-expansion "verbatim", a stale http "stub"
   note, codex.ts under-itemized) — real but behavior-neutral, not the systemic
   fabrication that was feared.

Still unverified: `chat-react`, `chat-core`, `renderers-react`, `desktop-host`,
`deploy`, `media`, `memory`, `registry`, `diagnostics`, `metatool`, and greenfield
`capability-providers` (~15K lines).

## E. Open scope question for the user

"All the daemon functionality" has two readings: **(1) full generic runnable daemon**
(this plan — strip product 🟦), or **(2) everything incl. product** (brands,
design-systems, connectors, critique — breaks the neutral-engine architecture the repo
enforces). This plan assumes (1). If (2), the product modules get appended as consumer
adapters, not folded into `@jini/*`.
