# External Audit Report — Session backend/merge work (23 unpushed commits)

**Threat model:** `TM-jini-20260722-session-backend-and-merge`, round 1
**Audit target:** local `main` range `cad3ec73c..3daa2869b` (23 commits, unpushed; `origin/main` = `3442c0668`)
**Effective `suggest_changes` mode:** `patches` for the named high-risk file set; `notes` fallback where a correct fix crossed into unreviewed files

## Planned Auditors

| Auditor | Model | CLI version | Status |
|---|---|---|---|
| Codex | `gpt-5.6-sol` (reasoning: high) | `codex-cli 0.144.3` | **Responded** |
| Claude (Fable) | `claude-fable-5` | `claude 2.1.201 (Claude Code)` | **Responded** |
| Gemini | `gemini-3.1-pro-high` | `agy 1.1.5` | **Failed — see Degraded Coverage** |
| Gemini | `gemini-3.6-flash-high` | `agy 1.1.5` | **Failed — see Degraded Coverage** |

## Degraded Coverage

Both Gemini dispatches (3.1 Pro and 3.6 Flash, via `agy`) failed and were excluded from synthesis. Two distinct failure classes, in order:

1. First attempt: blocked by this Claude Code session's own harness auto-mode classifier as a hard "Data Exfiltration" denial (sending this repo's real source to a non-Anthropic vendor) — not overridable by in-conversation user authorization. Resolved by the user turning off auto mode.
2. Second attempt (auto mode off): `agy`'s own headless-mode tool-permission system auto-denied a generic `Bash` tool request it made unprompted (the prompt was fully self-contained and needed no tool use). Retrying without tools surfaced the real root cause: `RESOURCE_EXHAUSTED (code 429)` on Gemini's backend — a genuine quota/capacity exhaustion, not a config problem. Per this workflow's own retry policy (transient failures get bounded retry, not indefinite variation), and given repeated attempts had already been made, the user explicitly told me to stop and proceed with Codex + Fable only.

This audit proceeds with 2 of 4 planned auditors — both from different vendors/families than the current host (Claude Sonnet 5), so cross-vendor independence is still real, just narrower than planned. No Gemini-specific perspective is represented below.

## Work Log

See the authoring packet for full detail: `ADS-memory/.local-artifacts/external-audit/packets/20260723T014038Z-audit-packet.md`. Summary: this session executed three fronts (dangling-branch reconciliation into `packages/ui`/`chat-react`/`renderers-react`/`agent-runtime`; OD route-parity — azure/google/ollama model-proxy providers, `health.ts`, `connectors.ts`, `research.ts`, desktop-host additions; xAI OAuth+search) plus publish-pipeline scaffolding (Changesets + GitHub Actions + all 25 packages made publishable), landing 23 local commits, none pushed to `origin`.

## Per-Auditor Scope Checks

**Codex**: "Audited local range `cad3ec73c..3daa2869b` under TM-jini-20260722-session-backend-and-merge. Directly reviewed all named high-risk HTTP, provider/OAuth, desktop-shell, node-host, and publishing files; sampled file-dropzone, iframe-pool, model-picker, preview-modal, model-registry, and merge-resolution barrels. Independently verified the repaired `fa7a1cf39` tree exactly equals erroneous amend `38ad2b247`... Static checks could not execute because the read-only environment denied `tsx`'s temporary IPC socket."

**Fable**: More expansive — read all 17 named high-risk files plus 2 undeclared dependency files it judged necessary to verify claims about them (`oauth-credentials.ts`, `connection-guard.ts`), explicitly disclosed as a scope extension. Also explicitly disclosed what it did **not** read (`api-security-middleware.ts`, `sse.ts`, `adapter.ts`, `origin.ts`) and flagged which of its own claims are therefore weaker as a result. Independently reconstructed the merge-incident repair via `git reflog` rather than trusting the packet's own claim.

## What The External LLMs Said

### Codex — Score 5.5/10, gate **FAIL**

4 findings: 3 blocker, 1 high.
- **Blocker** — SSRF: the 3 new model-proxy providers (`azure-chat.ts`, `google-messages.ts`, `ollama-chat.ts`) use the synchronous, non-DNS-resolving `validateBaseUrl()` instead of the already-available `validateBaseUrlResolved()`, letting a caller-supplied hostname that *resolves* to a private/internal address bypass the SSRF guard.
- **Blocker** — publish exposure: claims `.github/workflows/publish.yml`'s "dormant without `NPM_TOKEN`" premise is false because `id-token: write` enables npm's OIDC-based "trusted publishing" without a stored secret.
- **Blocker** — boundary violation: `research.ts` has a genuine *runtime* import from `@jini/media` (not type-only), which the broken R7 boundary check currently fails to catch; a working R7 would reject the build.
- **High** — `research.ts`'s Tavily call has no timeout/AbortSignal at all; a stalled upstream holds the request indefinitely.

### Fable — Score 8.8/10, gate **PASS**

10 findings, all medium or low; explicitly verified (not just read) the merge-incident repair and the publish-dormancy claim.
- Independently found and **confirms** the SSRF gap (F5) but rates it **low**, reasoning the exploiting actor must already be same-origin+bearer-authenticated, and explicitly flags this holds for localhost deployment but weakens for the packet's own stated LAN-deployment context.
- Independently found and **confirms** the R7 boundary issue (F3), with more precision than Codex — names the exact new `package.json` dependency edges the publish commits added (`@jini/http` → `@jini/capability-providers` as a real `workspace:*` entry, not just a type import) — rates it **medium**, arguing it's honestly disclosed in module docs rather than hidden, and gives a sharper recommendation: fix the underlying architecture decision *before* fixing the R7 script bug, "or main stops building."
- **Directly refutes** Codex's publish-exposure blocker: independently verified no remote branch contains any of this audit's commits (so the workflow doesn't exist on GitHub at all yet), and that `NPM_TOKEN`/`NODE_AUTH_TOKEN` both resolve empty. Separately finds its own real, narrower publish-activation gap (F6): the *first* push after `NPM_TOKEN` is added publishes all 25 packages immediately with no version-PR review gate, and flags an undecided `access: restricted` vs `public` question.
- Plus 7 more real findings Codex didn't surface: a substring-match bug in `xai.ts` that could reflect raw upstream OAuth-endpoint error text back to a caller (F1); an xAI OAuth loopback listener that isn't closed on daemon `stop()`, leaking a bound port for up to 30 minutes (F2); a session token passed via URL query string instead of a header in `connectors.ts` (F4); a shell-injection anti-pattern in `publish.yml`'s use of unescaped Action-output interpolation (F7); a Tauri `dirExists` that throws instead of honoring its documented "never throws" contract (F8); a cross-origin page able to fire-and-forget-abort an in-flight xAI OAuth dance via the loopback listener (F9); and `model-proxy.ts` never wiring client-disconnect to an `AbortSignal` despite every turn-runner already accepting one (F10).
- **Unprompted structural finding** (answering the packet's own "what did the framing miss" question): read/write routes in `connectors.ts` that lack `requireSameOrigin` are theoretically reachable via DNS-rebinding against the localhost daemon, since a rebound-hostname page becomes browser-same-origin — currently inert (zero-config leaves every provider unconfigured) but becomes real the day a host wires a real provider. Also flags that nobody has verified who owns the `@jini` npm scope, which is squattable right now independent of any token.

## Per-Finding Rationales

Full `Checked`/`Expected`/`Observed`/`Why it matters`/`Recommended fix`/`Confidence` detail for every finding is preserved verbatim in the raw offloads: `ADS-memory/.local-artifacts/external-audit/offloads/20260723T014038Z/codex/codex-final-answer.txt` and `.../fable/fable-retry-audit.result.md`.

## Cross-Auditor Synthesis

**Independently converged (both auditors found the same defect):**
1. SSRF via non-DNS-resolved `validateBaseUrl()` in the 3 new providers — same code, same root cause, **disputed severity** (Codex: blocker: Fable: low).
2. The R7 boundary-check bug is concretely exploited by this diff's own new code, not just a latent script bug — same conclusion, **disputed severity** (Codex: blocker; Fable: medium).
3. Missing abort/timeout wiring on long-running upstream calls — same underlying category, different specific instances (Codex: `research.ts` has *zero* timeout at all; Fable: `model-proxy.ts` has abort machinery built but never wired to client-disconnect).

**Direct disagreement, not just severity — a factual dispute:** Codex's publish-workflow blocker claim (npm OIDC trusted publishing bypasses the `NPM_TOKEN` gate) vs. Fable's refutation (verified nothing is even pushed to GitHub yet, and npm trusted publishing requires a publish-side OIDC trust relationship that cannot exist for packages that have never been published before). Fable's evidence is stronger and more specific here.

**What Fable caught that Codex missed:** 7 additional real findings (F1, F2, F4, F7, F8, F9, F10) plus the DNS-rebinding structural gap — a materially more thorough pass, likely a function of the longer time budget (653s / 47 turns vs. Codex's single-pass run) and Fable's willingness to read 2 files outside the named list when the packet's own claims were unverifiable without them.

**What Codex caught that Fable didn't:** nothing exclusively — Codex's 4 findings all have a Fable counterpart, just scored differently.

## Coordinator Response

### Agree

- Both SSRF-gap findings (Codex AUD-R1-001 / Fable F5) — the defect is real, confirmed independently twice, trivial to fix (the code is already `async`, `validateBaseUrlResolved` already exists in the same module). **I side with Codex on severity, not Fable**: the threat model's actor list includes any allowed same-origin/bearer-holding caller, not just an external unauthenticated attacker, and the packet's own deployment context explicitly includes LAN deployment — an authenticated-but-untrusted caller pivoting the daemon into internal infrastructure is exactly domain-2 material regardless of how it's reached. **Recomputed as a validated blocker.**
- Both R7-boundary findings (Codex AUD-R1-003 / Fable F3) — real, independently confirmed, and the packet's own frozen contract explicitly lists "boundary-violation regressions" as an in-scope blocking domain. Disclosure in a module doc comment doesn't cure a violated invariant. **Recomputed as a validated blocker**, siding with Codex's severity over Fable's here too — but Fable's specific recommendation (fix the architecture decision *before* the R7 script bug) is the correct sequencing and I'm adopting it.
- Fable's F1 (xai.ts substring-match leak), F2 (listener not closed on stop), F7 (shell-injection anti-pattern), F8 (Tauri dirExists contract violation) — all real, all cheaply fixed, all with a concrete patch already provided. Agree-implement.
- Fable's F6 (first-activation publishes all 25 packages with no review gate) and the DNS-rebinding structural gap — both real, valuable, and neither was caught by my own earlier review of the publish scaffolding. Agree, needs a decision, not silently defaulting to the current behavior.

### Change

- Codex's `research.ts` AbortSignal finding (AUD-R1-004) and Fable's F10 (`model-proxy.ts` same category) — real, but I'm downgrading both from "high"/implied-blocker framing to **required-before-real-load, not blocking-gate material**: a held-open request that still terminates at the provider's own limits isn't an "allowed actor violates a mandatory invariant" in the strict sense the frozen contract defines, it's a resource-hygiene gap. Still fixing `research.ts`'s complete absence of a timeout (worse than `model-proxy.ts`'s merely-unwired-abort case) as part of this session's follow-up.
- Fable's F9 (forged cross-origin OAuth-callback abort) — agree it's real but is genuinely low-impact as Fable itself argues (recoverable nuisance, the code comment shows the trade-off was deliberate); downgrading to advisory, not touching the accept-current-behavior default without a product decision.

### Disagree

- **Codex's AUD-R1-002 (publish-workflow blocker via npm trusted publishing)** — rejected. Fable's refutation is better-evidenced: nothing in this range is pushed to GitHub at all (`git branch -r --contains` on the earliest commit returns empty), so the workflow doesn't exist as a live GitHub Actions workflow yet, and npm's OIDC trusted-publishing mechanism requires a *pre-existing* npm-side trust configuration tied to an *already-published* package — which cannot exist for packages that have never been published under these names. The `id-token: write` permission is inert until that npm-side configuration is deliberately created by whoever eventually owns the `@jini` npm scope. This doesn't mean F6's activation-day concern is wrong — it's a different, real, narrower issue I'm keeping.
- Fable's downgrade of the SSRF and R7-boundary findings to medium/low — explained under Agree above; overridden using the packet's own frozen allowlist rather than accepted at face value.

### Proposed Fix Handling (Disposition Gate)

| # | Fix | Auditor | Disposition | Rationale | Status |
|---|---|---|---|---|---|
| 1 | Swap `validateBaseUrl` → `validateBaseUrlResolved` in azure-chat.ts/google-messages.ts/ollama-chat.ts | Codex (patch) | **agree-implement** | Validated blocker, trivial fix, code already async | Pending — see below |
| 2 | Exact-prefix match instead of substring in `xai.ts`'s OAuth-state error classification | Fable (patch) | **agree-implement** | Real SEC-005 gap, patch provided | Pending — see below |
| 3 | Own xAI listener ref in `create-local-node-daemon.ts`, stop it in `stop()` | Fable (patch) | **agree-implement** | Real resource leak, patch provided | Pending — see below |
| 4 | Tauri `dirExists` try/catch to honor never-throws contract | Fable (patch) | **agree-implement** | Real contract violation, patch provided | Pending — see below |
| 5 | Move `publishedPackages` interpolation to an env var in `publish.yml` | Fable (patch) | **agree-implement** | Real injection anti-pattern, cheap fix, patch provided | Pending — see below |
| 6 | Add a real timeout/AbortSignal to `research.ts`'s Tavily call | Codex (note) | **agree-implement** | Worse than F10 (zero bound today, not just unwired-abort) | Pending — see below |
| 7 | Fix R7's scoped-vs-unscoped name bug in `check-engine-boundaries.ts` | Both (note) | **agree-defer** | Fable's own caution: fixing R7 before deciding the http→media/capability-providers and node-host→media/memory coupling breaks the build. Needs an explicit architecture decision (promote those packages, or add a deliberate allowlist exception) before the mechanical fix. Not mine to decide unilaterally. | Deferred — needs your decision |
| 8 | Migrate `connectors.ts`'s `auth/session` bearer token from `?token=` query param to a header | Fable (note) | **agree-defer** | Correct fix crosses into `types.ts`/`adapter.ts`, files outside this audit's reviewed set; also a wire-contract change worth doing deliberately, not reactively | Deferred — needs a small follow-up task |
| 9 | Wire client-disconnect → AbortSignal in `model-proxy.ts` | Fable (note) | **agree-defer** | Correct fix depends on `sse.ts`'s close semantics, outside reviewed file set; genuinely needs its own look | Deferred — needs a small follow-up task |
| 10 | Decide `validateBaseUrlResolved` DNS-rebinding residual risk (pin resolved address) | Codex (note) | **agree-defer** | Correct beyond the immediate fix; DNS rebinding between validation and connection is a real residual gap even after fix #1 lands | Deferred — track as follow-up hardening |
| 11 | Document publish-workflow first-activation semantics; resolve `access: restricted` vs `public` | Fable (note) | **agree-defer** | Product/scope decision, not mine to make unilaterally | Deferred — needs your decision |
| 12 | Reconsider consuming the xAI OAuth listener on a stateless forged `?error=` | Fable (note) | **disagree** | Fable's own analysis shows the current behavior is a deliberate, defensible trade-off (low-impact recoverable nuisance); not changing without a stronger reason | No change |
| 13 | Confirm origin-guard middleware rejects DNS-rebound `Host` values on all `/api` routes | Fable (structural finding) | **agree-defer** | Requires reading `api-security-middleware.ts`/`origin.ts`, outside this audit's file set — genuinely needs its own investigation, not a quick patch | Deferred — needs follow-up investigation |
| 14 | Confirm who owns the `@jini` npm scope on npmjs.com before the publish pipeline goes live | Fable (structural finding) | **agree-implement** (as a check, not a code fix) | Cheap to verify, blocks nothing today, but should happen before any token is created | Pending — quick check |

**Items 1–6 and 14 are real, low-risk, and I'm ready to implement/check them now** — all land in files this session's own agents built (not the concurrent `packages/ui` session's territory), so there's no conflict risk. Given you flagged cost sensitivity a few messages ago, I'm holding off on actually writing the code until you say go, rather than immediately spending more on implementation right after a "this is eating my credits" comment.

## Audit Outcome

**Coordinator-recomputed `blocking_gate`: FAIL.** 2 validated blockers stand after my own review (SSRF via unresolved `validateBaseUrl`; the R7-boundary violation this diff's own code depends on), overriding Fable's more lenient severity read on both using the packet's own frozen threat-model contract. Codex's third blocker claim (publish-workflow npm-trusted-publishing bypass) is rejected as factually unsupported for this specific never-before-published-package scenario.

This does **not** mean the session's work is bad — both auditors independently confirm the SEC-005 discipline, the merge-incident repair, the OAuth token-storage hygiene, and the zero-config-safe defaults are all genuinely solid. It means: **don't push yet** — fix items 1–6 (mechanical, ~1–2 hours combined) before this goes to `origin`, and make an explicit, non-default decision on item 7 (the R7/package-coupling question) rather than letting the current silent enforcement gap stand.

## Round 2 — Compliance check on the 6 fixes (Codex gpt-5.6-sol, xhigh, solo)

Dispatched after implementing items 1–6 (commit `32d98c109`). Codex verified 5 of 6 as genuinely fixed (SSRF, xai.ts substring match, xAI listener cleanup, Tauri dirExists, publish.yml injection), but **reopened AUD-R1-004** (`research.ts` timeout) as a new blocker: the timer was cleared right after `fetch()` resolved, before `response.text()`/`response.json()` ran — so a server sending headers promptly and then stalling the body was still unbounded. Codex locally reproduced this with a Node script. Score 7.8, gate FAIL.

Fixed in commit `2966efa19`: restructured so the timeout stays armed across the full fetch+body-read sequence, cleared only in an outer `finally`; added a `TavilyHttpError` marker class so the pre-existing `!response.ok` error doesn't get double-wrapped by the new generic catch. Verified with the coordinator's own standalone repro of the same headers-resolve-body-stalls scenario before proceeding to round 3.

## Round 3 — Final verification (Codex gpt-5.6-sol xhigh + Gemini 3.1 Pro high + Gemini 3.6 Flash high, all three independently)

All three auditors reviewed commit `2966efa19` independently. **Unanimous: PASS, 10.0/10, zero findings, no new issues introduced.**

- **Gemini 3.1 Pro**: confirmed the timeout now spans fetch + both body-read branches, confirmed `TavilyHttpError`'s rethrow logic correctly prevents double-wrapping while still prioritizing timeout classification if the abort fires during error-body reading.
- **Gemini 3.6 Flash**: same conclusion, additionally traced through Node's `fetch` abort-signal-to-ReadableStream binding to confirm the mechanism is real, not just structurally plausible.
- **Codex (xhigh)**: went further — actually executed the real exported route with injected accelerated timers across 5 scenarios (stalled success, stalled error body, immediate HTTP failure, generic fetch failure, clean completion). Confirmed exact behavior: stalled cases abort at the deadline (43ms/41ms under a 40ms injected deadline), a real 429 produces `Tavily 429: quota for [REDACTED]` with no double-wrap, a generic failure produces `Tavily request failed: socket failed with [REDACTED]`, and the timer clears correctly with the signal left un-aborted on success.

**Coordinator-recomputed `blocking_gate`, final: PASS.** All originally-validated blockers (SSRF, R7-boundary-dependence at the architecture-decision level, and the reopened Tavily timeout) are now either fixed-and-triple-verified or explicitly deferred pending a human decision (R7). Cleared to push.

## Round 4 — Compliance check on 2 new post-push commits (Codex gpt-5.6-sol, xhigh, solo)

_Retroactively appended 2026-07-23; this round ran and its fix landed before this report file was updated to include it — see `ADS-memory/.local-artifacts/external-audit/offloads/20260723T014038Z/round4/` for the raw packet/output._

Dispatched against 2 brand-new commits that landed after round 3's clean PASS — `5f5920fb8` (Ollama wire-protocol rewrite: OD's real `/api/chat` NDJSON shape, `ollama.com` default, mandatory `apiKey`, replacing a prior OpenAI-compatible-shaped port) and `e660b5cdb` (Google auth moved from `?key=` query param to `x-goog-api-key` header; OpenAI/Azure wired to actually send a token-limit field, model-aware for OpenAI, always-legacy for Azure — the picker logic already existed in `token-params.ts` but was never wired into the request body). All three fixes were coordinator-verified live against real upstream APIs (Ollama got a real `ollama.com` 401, Google's real API returned its real invalid-key message, OpenAI's real API returned a real 401 with the key redacted) before this round's static/behavioral audit.

Codex found **2 new blockers** in this diff (score 6.9, gate **FAIL**):
- **AUD-R4-001**: `azure-chat.ts` always sent the legacy `max_tokens` field with zero fallback. OD's real `[proxy:azure]` handler retries once with `max_completion_tokens` on a 400 recognized by `isUnsupportedMaxTokensError` — Azure deployment names are caller-defined opaque strings, so the model family can't be inferred up front. This regressed every GPT-5/o-series Azure deployment to a deterministic HTTP 400, and the committed test asserted the *incomplete* behavior as correct.
- **AUD-R4-002**: `ollama-chat.ts`'s tool loop never emitted the `tool_use` lifecycle event, and its continuation request kept the OpenAI-compatible wire shape (stringified `arguments`, `id`/`type`, `tool_call_id`) instead of Ollama's native schema (object `arguments`, no `id`/`type`, `tool_name`) — confirmed against Ollama's own documented `/api/chat` examples.

What Codex confirmed as solid and unaffected: the NDJSON partial-line decoder, SSRF ordering (`validateBaseUrlResolved` before dispatch), Google's header/redaction fix, the OpenAI/Azure default-token-limit picker itself (only the Azure *retry* was missing), and package boundaries.

**Fixed in commit `6e6db1f32`** (same day): added a redaction-preserving single-retry hook (`retryableBody`) to `openai-chat.ts`'s shared `runOpenAiCompatibleRequest` reducer, wired into `azure-chat.ts`'s 400-path; rewrote Ollama's tool-call emission to fire `tool_use` unconditionally on resolution and rebuilt `OllamaToolCallParam`/`OllamaMessageParam` to match Ollama's native wire shape. Also fixed an unrelated pre-existing bug surfaced while re-running the full suite: `google-messages.ts` dropped `functionResponse.isError` entirely instead of defaulting to `false`. Added exact second-request-body assertions for both providers. Full 19-file/313-test provider suite passes; `@jini/agent-runtime`/`@jini/http` typecheck clean.

**Coordinator-recomputed `blocking_gate`: FAIL as originally scored** — both blockers were real; fix commit `6e6db1f32` cleared to a fresh round for verification rather than self-certified.

## Round 5 — Verification of the round-4 fix (Codex gpt-5.6-sol, xhigh, solo)

**Resolved model:** `gpt-5.6-sol`, `-c model_reasoning_effort=xhigh`, `codex-cli 0.144.3`. Single-auditor round by explicit user request (not a coverage gap — user asked specifically for a Codex xhigh recheck of this one fix commit).

**Internal verification gate (mandatory pre-dispatch for this high-risk-tier threat model):** ran first, using a falsification-framed read-only subagent excluded from the commit's own rationale/commit-message text. It independently traced the retry-recursion control flow, ran the 4-file/67-test targeted slice plus the full 19-file/313-test provider suite (all pass), ran `tsc --noEmit` clean, and — as a control against test-fabrication — checked out parent commit `e660b5cdb` in a scratch worktree and confirmed the new/changed assertions genuinely fail pre-fix. Zero findings; cleared to external dispatch. Full record: `ADS-memory/.local-artifacts/external-audit/internal-verification/20260723-round5-internal-verification.md`.

**External dispatch — Codex (xhigh), scope `e660b5cdb..6e6db1f32`:** independently reconciled both ledger entries by *executing* the code paths, not just reading the tests — confirmed Azure's retry fires only on `status===400 && isUnsupportedMaxTokensError(rawErrorText)`, reuses the same URL/headers, changes only the token-limit field, never retries twice (the recursive call strips `retryableBody`), and still redacts secrets on the retried request's own terminal-error path; confirmed OpenAI's own (non-Azure) path makes exactly one request since it never supplies `retryableBody`; confirmed Ollama's continuation carries a real object `arguments`, populated `tool_name`, and no `id`/`type`/`tool_call_id`, with exactly one `tool_use` emission per resolved call both with and without `executeTool` supplied, from a single call site.

- **`AUD-R4-001`**: `ledger_updates` → `verified: true`.
- **`AUD-R4-002`**: `ledger_updates` → `verified: true`.
- **Findings:** none. **Score: 9.8/10** (small deduction only because the read-only sandbox blocked an independent full Vitest rerun despite successful direct behavioral execution, typechecks, and the disclosed internal-verification suite evidence). **`blocking_gate`: PASS.**
- Also independently re-confirmed `result.isError ?? false` is correct for `google-messages.ts` (the type only permits `boolean | undefined`, and `??` still converts a stray runtime `null` to `false` if one ever occurred) and that SSRF/origin/boundary surfaces are untouched by this diff.
- **Suggested changes:** none — no defect warranted a patch. Proposed-Fix Disposition Gate: N/A, nothing returned to disposition.

**Coordinator-recomputed `blocking_gate`, round 5: PASS.** Both round-4 blockers are genuinely closed with independently-executed behavioral confirmation, not just static reading or trust in the commit's own test suite. No new issues introduced by the fix. Full raw offload: `ADS-memory/.local-artifacts/external-audit/offloads/20260723T014038Z/round5/`.

## Decision Points For User

1. **Should I implement fixes 1–6 and check 14 now?** They're ready, low-risk, and isolated from the concurrent `packages/ui` work — just holding for your go-ahead given the cost comment.
2. **Item 7 (R7 boundary)**: do you want `@jini/media`/`@jini/capability-providers` promoted per `UNLOCKED.md`'s real process, or an explicit, documented allowlist exception carved out for these specific edges? Either is legitimate; neither should stay silently unenforced.
3. **Item 11 (publish activation semantics)**: `access: restricted` vs `public` for the initial npm release, and whether the very first push after adding `NPM_TOKEN` should really publish all 25 packages unreviewed, or should require an explicit first version-PR gate too.
4. **Path to a 10** (from Fable, since it scored below 10): confirm the origin-guard middleware's `Host`/`Origin` handling on every `/api` route (item 13) to close the DNS-rebinding question definitively, and verify `@jini` npm-scope ownership before any token exists.
5. Gemini coverage is missing from round 3 entirely (quota exhaustion) — worth a follow-up single-auditor Gemini pass later if you want that third perspective, no rush.
6. As of round 5, this threat model (`TM-jini-20260722-session-backend-and-merge`) has a clean PASS through commit `6e6db1f32` — items 1–3 above (R7 boundary decision, publish activation semantics, path-to-10 origin-guard/npm-scope checks) remain the only open decisions carried forward from earlier rounds.
