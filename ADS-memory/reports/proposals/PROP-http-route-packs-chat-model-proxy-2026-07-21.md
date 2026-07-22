# Proposal: OD's chat/model-proxy surface — which package should own it, and how much of it is really generic?

**Status:** Proposal only — no route or wire-adapter logic from `chat.ts` was ported this round. This document is based on a direct, targeted read of `apps/daemon/src/routes/chat.ts` (2267 lines, `leonaburime-ucla/open-design`, `refactor/web-memory-slice`) — its full route inventory, its known product-identity leak, and its known duplicate-SSE-event bug were each independently confirmed against the actual source, not assumed from the pre-existing recon.

## Why this is a proposal and not a port

`packages/http/source-map.md`'s pre-existing routes-classification table already called `chat.ts` "genuinely the largest reusable surface in the whole 32-file set" — SSE framing, multi-provider (Anthropic/OpenAI/Azure/Google/Ollama/OpenRouter) wire adapters, tool-schema translation. That characterization holds up under a direct read. But porting it is not simply "now that SSE exists, wrap the routes" — the file raises a real package-placement question this task does not have standing to resolve unilaterally, on top of its sheer size (2267 lines, larger than every other file in `packages/http/src/` combined).

## Route inventory (verified against the actual file)

| Route | Verdict |
|---|---|
| `POST /api/runs/:id/feedback` | OD-PRODUCT — design-system-flavored reason-code allowlist + Langfuse sink. |
| `POST /api/provider/models` | MIXED — lists models for a BYOK provider config; plausibly generic, overlaps conceptually with `@jini/agent-runtime/src/providers/model-catalog.ts` (see below). |
| `POST /api/test/connection` | MIXED — BYOK credential smoke-test; generic shape. |
| `POST /api/…` (line 379) and `GET /api/…` (line 392) | Two "Critique Theater" routes (OD-PRODUCT, per the existing table's note). |
| `POST /api/proxy/anthropic/stream` | MIXED — Anthropic Messages API SSE proxy. |
| `POST /api/proxy/openai/stream` | MIXED — OpenAI Chat Completions SSE proxy. |
| `POST /api/proxy/azure/stream` | MIXED — Azure OpenAI SSE proxy. |
| `POST /api/proxy/google/stream` | MIXED — Gemini SSE proxy. |
| `POST /api/proxy/ollama/stream` | MIXED — local Ollama SSE proxy. |
| `POST /api/proxy/:provider/stream` | MIXED — the generic/tool-loop dispatcher (`runTurn`/`runAnthropicToolTurn`/`runGeminiToolTurn`, see below); a BYOK media tool-loop branch writes into OD's project folder (OD-PRODUCT). |

## The product-identity leak (confirmed, exact location)

Line 1029–1030, inside the OpenRouter request-header construction:

```
'HTTP-Referer': 'https://opendesign.dev',
'X-Title': 'Open Design',
```

A hard boundary violation as written (`scripts/check-engine-boundaries.ts`'s `PRODUCT_IDENTITY_STRINGS` would flag `Open Design` verbatim). Trivial to parameterize (a caller-supplied referer/title pair) regardless of where this code ends up — flagged here so whoever ports it doesn't have to rediscover it.

## The duplicate-`end`-event bug (confirmed, exact mechanism)

The non-tool-loop streamers guard every `sse.send('end', …)` call with a local `let ended = false` flag checked before sending. The three tool-loop turn-runners — `runTurn` (OpenAI-shape, line 1585), `runAnthropicToolTurn` (line 1758), `runGeminiToolTurn` (line 1917) — do **not** declare an `ended` flag at all. Each has at least two independent `sse.send('end', {})` call sites: one on `guard.contaminated` (the role-marker-guard tripping mid-stream) and at least one more on normal turn completion. Nothing stops both from firing on the same connection if contamination is detected right as the turn is also concluding — a real, confirmed double-`end`-event bug, not a guess. Any port of this logic should fix it (an `ended`-flag guard, matching the sibling streamers) rather than carry it forward, per this repo's established practice.

## The real question: where does provider-specific wire-protocol logic belong?

This is the part that makes chat.ts a proposal, not a port-in-progress. `@jini/http`'s entire existing surface (`adapter.ts`, `response.ts`, `sse.ts`, every route file ported so far) has zero knowledge of any AI provider — it is pure HTTP/SSE transport plumbing plus thin wrappers over kernel/other-package collaborators. Embedding Anthropic/OpenAI/Azure/Google/Ollama wire-format knowledge (request shape, SSE delta parsing, tool-call fragment accumulation, error-code mapping) into `@jini/http` would be a first, and would make this package simultaneously "the generic transport layer" and "the place that knows what an OpenAI `delta.tool_calls[].function.arguments` fragment looks like" — two very different responsibilities.

**This repo already has a package with exactly that second responsibility: `@jini/agent-runtime`.** Concretely:

- `packages/agent-runtime/src/role-marker-guard.ts` is *already* the ported, generalized version of the same contamination-detection concept chat.ts's tool-loop runners call `guard.contaminated`/`createDeltaGuard` for (per that file's own doc comment: "Ported verbatim from OD's `apps/daemon/src/role-marker-guard.ts`... consumed by `claude-stream.ts`"). The mechanism chat.ts needs already has a home one package over.
- `packages/agent-runtime/src/providers/` already exists, with a 419-line `model-catalog.ts` and per-vendor files (`aihubmix.ts`, `google.ts`, OAuth machinery) — i.e. "multi-provider model/credential knowledge" is already `@jini/agent-runtime`'s job in this codebase's actual architecture, not a green field.
- `packages/agent-runtime/src/claude-stream.ts`, `copilot-stream.ts`, `qoder-stream.ts` already establish the pattern of "one file per vendor's stream-parsing shape" that `chat.ts`'s five `/api/proxy/<provider>/stream` routes would extend.

**Recommendation:** the wire-adapter/turn-runner logic (the ~500-800 line pure-ish core the original recon estimated as the genuinely portable slice) is a strong candidate for `@jini/agent-runtime`, not `@jini/http` — extending its existing `providers/` + stream-parser + role-marker-guard pattern rather than duplicating a parallel copy inside the transport package. `@jini/http` would then own only the route registration + request/response marshaling (using `sse.ts`, the same way `runs.ts`/`memory.ts` do), calling into `@jini/agent-runtime` for the actual per-provider work — mirroring how `db-ops.ts` calls into an injected `DaemonDbOperations` rather than embedding SQLite logic itself.

This is not a decision this task can make alone: it is a real cross-package architecture call (does `@jini/agent-runtime` want an HTTP-facing BYOK proxy surface added to its responsibilities, distinct from its current job of driving locally-installed agent CLIs?) that changes two packages' scope, not one.

## What would need to happen before this ports

1. **A Software-Architect-level decision on package placement** — `@jini/agent-runtime` (extending its existing provider/stream-parser pattern) vs. a new dedicated `@jini/model-proxy` package vs. (least consistent with existing precedent) inside `@jini/http` directly.
2. **Scoping which of the five proxy routes are worth porting first** — likely Anthropic and OpenAI (the two most-used, and the ones `runTurn`/`runAnthropicToolTurn` already show the clearest tool-loop pattern for), deferring Azure/Google/Ollama as mechanical repeats once the pattern is proven.
3. Whichever package ends up owning it should fix the duplicate-`end`-event bug and parameterize the OpenRouter referer/title headers as part of the port, not after.
4. `POST /api/runs/:id/feedback` and the two Critique Theater routes stay excluded regardless (confirmed OD-PRODUCT); `POST /api/provider/models` and `POST /api/test/connection` are worth a second look once the placement question is settled, since they may already be redundant with `@jini/agent-runtime/src/providers/model-catalog.ts`'s existing surface rather than needing a fresh port.

## What this document is not

Not a claim that chat.ts has no generic core — it has the largest one of any route pack audited in this task. The blocker is a real, unresolved question about which of two packages should own multi-provider wire-protocol knowledge, compounded by sheer size (2267 lines) that makes guessing an answer inside a route-pack-porting task irresponsible rather than merely inconvenient.
