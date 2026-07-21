# `@jini/mcp` — provenance

Product-neutral Model Context Protocol (MCP) primitives extracted from Open
Design's daemon MCP "capability barrel"
(`apps/daemon/src/mcp/` on the `od-mcp-barrel` tree). The barrel was organized
as a `core/` kernel plus three concern subdirectories (`client/`,
`agent-install/`, `live-artifacts/`) behind a single root barrel.

This package ports the **generic** MCP concerns — the external-server config
schema/store, the daemon-side OAuth 2.1 / PKCE flow, the token store, the
install-payload builder, and the per-agent registration planner — plus the
handful of genuinely product-neutral runtime primitives that were embedded in
the otherwise OD-coupled `client/` server. All Open-Design identity strings
(`Open Design`, `OD_*`, `open-design`, `.od/…`, `opendesign.app`, `od mcp`,
`od://…`) were stripped. The package originally shipped with **zero runtime
dependencies** — node stdlib only (`node:fs`, `node:fs/promises`,
`node:crypto`, `node:path`, global `fetch`/`URL`/`Buffer`). A 2026-07-21
security-hardening pass (CR-006/CR-007, SEC-RB-001/002/011 —
`ADS-memory/reports/code-review/CR-remaining-backend-audit-2026-07-21.md`,
`ADS-memory/reports/security/SEC-remaining-backend-audit-2026-07-21.md`)
added `@jini/platform` (`assertSafePublicUrl` / `createValidatingLookup`,
mirroring `packages/deploy/src/reachability.ts`'s SSRF-safe fetch pattern)
and its `undici` peer as the package's first real dependencies, plus a new
internal `core/secure-write.ts` module (not part of the public barrel) that
every secret-bearing on-disk store (`config.ts`, `oauth.ts`, `tokens.ts`)
now writes through.

## File map

| Jini file | Origin (`apps/daemon/src/mcp/`) | Transform |
|---|---|---|
| `src/core/config.ts` | `core/config.ts` | Faithful lift of the `McpServerConfig`/`McpConfig` schema, sanitizers, atomic on-disk store (`read/writeMcpConfig`), loopback auth-mode inference, and the per-agent config builders (`buildClaudeMcpJson`, `buildAcpMcpServers`, `buildOpenCodeMcpConfigContent`). **Dropped** the `MCP_TEMPLATES` catalog and its `McpTemplate`/`McpTemplateField`/`McpTemplateCategory` types + the `templateId` field (design-tilted OD-product curation with brand-laden prose — analogous to `@jini/sqlite` dropping the OD-product "templates" table). De-branded comments; removed a dead IPv4-mapped-IPv6 loopback branch (unreachable — the WHATWG URL parser compresses `::ffff:127.0.0.1` before it reaches `isLoopbackHost`) and the dead stdio guard in `effectiveMcpAuthMode` (only ever called for http/sse). |
| `src/core/oauth.ts` | `core/oauth.ts` | Faithful lift of discovery (RFC 9728 → RFC 8414), Dynamic Client Registration (RFC 7591) + on-disk cache, PKCE/state helpers, authorize-URL builder, code/refresh token exchanges, `PendingAuthCache`, and `beginAuth`. De-brand: DCR `client_name` `'Open Design'` → `'Jini'`. Simplified the `PendingAuthCache` sweeper's defensive `typeof unref === 'function'` guard to a direct `this.timer.unref()` (dead in a node-only package). |
| `src/core/tokens.ts` | `core/tokens.ts` | Faithful lift, byte-for-byte (already brand-clean): 0600-guarded, atomic, per-`dataDir`-mutexed token store keyed by server id, with expiry checks. |
| `src/core/install-info.ts` | `core/install-info.ts` | Pure install-payload builder, **generalized** to carry no product identity: the data-dir env var name is now a required input (`dataDirEnvVar`, replacing the hardcoded `OD_DATA_DIR`), the MCP subcommand is an optional input (`subcommand`, default `'mcp'`), and the `buildHint` prose was neutralized ("CLI entry", "the daemon" — no "Open Design"). Behavior (sidecar vs direct args, `ELECTRON_RUN_AS_NODE`, web-base-url normalization) is unchanged. |
| `src/agent-install/install.ts` | `agent-install/install.ts` | Faithful lift of the agent-slug registry, the CLI/JSON/manual install-plan planners for 13 coding agents, and the pure JSON apply/remove primitives. Only comments/JSDoc were de-branded (`od mcp install` → `<cli> mcp install`, "Open Design's stdio MCP server" → neutral). Third-party agent product names (claude/codex/cursor/…) are kept as-is — they are not OD identity. |
| `src/client/client.ts` | `client/client.ts` (salvaged) | The bulk of `client/client.ts` — the `od mcp` stdio **server** proxy — was **dropped** (see below). Ported only the product-neutral, dependency-free primitives: `createMcpIdleExitController` (renamed from the `_`-prefixed test seam `_createMcpIdleExitController`), `extractRelativeRefs` (+ its HTML/CSS/JS/srcset patterns and `isHtmlLike`/`isCssLike`/`isJsLike` helpers), and `isTextualMime` (+ `TEXTUAL_MIME_PATTERNS`). Removed a provably-dead `if (disposed) return` guard inside the idle timer callback and the dead `m[1] || ''` regex fallbacks (required capture groups are always present). |
| `src/core/index.ts`, `src/client/index.ts`, `src/agent-install/index.ts` | corresponding `*/index.ts` barrels | Sub-barrels (`export *`). |
| `src/index.ts` | `index.ts` | Root barrel — explicit named re-exports of the ported public surface (the dropped/OD-coupled exports removed). |

## What was dropped (and why)

- **`live-artifacts/` (entire subdir)** — the OD per-run "live artifacts" MCP
  tool surface. An OD-product feature, out of scope per the port brief.
- **The `od mcp` stdio server** in `client/client.ts` — `runMcpStdio`,
  `TOOL_DEFS`, `handleMcpToolCall`, and every tool handler (`get_artifact`,
  `create_project`, `start_run`, project/active-context resolution, studio deep
  links, run polling, …). This is not a generic MCP client: it is an
  OD-product MCP **server** hardwired to Open Design's REST API
  (`/api/projects`, `/api/skills`, `/api/design-systems`, `/api/runs`, …) and
  concepts (design systems, skills, plugins, artifacts, runs, studio, the
  `od://` resource scheme). It also imports the OD-only `@open-design/contracts`
  package (`buildProjectRawFileUrl`), the OD daemon-internal
  `../../artifacts/create.js`, and the `@modelcontextprotocol/sdk` — none of
  which exist in this repo. Faithfully porting it would mean importing OD
  product surface, so it was dropped and only its generic primitives salvaged.
- **`MCP_TEMPLATES` catalog + template types + `templateId`** in `config.ts` —
  a large, design-tool-tilted curated catalog of third-party MCP servers with
  OD marketing prose. Zero functional coupling; dropped for neutrality (same
  rationale `@jini/sqlite` used to drop the OD "templates" table).

## External dependencies

`@modelcontextprotocol/sdk` and `@open-design/contracts` were needed only by
the dropped OD server proxy and were never ported. As of the 2026-07-21
security-hardening pass, the package depends on `@jini/platform` (workspace)
and `undici` — added specifically to close SEC-RB-001/CR-005 (MCP OAuth
discovery/DCR/token-exchange SSRF) by reusing `@jini/platform`'s
`assertSafePublicUrl` + connection-time `createValidatingLookup` guard,
the same pattern `packages/deploy/src/reachability.ts` established first.
Everything else still runs on node stdlib + web globals.

## Tests & coverage

Colocated `*.test.ts` (house style), node environment. `pnpm --filter @jini/mcp
exec vitest run --coverage` reports **100 / 100 / 100 / 100**
(statements / branches / functions / lines) across all `src/**` files with real
statements; the four barrel files re-export only and are covered via
`src/index.test.ts`. Reaching 100% branch coverage required removing several
provably-unreachable defensive branches (noted per-file above); each removal is
a behavioral no-op through the module's public entry points.
