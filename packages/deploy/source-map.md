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

## `deploy.publish` as a Tool (deferred — task 6 not built yet)

Per the dispatch: `@jini/core`'s `ToolRegistry`/`ToolExecutor` boundary (extraction-plan.md §2.5,
§8 task 6) does not exist yet. `publishDeploy` in `tokens.ts` is today a plain async function a
pack's app-service can call directly. Once task 6 lands, the intended shape (documented inline in
`tokens.ts`) is:

```ts
toolRegistry.register({
  descriptor: { id: 'deploy.publish', /* input/output schema */ },
  handler: (principal, run, input, signal) => publishDeploy(input, targets),
  policy: { /* e.g. requires confirmation before an external publish */ },
});
```

so callers reach it only via `ToolExecutor.execute(principal, run, 'deploy.publish', input,
signal)` — never a direct handler reference, per the tool-execution boundary's anti-bypass rule
(§2.5). This package does not attempt to build that gate itself.

## Explicitly deferred (not in this task's scope)

- **Real `ToolRegistry`/`ToolExecutor` wiring** — see above; task 6, separate work.
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
