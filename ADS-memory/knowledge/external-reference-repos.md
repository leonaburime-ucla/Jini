# External reference repos — tracked for portable capabilities

Local clones of other open-source AI-app-builder-class projects, reviewed for
concrete features Jini could adopt as isolated modules. Not `@jini/*` dependencies —
reference material only, reviewed manually.

## bolt.diy (stackblitz-labs/bolt.diy)

- Local clone: `/Users/la/Desktop/Programming/OSS-Repos/bolt.diy`
- Remote: `origin=https://github.com/stackblitz-labs/bolt.diy.git`
- **Watermark (2026-07-18): HEAD = `2e254ac19a696394030601bc602f54945b12bfc4`, dated 2026-02-05, confirmed `0/0` divergence from `origin/main`** — the local clone is exactly current as of this check. To check for upstream updates later: `cd /Users/la/Desktop/Programming/OSS-Repos/bolt.diy && git fetch origin --quiet && git rev-list --left-right --count HEAD...origin/main` — a non-zero right-count means upstream has moved since this watermark.

### Concrete findings, verified by reading real files (not assumed from memory)

- **Deploy (Netlify/Vercel/GitHub Pages, user's original ask) — bolt.diy actually has FOUR targets, including GitLab which wasn't in the original ask**: `app/components/deploy/{NetlifyDeploy,VercelDeploy,GitHubDeploy,GitLabDeploy}.client.tsx`, a shared `DeployButton.tsx`/`DeployAlert.tsx`/`deployUtils.ts`, plus API routes (`api.netlify-deploy.ts`, `api.vercel-deploy.ts`, etc.) and per-provider stores (`lib/stores/netlify.ts`, `lib/stores/vercel.ts`). **Directly relevant**: `@jini/deploy` already exists with Vercel+Cloudflare Pages adapters done; GitHub Pages/Netlify are explicitly deferred per `packages/deploy/source-map.md`. This is real, concrete reference material for finishing those deferred targets — worth reading `deployUtils.ts` and the Netlify/GitHub-Pages-specific routes before building Jini's own.
- **Supabase integration — a full, real reference implementation, not a stub**: connection management (`useSupabaseConnection` hook, `SupabaseConnection.tsx`, a settings tab `SupabaseTab.tsx`), plus query/variables API routes (`api.supabase.query.ts`, `api.supabase.variables.ts`). **Directly relevant**: this is a genuinely concrete candidate implementation for the speculative `@jini/capability-providers` package (dispatched tonight, 10:30pm) — Supabase alone bundles auth+db+storage+realtime, so it could validate multiple of that package's stub interfaces (`AuthProvider`, `StorageProvider`, `DbProvider`, `RealtimeProvider`) against one real reference rather than four separate ones.
- **Git integration — GitHub AND GitLab, not just generic git**: clone/import (`GitUrlImport.client.tsx`), stats/branches/projects API routes for both providers (`githubApiService.ts`, `gitlabApiService.ts`, `api.github-branches.ts`, `api.gitlab-branches.ts`, etc.), and a `api.git-proxy.$.ts` route (a server-side proxy, likely to work around browser CORS on git operations). Not yet mapped to any existing or planned `@jini/*` package — a real gap, would need its own scoping pass.
- **Expo app creation — thinner than the original ask implied.** Only found `app/components/workbench/ExpoQrModal.tsx` — a QR-code pairing modal (the standard Expo Go "scan to open on your device" flow), not a full React Native scaffolding system. Worth knowing before assuming this is a rich feature to port; it's a small, narrow piece.

**Isolation requirement (per project owner):** anything adopted from bolt.diy must land as its own isolated module — do not entangle bolt.diy-derived code directly into existing `@jini/*` packages without a clean port boundary, same discipline as every other extraction in this project.

## Still to review (not yet researched)

- **open-lovable** (likely `mendableai/open-lovable`, an open clone of Lovable.dev) — not yet cloned/reviewed.
- **dyad** (dyad.sh, local-first open-source AI app builder) — not yet cloned/reviewed.

Same review discipline as bolt.diy when picked up: clone locally, verify real files (don't assume from memory), map concrete findings to specific `@jini/*` package gaps or flag as genuinely new capability, and get sign-off before treating any port as locked-in.
