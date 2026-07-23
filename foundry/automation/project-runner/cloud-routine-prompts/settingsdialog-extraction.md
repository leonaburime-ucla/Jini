# Cloud prompt — `SettingsDialog.tsx` shell + clean tabs (Claude Code)

Per the consolidation map, `SettingsDialog.tsx` is Section B ("own feature") — but unlike the
other items dispatched so far, this one ships MULTIPLE independent pieces (a reusable dialog
shell + several small clean tabs), not one cohesive slice. Scope discipline matters: this is an
8,538-line file where most of the mass stays OD-specific.

```text
You are working in the Jini repository. Your task is to extract the
reusable "tabbed settings dialog" shell plus 5 small, clean, generic tabs
from Open Design's SettingsDialog.tsx into @jini/ui, leaving every
OD-specific tab and the shared shell state that's genuinely OD-bound
untouched. Work only on this task's branch and finish with a draft PR;
never push directly to main.

Before editing any file, complete and print this exact Reference Preflight:

1. Read foundry/docs/jini-port/god-components-extraction-plan.md's "Consolidation
   map" section and quote the exact row covering SettingsDialog.tsx --
   filed under Section B, target packages/ui/src/features/settings-dialog/
   (shell) + packages/ui/src/features/settings-dialog/tabs/{appearance,
   notifications,language,instructions,integrations}/.
2. Jini branch and SHA. This environment has ONE repo source -- the
   vendored snapshot at
   foundry/integrations/open-design/reference/components-original/SettingsDialog.tsx
   is the source of truth.
3. Confirm you read SettingsDialog.tsx (8,538 lines) in full, specifically
   the SettingsSection tab-type declaration (18 values) and each in-scope
   tab's actual render body (not just its signature). Per r6 section 1.3,
   the full tab classification is:
   | Tab | Verdict |
   |---|---|
   | execution | MIXED, OD-specific (AMR/Vela wallet + local-CLI agent chrome) -- SKIP |
   | instructions | GENERIC shape (plain textarea bound to a string field) -- IN SCOPE |
   | memory | pre-extracted, renders MemorySection -- SKIP (not this task) |
   | media | OD-specific data, duplicates the byok pattern -- SKIP |
   | mcpClient | already known generic, renders McpClientSection -- SKIP (separate cluster, features/source-config-list/, not this task) |
   | composio | OD/vendor-specific -- SKIP |
   | integrations | Generic mechanism, 100% branded content (multi-client "install me as an MCP server" snippet generator: Claude Code/Codex/Cursor/VS Code/Antigravity/Zed/Windsurf) -- IN SCOPE, parameterize the hardcoded 'open-design' literals |
   | language | GENERIC (locale radio-tile grid) -- IN SCOPE |
   | appearance | GENERIC (theme + accent-color picker) -- IN SCOPE |
   | critiqueTheater | OD-specific -- SKIP |
   | notifications | GENERIC (sound toggle/picker + browser Notification-permission flow) -- IN SCOPE |
   | pet | OD-specific (own file) -- SKIP |
   | designSystems | OD-specific (own file) -- SKIP |
   | projectLocations | OD-specific (own file) -- SKIP |
   | privacy | likely generic, NOT fully verified by r6 -- read it yourself and decide; if you ship it, say explicitly that you're the first to verify it, if you skip it, say why |
   | about | OD/Electron-specific -- SKIP |
   | orbit | OD-specific (~800 lines, OD's autonomous agent-run automation) -- SKIP |
   | routines | OD-specific (own file, not deep-verified) -- SKIP |
4. Confirm you read foundry/docs/jini-port/recon/r6-god-component-internals.md
   section 1.3 (the full analysis this task is derived from).
5. Confirm the SHELL itself is separable: r6 notes 8 of 17 real tabs are
   ALREADY separate files the shell merely mounts -- that's your proof the
   shell has no hidden dependency on any specific tab's content. Extract it
   as generic chrome: tab list/navigation, panel switching, whatever shared
   dialog affordances (close, resize, etc.) are genuinely tab-agnostic.
6. Read packages/ui/src/features/connectors/ and
   packages/ui/src/features/progress-card/ as structural examples of the
   ports+dependencies+components+barrel shape and the i18n/Phase-8.5/purity
   discipline expected here -- NOTE: both still use the OLD flat layout;
   this task should use the NEW layout instead (see rule below).
7. Record the exact green-baseline commands you'll re-run at the end.

Read these Jini references before designing the slice:
- AGENTS.md
- foundry/docs/jini-port/START-HERE.md
- foundry/docs/jini-port/god-components-extraction-plan.md (especially the
  Consolidation map and the i18n/React-layout policy sections near the top)
- foundry/docs/jini-port/recon/r6-god-component-internals.md section 1.3
- packages/ui/README.md and packages/ui/source-map.md
- foundry/integrations/open-design/reference/dev-skills-original/fixing-open-design-web/SKILL.md

Implementation rules:
- Ship the shell as one feature (features/settings-dialog/ -- tab
  navigation/switching chrome, generic over an array of {id, label, panel}
  tab descriptors a host supplies) and each in-scope tab as its own small
  slice or flat component under features/settings-dialog/tabs/<name>/,
  whichever fits its actual complexity -- appearance/notifications/language/
  instructions are small enough they may not need full ports+dependencies
  ceremony (use judgment, matching r5/r6's "vertical-slice vs flat
  component" distinction elsewhere in this repo); integrations is more
  involved (the multi-client snippet generator) and likely needs real
  ports.ts for "which clients, what snippet format."
- Use the NEW layout (decided 2026-07-17, see packages/ui/README.md) for
  every feature folder you create: types.ts/constants.ts/rules.ts/ports.ts/
  dependencies.ts/index.ts stay at the top level; hooks/ and components/
  move under a react/ subfolder.
- Keep public @jini surfaces product-neutral. Do not add Open Design names,
  imports, or string identities to packages/@jini -- including in the
  integrations tab, where the ENTIRE point is genericizing OD's own
  branded MCP-install snippets. Do not ship a single hardcoded
  'open-design'/'OD_' string anywhere in the new code.
- Follow the i18n policy in god-components-extraction-plan.md: every
  user-facing string wired through useT() with the English string as the
  key, verified with a real test mounting under I18nProvider with a
  translated dictionary.
- Apply the Phase 8.5 audit from the fixing-open-design-web SKILL.md on
  every new file.
- Run the package typecheck/tests, pnpm guard, and a purity grep for
  product-identity strings -- the purity grep matters more than usual here
  given the integrations tab's origin is literally OD-branded content.
  Report concrete outputs, not just command names.

Finish with a concise summary: the full Reference Preflight output
(including the full 18-tab classification you worked from and your call on
privacy), files/features shipped (shell + which tabs), OD behavior left
behind, validation results, all test/typecheck/guard/purity results, and the
draft PR URL (or, if gh isn't available/authenticated in this environment,
the branch name and a comparison URL for a human to open the PR manually).
```
