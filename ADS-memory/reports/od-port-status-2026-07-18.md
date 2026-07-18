# OD → Jini port status — how much is actually left (2026-07-18)

## Why this document exists

The repo's framing (a 22-package `@jini/*` list described as "real
implementations", raw "extracted from a 615K-line repo" language, per-package
`source-map.md`s) created the impression that the engine was mostly built and
that "we were porting the whole thing." **That impression is false.** This
document is the honest correction, with every number measured on 2026-07-18.

Two things are true at once, and both matter:

1. **The code that exists is real and tested — not fabricated.** An independent
   adversarial audit this session verified the backend packages against the real
   OD clone (diffs, live test runs, coverage). `agent-runtime` (14K lines, ~1,600
   tests) and the `daemon`/`http`/`core`/`sqlite`/`cli`/`platform`/`sidecar`/
   `protocol` packages are genuine, faithful, de-branded ports.
2. **Completeness was massively oversold.** There is **no runnable daemon**. The
   entire backend service spine — `server.ts`, `cli.ts` bootstrap, `routes/`,
   `mcp.ts`, `start-chat-run.ts`, `db.ts` schema, `plugins/` host — is absent.
   You have well-tested *fragments*, not an assembled, runnable engine.

## A. Big picture — OD → Jini by territory

`~` marks estimates where an OD directory is a generic/product mix.

| OD territory | OD lines | ✅ ported | ❌ still to port (generic) | ⬜ product — skip by design |
|---|--:|--:|--:|--:|
| **`apps/daemon`** (backend engine) | 174,602 | ~24,000 | **~49,000** | ~101,000 |
| `apps/web` (frontend) | 317,161 | ~40,000 | ~15,000 | ~262,000 *(incl. 114K i18n data)* |
| `packages/contracts` (DTOs) | 18,207 | ~430 | ~17,700 | — |
| `apps/desktop` (shell) | 10,401 | ~2,100 | ~8,300 | — |
| OD `packages/*` (rest) | ~10,000 | ~7,000 | ~3,000 | — |
| **Totals** | **~530,000** | **~73,500** | **~93,000** | **~364,000** |

## B. The real remaining work — the runnable backend (this is "how much")

The ~49K from row 1, itemized. **None of this exists in `@jini/*`.** It is the gap
between "tested fragments" and "a daemon you can run":

| OD module | lines | what it unlocks | priority |
|---|--:|---|---|
| `plugins/` host | 12,777 | plugin load/execute | med |
| `cli.ts` bootstrap | ~9,500 | `jini daemon start` + subcommands | **high** |
| `server.ts` | 8,723 | HTTP app + `.listen()` — it actually boots | **high** |
| `routes/` (generic subset) | ~8,000 | run / artifact / health endpoints | high |
| `mcp.ts` + config/routes | ~4,000 | MCP protocol server | med |
| `start-chat-run.ts` | 3,715 | run orchestration — wires agent-runtime into execution (**keystone**) | **high** |
| `db.ts` schema | 2,400 | persistence (runs/conversations/messages) | high |
| **Subtotal — runnable backend** | **~49,000** | a feature-complete generic daemon | |

Plus lower-priority completion: `media/` real per-vendor dispatch (~6K), `contracts`
DTOs (~17.7K — port what the daemon needs), and finishing `memory`/`registry`/`deploy`
(~5K, currently partial and unverified).

**Assembly keystone:** `@jini/node-host` is a **1-line placeholder**. The
`createLocalNodeDaemon` that would wire core + sqlite + http + agent-runtime into
something that boots **does not exist**. Building it is step 0.

## C. What's already ported — and whether it was actually verified

| Layer | lines | verified real *this session*? |
|---|--:|---|
| `agent-runtime` (execution engine) | 14,159 | ✅ yes — 100% of sampled, tests real |
| `platform` `daemon` `http` `core` `sqlite` `cli` `sidecar` `protocol` | ~12,000 | ✅ yes — all audited, real ports |
| `ui` (widgets) | 30,091 | ⚠️ sampled only (2 of 21 slices) |
| `renderers-react` `chat-react` `chat-core` `desktop-host` + new-additions | ~15,000 | ❌ **claimed, never audited** |

**~15K of the "ported" frontend/new-addition packages have never been audited.**
Treat them as unconfirmed until checked.

## D. What is NOT a hole (do not port)

~364,000 lines of OD are **product**, not engine, and must stay out of the neutral
core: `brands`, `design-systems`, `connectors`, `critique`, `figma`, `genui`,
`prompts`, the entire `apps/web` product UI (`ProjectView`, `FileViewer`,
`DesignSystemFlow`, `HomeHero`, …), 114K of `i18n` translation data, and vendor
telemetry (`langfuse`). If a consumer wants these, they belong in an adapter like
`integrations/open-design/`, never in `@jini/*`.

## Bottom line

- **Real & verified:** ~26K (backend execution/transport) + partially-verified ~40K frontend.
- **Still to port for a working engine:** **~49K runnable backend spine** (the load-bearing gap) + ~28K contracts/media/capability finishing + ~15K unverified frontend to audit.
- **Correctly skipped:** ~364K of OD product.

**The honest headline: the hard execution layer is real, but the product — a
runnable daemon — is roughly half-built and its assembly has not been started.**

Full module-by-module detail: `ADS-memory/reports/daemon-full-gap-map-2026-07-18.md`.
