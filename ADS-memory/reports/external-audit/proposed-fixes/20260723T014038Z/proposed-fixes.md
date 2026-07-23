# Proposed Fixes — External Audit 20260723T014038Z

Disposition table and full patches. See the main report for rationale: `ADS-memory/reports/external-audit/runs/20260723T014038Z-external-audit-report.md`.

**Update 20260723T022155Z: items 1–5 implemented and committed as `32d98c109` (local, unpushed). Verified clean via `tsc --noEmit` on `packages/agent-runtime`, `packages/http`, `packages/node-host`, `packages/desktop-host`, plus `check-engine-boundaries.ts`/`guard.ts`.**

## agree-implement (ready, pending user go-ahead)

### 1. SSRF: swap to `validateBaseUrlResolved` (Codex)

Apply identically in `packages/agent-runtime/src/providers/azure-chat.ts`, `google-messages.ts`, `ollama-chat.ts`:

```diff
-import { validateBaseUrl } from './connection-guard.js';
+import { defaultDnsLookup, validateBaseUrlResolved } from './connection-guard.js';

-const baseUrlCheck = validateBaseUrl(baseUrl);
+const baseUrlCheck = await validateBaseUrlResolved(baseUrl, defaultDnsLookup);
```

### 2. xai.ts exact-prefix match instead of substring (Fable)

`packages/http/src/xai.ts`, inside `xaiOauthCompleteRoute`'s catch:

```diff
     } catch (error) {
       const message = error instanceof Error ? error.message : String(error);
-      if (message.includes('OAuth state')) {
+      if (message.startsWith(`${resolved.providerConfig.providerId} OAuth state`)) {
         return err(validationError(message));
       }
```

### 3. Own xAI listener ref in node-host, stop on daemon stop (Fable)

`packages/node-host/src/create-local-node-daemon.ts`:

```diff
-import { AGENT_DEFS } from '@jini/agent-runtime';
+import { AGENT_DEFS, type OAuthCallbackListener } from '@jini/agent-runtime';
```

```diff
   const mediaRoutesDeps = { ... };
+
+  const xaiListenerRef: { current: OAuthCallbackListener | null } = { current: null };
```

```diff
       stopPromise = (async () => {
         await closeHttpServer(server);
+        const xaiListener = xaiListenerRef.current;
+        xaiListenerRef.current = null;
+        if (xaiListener) {
+          try {
+            await xaiListener.stop();
+          } catch {
+            // Best-effort — the listener self-closes on its own timeout anyway.
+          }
+        }
         if (registryPath !== null) {
```

```diff
-  registerXaiRoutes(app, { dataDir: config.dataDir }, { resolvedPortRef });
+  registerXaiRoutes(app, { dataDir: config.dataDir, listenerRef: xaiListenerRef }, { resolvedPortRef });
```

### 4. Tauri dirExists never-throws contract (Fable)

`packages/desktop-host/src/tauri/tauri-shell.ts`:

```diff
     async dirExists(path: string): Promise<boolean> {
-      const exists = await surfaces.fs.exists(path);
-      if (!exists) return false;
-      const info = await surfaces.fs.stat(path);
-      return info.isDirectory;
+      try {
+        const exists = await surfaces.fs.exists(path);
+        if (!exists) return false;
+        const info = await surfaces.fs.stat(path);
+        return info.isDirectory;
+      } catch {
+        return false;
+      }
     },
```

### 5. publish.yml env-var injection fix (Fable)

```diff
       - name: Mirror newly published packages to GitHub Packages
         if: steps.changesets.outputs.published == 'true'
         run: |
           echo "@jini:registry=https://npm.pkg.github.com" >> ~/.npmrc
           echo "//npm.pkg.github.com/:_authToken=${{ secrets.GITHUB_TOKEN }}" >> ~/.npmrc
-          echo '${{ steps.changesets.outputs.publishedPackages }}' | jq -c '.[]' | while read -r pkg; do
+          echo "$PUBLISHED_PACKAGES" | jq -c '.[]' | while read -r pkg; do
             name=$(echo "$pkg" | jq -r '.name')
             dir="packages/${name#@jini/}"
             echo "Publishing $name from $dir to GitHub Packages"
             pnpm --dir "$dir" publish --registry https://npm.pkg.github.com --no-git-checks || true
           done
         env:
           NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
+          PUBLISHED_PACKAGES: ${{ steps.changesets.outputs.publishedPackages }}
```

### 6. research.ts timeout/AbortSignal (Codex, note-only — needs authoring, no patch given)

Add an injected timeout (safe default, e.g. 30s matching OD's original), an `AbortController`, and clear the timer in `finally`. Not a mechanical patch — needs real authoring against `tavilySearch`'s current signature.

### 14. Verify `@jini` npm scope ownership (Fable structural finding)

Not a code fix — a manual check: does an npm account/org the user controls already own the `@jini` scope on npmjs.com? If unregistered, the names this pipeline is being built to publish are squattable today, independent of any token.

## agree-defer

- **7. R7 boundary fix** — architecture decision needed first (promote `@jini/media`/`@jini/capability-providers`, or explicit allowlist exception), see report's Decision Points For User #2.
- **8. connectors.ts bearer-token-in-query migration** — crosses into `types.ts`/`adapter.ts`, needs its own scoped task.
- **9. model-proxy.ts client-disconnect abort wiring** — depends on `sse.ts` close semantics, needs its own look.
- **10. DNS-rebinding-resistant address pinning** — residual hardening beyond fix #1, real but not urgent.
- **11. Publish-activation semantics documentation + access:restricted-vs-public decision** — product decision, see report's Decision Points For User #3.
- **13. Confirm origin-guard Host/Origin validation on all /api routes** — needs reading `api-security-middleware.ts`/`origin.ts`, outside this audit's reviewed set.

## disagree

- **12. Reconsider consuming the xAI OAuth listener on a stateless forged `?error=`** — Fable's own analysis shows this is a deliberate, defensible, low-impact trade-off. Not changing without a stronger reason.
