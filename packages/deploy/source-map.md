# `@jini/deploy` — provenance

Origin: `nexu-io/open-design` (fork `leonaburime-ucla/open-design`), local reference clone
`/Users/la/Desktop/Programming/OSS-Repos/open-design-agentic`, `apps/daemon/src/deploy.ts`
(2,005 lines, read in full; not modified).

Per `docs/jini-port/extraction-plan.md` §10 (roadmap appendix): "`@jini/deploy` — Netlify /
Vercel / GitHub Pages deploy targets (multi-bound `DeployTarget` token; `deploy.publish` is a
Tool)." This is a **new package, not one of the locked §3 set** — it was only named in the
roadmap-appendix prose, so per the Programmer dispatch it is added to `AGENTS.md`'s package list
flagged as needing Coordinator/Software-Architect sign-off before it is treated as locked
architecture, same as any other genuinely new package would be.

## Package map

| Jini file | Origin file(s)/section | Transform |
|---|---|---|
| `src/types.ts` | `deploy.ts` lines 14-73 (`DeployFile`, `DeployFilePlan`, `DeployOptions`, `DeploymentUrlCheck`, `DeployLinkStatus`, `DeployError`) | Kept `DeployFile`, `DeployLinkStatus`, `DeploymentUrlCheck`, `DeployError` as the provider-agnostic shapes the task called for. Replaced the OD-shaped `DeployConfig`/`DeployOptions`/`DeployFilePlan` (which carried `teamId`/`accountId`/`cloudflarePages` hints and OD's `metadata`/`includeProjectFiles` project-model options) with a single generic `DeployPublishInput { files, projectName, metadata? }` and `DeployPublishResult { targetId, url, deploymentId?, status, statusMessage?, reachableAt?, providerMetadata? }`. Added the `DeployTarget` port interface (`publish`, `checkReachability`) — this did not exist in the origin file, which had two free functions (`deployToVercel`, `deployToCloudflarePages`) instead of a shared interface; extraction-plan.md §10 calls for a real port so Vercel/Cloudflare/future targets are interchangeable behind one contract. |
| `src/naming.ts` | `deploy.ts` lines 1988-2005 (`safeVercelProjectName`, `safeDnsLabel`, `safeProjectLabel`) | `safeProjectLabel` lifted verbatim (pure string sanitizer, no OD dependency). `safeDnsLabel` lifted verbatim. `safeVercelProjectName` moved into `vercel.ts` (it's Vercel-specific — see below). |
| `src/reachability.ts` | `deploy.ts` lines 1661-1797 (`waitForReachableDeploymentUrl`, `checkDeploymentUrl`, `requestDeploymentUrl`, `normalizeDeploymentUrl`) | Logic lifted verbatim. Genericized the Vercel-specific protected-response check: the origin hardcoded `isVercelProtectedResponse` inside this shared reachability code; here it's a caller-supplied `detectProtected`/`protectedMessage` option on `ReachabilityOptions`/`ReachabilityWaitOptions`, so Cloudflare/future targets aren't forced to carry Vercel's SSO-cookie sniffing. `deploymentUrlCandidates` stayed in `vercel.ts` since only Vercel's alias-array response shape needs it. |
| `src/vercel.ts` | `deploy.ts` lines 9, 52, 59-60, 76-94 (config path only, dropped), 112-126 (dropped), 161-170, 198-205 (dropped), 388-437 (`deployToVercel`), 1645-1659 (`pollVercelDeployment`), 1765-1776 (`isVercelProtectedResponse`), 1800-1805 (`vercelTeamQuery`), 1896-1937 (`readVercelJson`/`vercelError`), 1939-1943 (`deploymentUrl`), 1778-1791 (`deploymentUrlCandidates`), 1988-1990 (`safeVercelProjectName`) | `deployToVercel`'s HTTP flow (create deployment, poll, resolve URL, reachability wait) ported as `VercelDeployTarget.publish`. **Dropped:** `readVercelConfig`/`writeVercelConfig`/`deployConfigPath`/`publicDeployConfig`/`SAVED_TOKEN_MASK` — this was OD's own persisted-config-file convention (`~/.open-design/vercel.json`, `OD_USER_STATE_DIR`), i.e. exactly the kind of caller-owned concern the task called out for dropping; a caller now constructs `new VercelDeployTarget({ token, teamId?, teamSlug? })` directly and owns wherever it persists that config. Deployment naming: `od-${projectId}` → `safeVercelProjectName(input.projectName)` (still sanitized/length-capped, no OD prefix, no `projectId`). |
| `src/cloudflare-pages.ts` | `deploy.ts` lines 10, 25-29, 53-58, 96-149 (config path, dropped), 172-186 (dropped), 439-1017 (zones/project/upload-token/asset-upload/deploy), 1019-1329 (`aggregateCloudflarePagesStatus` + full custom-domain/DNS-record flow), 1831-1837 (`cloudflarePagesProjectNameForProject`), 1955-1986 (hostname/zone-name/marker/hash helpers) | The full deploy + DNS/custom-domain feature ported as `CloudflarePagesDeployTarget.publish` (core deploy) and a private `setupCloudflarePagesCustomDomain` helper invoked when `input.metadata.customDomain` is supplied. **Dropped:** `readCloudflarePagesConfig`/`writeCloudflarePagesConfig`/`CloudflarePagesConfigHints` persistence (same OD-file-convention reasoning as Vercel) — caller supplies `{ token, accountId }` directly. **Genericized:** `cloudflarePagesProjectNameForProject(projectId, projectName)` (which mixed OD's `projectId` into the Pages project name so re-publishing the same OD project stayed idempotent) → `deriveCloudflarePagesProjectName(projectName)`, deterministic from `input.projectName` alone — the caller's own stable label is now the idempotency key, since this package has no `projectId`. The DNS-record comment marker `od:cfp:${hash}:${hash}` → `jini-deploy:${hash}:${hash}` (same mechanism — a stable stamp so a later publish recognizes a CNAME it created itself — just without the OD string). `cloudflarePagesProviderMetadata`'s `projectId`-keyed shape folded into `providerMetadata.customDomain` without a `projectId` field (the caller already has its own id space; this package doesn't need to round-trip one). **Dependency swap:** `cloudflarePagesAssetHash`/`shortCloudflareHash` used `blake3-wasm` purely as a deterministic content-addressing function for Cloudflare's direct-upload protocol (which only needs a stable, collision-resistant key per asset — the specific algorithm is not part of Cloudflare's contract). Swapped to Node's built-in `crypto.createHash('sha256')` (same output shape: lowercase hex, sliced to the same lengths) so this package adds no native/WASM dependency to the engine's dependency graph. |
| `src/tokens.ts` | *(new — no direct origin)* | `DeployTargetToken = manyToken<DeployTarget>('jini.deployTarget')`, matching extraction-plan.md §2.2's own worked example verbatim (`bindMany(DeployTarget, netlifyTarget)`). `publishDeploy(input, targets)` is `deploy.publish` shaped as a **plain async function** today — dispatches to whichever bound `DeployTarget` matches `input.targetId`. See "Deferred: ToolExecutor wiring" below. |
| `src/index.ts` | *(new — barrel)* | Re-exports all of the above. |

## Dropped entirely (not ported, no analog needed)

The origin file's `buildDeployFilePlan`/`buildDeployFileSet`/`addVisibleProjectFilesToDeployPlan`/
`isLinkedFolderProject` (lines 241-386) and the whole HTML/CSS reference-walking family that only
existed to support them — `extractHtmlReferences`, `extractCssReferences`,
`extractInlineCssReferences`, `rewriteEntryHtmlReferences`, `rewriteCssReferences`,
`resolveReferencedPath`, `rewriteHtmlReference`, `rewriteSrcset`, `parseHtmlTags`,
`parseHtmlAttributes`, `rewriteHtmlAttributes`, `shouldCollectHref`, `htmlRawTextRanges`,
`isOffsetInRanges`, `referenceSuffix`, `injectDeployHookScript`, `normalizeDeployHookScriptUrl`,
`escapeHtmlAttribute` (lines 236-341, 1161-1288, 1482-1514, 1516-1527) — and the preflight
warnings helper `analyzeDeployPlan`/`prepareDeployPreflight` (lines 1289-1480) that consumed their
output.

**Why:** this entire family exists to walk *OD's own project file tree* (via `readProjectFile`/
`listFiles`/`validateProjectPath` from `./projects.js`) starting from a single HTML entry point,
discover every referenced asset, and rewrite in-document paths so the result works once flattened
to a deploy root. The task is explicit that `@jini/deploy` "does NOT know about 'projects,' it
just takes a file set" — the caller resolves and hands over a complete, already-correct
`DeployFile[]`. With no project tree to walk, there is nothing left for this code to do; a caller
building its own file set already owns path resolution/rewriting in whatever shape its own file
model uses. If a future consumer wants a reusable "flatten an HTML entry + its referenced assets
into a deploy-ready file set" utility, that is a separate, standalone package (it has zero
dependency on Vercel/Cloudflare/the `DeployTarget` port) — flagged as a possible future
`@jini/deploy-html-plan` or similar, not part of this package.

Also dropped: `isDeployProviderId`, `publicDeployConfigForProvider`, `readDeployConfig`,
`writeDeployConfig`, `VERCEL_PROVIDER_ID`/`CLOUDFLARE_PAGES_PROVIDER_ID` as a closed
`DeployProviderId` union — superseded by `DeployTarget.id: string` (open-ended, so a third target
doesn't require a union edit) and `VERCEL_TARGET_ID`/`CLOUDFLARE_PAGES_TARGET_ID` string constants.

## `deploy.publish` as a Tool (historical — built 2026-07-21, see the dated section below)

Per the original dispatch: `@jini/core`'s `ToolRegistry`/`ToolExecutor` boundary
(extraction-plan.md §2.5, §8 task 6) did not exist yet at the time this package was first ported.
`publishDeploy` in `tokens.ts` was a plain async function a pack's app-service could call
directly, with the intended future shape sketched inline as a comment. Task 6 has since landed
(`@jini/core`'s `tool-registry.ts` + `@jini/daemon`'s `tool-executor.ts`) and the sketch below is
now real, built code — see "## 2026-07-21 addition — `deploy.publish` wired as a real Tool
(`src/tool.ts`)" further down for what actually shipped and how it differs from this sketch:

```ts
toolRegistry.register({
  descriptor: { id: 'deploy.publish', /* input/output schema */ },
  handler: (principal, run, input, signal) => publishDeploy(input, targets),
  policy: { /* e.g. requires confirmation before an external publish */ },
});
```

so callers reach it only via `ToolExecutor.execute(principal, run, 'deploy.publish', input,
signal)` — never a direct handler reference, per the tool-execution boundary's anti-bypass rule
(§2.5). `publishDeploy` itself is unchanged by this — it's still the plain function; `src/tool.ts`
wraps it rather than replacing it.

## Explicitly deferred (not in this task's scope)

- ~~**Real `ToolRegistry`/`ToolExecutor` wiring**~~ — done, see the 2026-07-21 dated section below.
- **GitHub Pages target** — extraction-plan.md §10's roadmap prose names it alongside Vercel/
  Cloudflare Pages, but `deploy.ts` never implemented it (only `vercel-self` and
  `cloudflare-pages` exist in the origin). No `GitHubPagesDeployTarget` is added here; the
  `DeployTarget` port and `DeployTargetToken` many-token are already shaped so a future
  `github-pages.ts` adapter can bind in without touching this package's existing files.
- **Netlify target** — named in extraction-plan.md §2.2's example code (`netlifyTarget`) but,
  like GitHub Pages, has no implementation in the OD origin to port from.
- **The "flatten an HTML entry into a deploy file set" utility** — see "Dropped entirely" above.

## Vocabulary / boundary notes

- No `projectId`, `readProjectFile`, `listFiles`, or `validateProjectPath` anywhere in this
  package — verified by grep (see Programmer handoff report).
- No `Open Design`/`OD_`/`--od-stamp`/`/tmp/open-design` strings — the only "OD" mentions in
  `src/**` are provenance comments describing what was genericized (matching the existing
  convention in `packages/chat-core/src/*.ts` and `packages/daemon/src/*.ts`), not runtime
  identifiers or behavior.
- `DeployTarget` bound as a many-token (`jini.deployTarget`), matching the vocabulary firewall in
  root `AGENTS.md`/extraction-plan.md §12 C5: this is an engine-owned `Tool`-shaped capability
  (`Run`/`Agent`/`Tool` vocabulary), not an automation-domain `PipelineRun`/`WorkItem`.

## 2026-07-21 addition — `deploy.publish` wired as a real Tool (`src/tool.ts`)

Closes the gap the "historical" section above describes: `@jini/core`'s `ToolRegistry`
(`packages/core/src/tool-registry.ts`) and `@jini/daemon`'s `ToolExecutor`
(`packages/daemon/src/tool-executor.ts`) both exist now, and `packages/daemon/src/
delegated-tool-bridge.ts` is the established, already-shipped example of wiring a capability into
that boundary. This addition is the same shape, for `deploy.publish` instead of the delegated-tool
protocol bridge.

| Jini file | Origin | Transform |
|---|---|---|
| `src/tool.ts` | *(new — no OD origin; new design work, same category as `tool-executor.ts` itself)* | `createDeployPublishToolRegistration(options)` builds a `{descriptor, handler, policy}` `ToolRegistration` (the exact shape `@jini/core`'s `ToolRegistry.register` expects) that wraps the existing `publishDeploy`/`DeployTarget[]` machinery in `tokens.ts` — `tokens.ts` itself is untouched. `denyAllDeployPublishPolicy` and `createRoleGatedDeployPublishPolicy` are the two `ToolPolicy` implementations this file ships. |

**What was built:**

- `DEPLOY_PUBLISH_TOOL_ID = 'deploy.publish'` — the registry id.
- `createDeployPublishToolRegistration({ targets, policy?, requiresConfirmation?, timeoutMs? })` —
  returns a `ToolRegistration` a host passes straight to `ToolRegistry.register(...)`. The
  `handler` casts `ToolExecutionContext.input` (typed `unknown` by `@jini/core`'s own boundary
  design) back to `DeployPublishToolInput` and calls the existing `publishDeploy(input, targets)`
  — no duplicated dispatch logic, `tokens.ts`'s `publishDeploy` is still the single place that
  matches `targetId` against the bound `DeployTarget[]`.
- `denyAllDeployPublishPolicy: ToolPolicy` — `authorize()` returns `'deny'` unconditionally. This
  is `createDeployPublishToolRegistration`'s **default** when a caller omits `policy` entirely.
- `createRoleGatedDeployPublishPolicy(allowedRoles = [DEFAULT_DEPLOY_PUBLISH_ROLE])` — a usable,
  non-permissive `ToolPolicy` a host can opt into: allows only a `Principal` whose `roles` array
  contains one of `allowedRoles`. A `Principal` with `roles` undefined or `[]` is denied, not
  waved through.
- Both re-exported from `src/index.ts`'s existing barrel (`export * from './tool.js'`), alongside
  everything else this package exports.

**Authorization policy decision, and why deny-by-default (not e.g. "allow by default" or a
narrower partial default):** the task explicitly asked for a considered choice, not a guess. The
registration's default is `denyAllDeployPublishPolicy` — every call denied unless a host supplies
its own `policy` (a hand-rolled one, or `createRoleGatedDeployPublishPolicy`). Reasoning:

1. **`deploy.publish` is qualitatively different from every other tool wired into this boundary so
   far.** `echo`/`blocked`/etc. in `delegated-tool-bridge.test.ts` and `tool-executor.test.ts` are
   in-process fakes with no side effects outside the test. `deploy.publish` reaches real external
   infrastructure under the *caller's own cloud account* — `VercelDeployTarget`/
   `CloudflarePagesDeployTarget` (`src/vercel.ts`, `src/cloudflare-pages.ts`) make live HTTP calls
   that spend the operator's provider quota, publish content to a public, internet-reachable URL,
   and (when `metadata.customDomain` is set) create real DNS records. A wrongly-allowed call is
   not cheaply reversible and has an externally visible blast radius — the same category of risk
   `@jini/media`'s `DEFAULT_MEDIA_EXECUTION_POLICY` was hardened against (SEC-RB-010, commit
   `0a9c9c237`, `packages/media/src/policy.ts`), except deploy adds "publicly visible" and
   "mutates DNS" on top of "costly."
2. **This branch's own established discipline is deny-by-default for exactly this class of
   capability.** `0a9c9c237`'s commit message states the precedent directly: `policy.ts` "defaulted
   to enabled/unrestricted and let a request with no model bypass an explicit allowedModels list" —
   fixed to `DEFAULT_MEDIA_EXECUTION_POLICY = { mode: 'disabled' }`, with an omitted/blank field
   denied rather than waved through. `denyAllDeployPublishPolicy` and
   `createRoleGatedDeployPublishPolicy`'s "no roles → deny" branch both follow that same rule:
   omission must never read as permission.
3. **A narrower "allow" default was considered and rejected.** E.g. "allow any authenticated
   principal" (any non-empty `principal.id`) was rejected because `Principal.id` (`packages/core/
   src/principal.ts`) is documented as merely "opaque, stable identity — never assumed to be a
   product user id"; it carries no authorization semantics on its own, so gating on its mere
   presence is not actually a gate. "Allow if `principal.roles` is non-empty" (any role at all) was
   also rejected for the same reason `createAllowlistMediaPolicy`'s model check was hardened —
   *some* role existing says nothing about whether it's the *right* role for a real-money,
   externally-visible action; `createRoleGatedDeployPublishPolicy` requires a specific role
   (default `'deploy:publish'`) instead of merely "any role."
4. **`requiresConfirmation` was deliberately left unset by default**, not forced to `true`. The
   registration already denies-by-default at the policy layer; forcing `requiresConfirmation: true`
   on top would suggest the *only* protection here is an interactive confirmation prompt (skippable
   in a headless host with no `ExecutionDelegate.onConfirm` wired — `tool-executor.ts`'s
   `requestConfirmation` just parks forever with no delegate, or a delegate could set it to always
   confirm). A caller that wants that extra layer sets `requiresConfirmation: true` explicitly via
   `CreateDeployPublishToolRegistrationOptions`.

**Tests:** `src/__tests__/tool.test.ts`, 15 tests, 100%/100%/100%/100% (statements/branches/
functions/lines) on `tool.ts` specifically (`pnpm --dir packages/deploy exec vitest run
--coverage`). Coverage includes, mirroring the proof patterns already established in
`packages/daemon/src/__tests__/tool-executor.test.ts` and `delegated-tool-bridge.test.ts`:

- `denyAllDeployPublishPolicy` denies regardless of principal/input (both a principal with the
  "right" role and one with none — the policy doesn't even look at the principal).
- `createRoleGatedDeployPublishPolicy`: no `roles` field, empty `roles: []`, non-matching role,
  matching default role, and a caller-supplied `allowedRoles` list overriding the default — every
  branch of the `!roles || roles.length === 0` guard and the `.some(...)` membership check.
- `createDeployPublishToolRegistration`: descriptor id/description are set; `requiresConfirmation`/
  `timeoutMs` are genuinely *absent* (not merely `undefined`-valued — `'requiresConfirmation' in
  descriptor` is `false`) when omitted, and present when supplied, proving the
  `exactOptionalPropertyTypes`-driven conditional-spread branches both directions; defaults to
  `denyAllDeployPublishPolicy` by reference when `policy` is omitted; uses a caller-supplied policy
  instead when provided; the handler correctly dispatches through `publishDeploy` to the matching
  bound `DeployTarget`.
- **End-to-end through the real `ToolExecutor`** (`createToolExecutor` from `@jini/daemon`,
  `createToolRegistry` from `@jini/core` — not hand-rolled fakes of either): an unauthorized
  principal under the default policy is denied, the underlying `DeployTarget.publish` is never
  invoked (`target.lastInput` stays `undefined`), and the audit trail is exactly `['requested',
  'denied']` — proving the gate actually blocks the side effect, not just that a function returns
  `'deny'` in isolation. A principal with a non-matching role is denied the same way under
  `createRoleGatedDeployPublishPolicy`. A principal with the required role is allowed, the target's
  `publish` actually runs and returns its real result through `ToolExecutor`, and the audit trail
  is `['requested', 'authorized', 'started', 'completed']`. A final test proves the anti-bypass
  property structurally: a `ToolRegistry.list()` descriptor has no `handler`/`policy` property at
  all — the only path to actually invoking the handler is `ToolExecutor.execute`.

**Dependency note:** `@jini/deploy`'s **runtime** dependencies are unchanged (`@jini/core`,
`@jini/platform`, `undici`) — `createDeployPublishToolRegistration` only needs `@jini/core`'s
public `ToolPolicy`/`ToolRegistration`/`ToolAuthorizationContext` types, already available from
the existing `@jini/core` dependency. `@jini/daemon` was added as a **devDependency only**
(`package.json`), used solely by `src/__tests__/tool.test.ts` to run the registration through a
real `ToolExecutor` rather than a hand-rolled stand-in — proving the gate against the actual
boundary implementation, not a test double of it. No cycle: `@jini/daemon` does not depend on
`@jini/deploy` in any form.

**What's still NOT done (follow-ups, not silently unwired):**

- **`@jini/node-host`'s `createLocalNodeDaemon` does not auto-bind any `ToolExecutor`/
  `ToolRegistry` for *any* tool yet — this is not specific to `deploy.publish`.**
  `packages/node-host/src/create-local-node-daemon.ts` (the comment directly above its
  `createAgentExecutor(...)` call, ~line 212) explicitly notes `ToolExecutorToken` is "NOT
  auto-bound here" because it "needs a caller-supplied `ToolRegistry`" — i.e. no host preset in
  this repo currently wires *any*
  registered tool (this one included) into a running daemon automatically. A caller building a
  real host today must manually: construct a `ToolRegistry` via `@jini/core`'s
  `createToolRegistry()`, call `registry.register(createDeployPublishToolRegistration({ targets,
  policy }))` (and register whatever other tools it wants), construct a `ToolExecutor` via
  `@jini/daemon`'s `createToolExecutor({ registry, delegate? })`, and hold onto that executor
  itself to call `.execute(...)` from wherever it dispatches tool calls (an HTTP route, an
  ACP-delegate bridge, etc.). This gap pre-dates this task and isn't closed by it.
  `@jini/deploy` still has zero named consumers today (`UNLOCKED.md`'s `@jini/deploy` entry:
  `"consumers": []`) — that entry is unchanged by this addition since no other package was made to
  depend on `@jini/deploy` here.
- **`ToolExecutor`-level cancellation does not propagate into an in-flight publish.** The handler
  in `tool.ts` receives `ToolExecutionContext.signal` (the abort signal `ToolExecutor` drives for
  `timeoutMs`/`cancel(executionId)`) but has nothing to forward it to: `DeployTarget.publish`/
  `checkReachability` (`types.ts`) take no `AbortSignal` parameter, and neither `vercel.ts` nor
  `cloudflare-pages.ts`'s `fetch(...)` calls accept one from outside (only `reachability.ts`'s own
  *internal* timeout controller passes a `signal:` to its `fetch`). A `ToolExecutor` timeout or
  external `cancel()` still correctly marks the *call* `'timed-out'`/`'cancelled'` in the audit
  trail and returns control to the caller, but the underlying HTTP request(s) already in flight
  inside a target's `publish` keep running to completion (or their own unrelated internal
  timeout) in the background. Threading a real `AbortSignal` through `DeployTarget.publish` down
  to every `fetch` call in both targets is a real, non-trivial change to this package's existing,
  already-tested HTTP flow — flagged here rather than attempted as a drive-by inside this task.
- **No input schema validation.** `ToolDescriptor` (`@jini/core`) has no schema field today, and
  this task didn't add one — `tool.ts`'s handler does a bare `as DeployPublishToolInput` cast on
  `ToolExecutionContext.input` (typed `unknown` by design) with no runtime shape check.
  Malformed/missing fields surface only as whatever `publishDeploy`/the matched `DeployTarget`
  itself throws (e.g. a `DeployError` for an unknown `targetId`, or a `TypeError` further down a
  target's own file-iteration if `files` isn't actually an array) — same posture `publishDeploy`
  already had before this task, not a regression, but also not hardened further here.

## 2026-07-21 addition — `NetlifyDeployTarget` (`src/netlify.ts`), the second-of-two roadmap deploy targets

**Verified the "still deferred" note above against current code before doing anything else, per
this task's instruction not to trust a possibly-stale deferred-note without checking**: re-read
`src/tool.ts` in full. Real `ToolExecutor`/`ToolRegistry` wiring is genuinely done (the
"historical" section above's sketch became real code in the 2026-07-21 `tool.ts` addition already
documented further up this file, commit `416f9dc8a`) — nothing further to do there. The
`PROP-deploy-cancellation-contract-2026-07-21.md` proposal remains untouched and unimplemented,
exactly as it should stay pending architect sign-off — no code in this addition changes
`DeployTarget.publish`/`checkReachability`'s signature, and `netlify.ts` has the same
un-cancellable-in-flight-fetch posture the "What's still NOT done" list above already documents for
Vercel/Cloudflare (not a new gap this addition introduces — see below).

**What was open and cleanly scopeable:** of the two roadmap-named-but-never-origin-implemented
targets (GitHub Pages, Netlify — see "Explicitly deferred" above), Netlify was picked because its
deploy protocol is the closer analog to `VercelDeployTarget`'s already-ported shape (create a
deployment from a content-addressed file manifest, poll a `state`/`readyState` field to a terminal
value, then wait for the resulting URL to become reachable) — GitHub Pages has no equivalent
digest-deploy API and would need a materially different design (Pages "deployments" are created
from a pre-uploaded tar.gz artifact via a separate Actions-artifact-adjacent upload flow), left
deferred, unchanged from the note above.

**Built against Netlify's own published OpenAPI 2.0 contract** (`https://open-api.netlify.com`,
fetched and parsed directly — not an LLM summary of the docs, which two independent doc-page
fetches during this task actually disagreed with each other on the deploy `state` enum, exactly the
kind of hallucination risk worth cross-checking a primary source for on real external-API code).
The ground truth used: `POST /sites/{site_id}/deploys` (async SHA1 file-digest manifest → `{id,
required[], state}`), `PUT /deploys/{deploy_id}/files/{path}` (per-required-hash upload), `GET
/deploys/{deploy_id}` (status poll), `GET /sites?name=&filter=all` / `POST /sites` (find-or-create
the target site), and — the one field this API's own inline JSON-schema types as a bare `string`
with no enum, so it was cross-checked against the *canonical* source for that exact field: the
`state` **query-filter enum** on `GET /sites/{site_id}/deploys` (the same field, used as a request
filter, which *is* enumerated) — `new, pending_review, accepted, rejected, enqueued, building,
uploading, uploaded, preparing, prepared, processing, processed, ready, error, retrying`. `'ready'`
is the only success terminal state; `'error'`/`'rejected'` are the only failure terminal states
(`NETLIFY_FAILURE_STATES`); everything else keeps polling.

| Jini file | Origin | Transform |
|---|---|---|
| `src/netlify.ts` | *(new — no OD origin; `deploy.ts` never implemented a Netlify target)* | `NetlifyDeployTarget implements DeployTarget`, same shape as `VercelDeployTarget`/`CloudflarePagesDeployTarget`. |

**Design decisions:**

- **Site find-or-create, keyed off a deterministic derived name** — `deriveNetlifySiteName(projectName)`
  is `jini-<safeDnsLabel(projectName)>`, the same deterministic (no random suffix) pattern
  `cloudflare-pages.ts`'s `deriveCloudflarePagesProjectName` already established, so repeated
  publishes of the same logical project land on the same Netlify site. Unlike Cloudflare Pages
  (whose project-lookup-by-name endpoint is a direct `GET .../pages/projects/{name}`), Netlify has
  no "get site by bare name" endpoint — `GET /sites/{site_id}` requires the real `site_id` (a UUID
  or a full `*.netlify.app`/custom domain), so lookup goes through the documented `GET
  /sites?name=&filter=all` list-and-filter endpoint instead, matching on the returned `name` field
  case-insensitively.
- **Site-name-conflict recovery is narrower than Cloudflare's, and says why in a comment.** Netlify
  site names are **globally unique across all of Netlify**, not scoped to one account (unlike a
  Cloudflare Pages project name, which only has to be unique within the account). A creation
  conflict is therefore ambiguous — it could mean *this* account already owns the name (a benign
  create/create race, recoverable by re-listing) or a different account owns it outright (not
  recoverable). `ensureNetlifySite` re-lists after a failed create and uses the result only if
  found in the caller's *own* account's sites; otherwise it rethrows the original creation error
  rather than assuming recovery the way `cloudflarePagesAlreadyExists`'s retry does.
  Tested (`recovers from a site-creation conflict by re-listing...` / `throws the original creation
  error when the site truly cannot be found...` in `netlify.test.ts`).
- **SHA1 for the file manifest, Node's built-in `crypto`, not a new dependency.** Netlify's digest
  protocol requires SHA1 specifically (unlike Cloudflare Pages' direct-upload protocol, which only
  needs *a* stable, collision-resistant key and was already swapped from `blake3-wasm` to SHA256 for
  that reason in the original Cloudflare port) — SHA1 here is a fixed wire-protocol requirement, not
  a free implementation choice, so no analogous swap applies; still zero new package dependency
  (`node:crypto`, already used by `cloudflare-pages.ts`).
- **Duplicate-content files upload once.** Netlify's own manifest protocol already declares every
  path→hash mapping in the create-deploy call; `required[]` lists hashes, not paths, and per
  Netlify's own docs "if you have two files with the same SHA1, you don't have to upload both of
  them." `createNetlifyDeploy` builds a `hash → first-matching-file` map and `publish()` uploads
  each required hash exactly once, regardless of how many manifest paths share it (tested:
  "...treats duplicate-content files as one upload").
- **No protected-response detection in `checkReachability`,** unlike Vercel's
  `isVercelProtectedResponse`. No documented Netlify equivalent to Vercel's Deployment
  Protection/SSO auth-wall convention was found; inventing a heuristic detector without a
  documented signal to key it off risks false-positives more than it helps, so `checkReachability`
  is a bare `checkDeploymentUrl(url)` call — the same choice `cloudflare-pages.ts`'s own
  `checkReachability` already made for the same reason.
- **Poll attempt/backoff constants (30 attempts, 1s×5 then 2s) copied verbatim from
  `pollVercelDeployment`,** for consistency across this package's targets rather than inventing a
  third timing convention — not a Netlify-specific requirement.
- **Cancellation is out of scope, matching the existing posture, not a new gap.** Same as
  Vercel/Cloudflare (see "What's still NOT done" above): `publish`/`checkReachability` take no
  `AbortSignal`; a `ToolExecutor` timeout still correctly marks the *call* timed-out but cannot stop
  an in-flight Netlify `fetch`. Explicitly not addressed here — that is exactly the scope
  `PROP-deploy-cancellation-contract-2026-07-21.md` already covers and is gated on architect
  sign-off; this addition does not re-litigate it or unilaterally add a signal parameter to only one
  target (which would fragment the `DeployTarget` contract further, not fix it).

**Tests:** `src/__tests__/netlify.test.ts`, 17 tests: token-missing short-circuit with no network
call; the full happy path (find existing site → create deploy → upload only the required hash →
poll to `ready` → reachable URL, asserting the manifest/required-upload/URL-candidate shapes
precisely); site auto-creation when none exists; the site-name-conflict recovery and
cannot-recover cases above; terminal `'error'` state surfacing `error_message`, and terminal
`'rejected'` state with no `error_message` falling back to a generic message; site-lookup-failure
error-message passthrough and the generic-fallback-message case; non-JSON response handling;
missing-site-id and missing-deploy-id guards; a failed required-file upload surfacing the
provider's error; skipping a `required` hash that isn't in the sent manifest (defensive, should
never happen but doesn't crash); the duplicate-content-one-upload case with nested/space-containing
path URL-encoding; poll-budget exhaustion via fake timers (mirroring `vercel.test.ts`'s own
exhaustion test, same 30-attempt/~55s-of-fake-time shape); and `checkReachability`. Package-wide
`pnpm --dir packages/deploy exec vitest run --coverage`: 134/134 tests pass; `netlify.ts` itself is
98.83% statements/98.83% lines/83.33% branches/100% functions (the 2 uncovered branch outcomes are
the `!siteName` guard in `publish()`, defensively unreachable in practice — `deriveNetlifySiteName`
always falls back to a non-empty `'site'` label before sanitizing, so it can never actually return
empty — same accepted shape as this package's other targets' analogous defensive-unreachable
guards, e.g. `cloudflare-pages.ts`'s own `!projectName` check, already named in this package's
`vitest.config.ts` threshold-comment as a known, accepted class of gap). Package-wide aggregate
99.57/80.85/100/99.57, comfortably above the package's configured 98/78/98/98 ratchet-baseline
threshold gate (`packages/deploy/vitest.config.ts`) — a slight *improvement* over the pre-existing
99.7/79.9/100/99.7 baseline noted in that file's own comment on branches (80.85 > 79.9), with a
trivial (<0.2pt) statements/lines dip from `netlify.ts` itself not being at 100%, still well within
the gate. `pnpm --dir packages/deploy exec tsc --noEmit` clean.

**Barrel:** `src/index.ts` gained `export * from './netlify.js';` — no other file changed
(`tokens.ts`'s `publishDeploy`/`DeployTargetToken` and `tool.ts`'s `ToolRegistration` already
dispatch generically over whatever `DeployTarget[]` a host binds, so `NetlifyDeployTarget` slots in
with zero changes to either).
