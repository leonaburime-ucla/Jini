# Capability Verification

This repo must not treat model, client, or host capabilities as timeless facts.

Capability claims drift. Vendor docs change. CLI releases change. Local installs vary. Environment policy can disable features that the product technically supports.

## Verification Stack

Treat every capability claim as a 4-layer check:

1. **Vendor support**
   - the official product docs say the capability exists
2. **Client/runtime exposure**
   - the actual host you are using exposes the capability through a command, flag, API field, feature list, or runtime behavior
3. **Environment allowance**
   - sandboxing, org policy, auth, network, file access, and installed version do not block it
4. **Repo/framework usage**
   - AI Dev Shop is actually configured to use the capability

For delegated helpers, layer 4 is not satisfied merely because the host can spawn subagents. AI Dev Shop only counts delegated subagent use as `enabled` when the spawn prompt bootstraps the resolved repo persona and the helper confirms that persona file was loaded.

Only call a capability **enabled** when all relevant layers are satisfied.

## Allowed Status Words

- `enabled`
  - verified on the current host or environment and usable now
- `unavailable`
  - verified absent or blocked on the current host or environment
- `unverified`
  - not proven locally and not safe to describe as enabled or unavailable

Do not collapse `unverified` into `unavailable`.

## Verification Order

1. Prefer a **local probe** on the current host.
2. If no reliable local probe exists, use **official vendor docs** and record the verification date.
3. If neither is available, mark the capability `unverified`.

## Negative Claims

Negative claims need evidence too.

Examples:

- acceptable: `Codex sub-agent spawning is enabled on this host because \`codex features list\` reports \`multi_agent true\`.`
- acceptable: `Browser automation is enabled on this host because \`claude mcp list\` contained \`playwright\`.`
- acceptable: `Gemini CLI sub-agent spawning is unverified here because this repo does not yet have a reliable local probe and no current official verification was loaded.`
- acceptable: `Browser automation is unavailable in this Codex session because \`codex mcp list\` did not contain \`playwright\`.`
- not acceptable: `Gemini CLI does not support sub-agents` unless the current host or official docs actually prove that

## User-Facing Language

When explaining capability status to users, separate these clearly:

- `supported by the product`
- `enabled on this current host`
- `blocked by this environment`
- `not yet verified here`

Example:

`What we're doing: running sequentially in one session. Why: sub-agent spawning is not verified on this current host, so the framework should not pretend isolated helper agents are active. Next: I'll keep context small with offload files and narrow discovery passes.`

`What we're doing: debugging the live site in a browser. Why: this host has a configured browser automation provider, so the agent can inspect the rendered app instead of guessing from static code alone. What we need from you: usually nothing if the local app can start with the existing project command. Next: I'll reproduce the issue, inspect console and network evidence, then verify the fix in the same browser loop.`

## Repo Implementation

The current repo implementation uses:

- Capability probe catalog: `framework/routing/capability-probes.tsv`
- Local probe script: `harness-engineering/validators/probe_host_capabilities.sh`
- Runtime mode resolver: `harness-engineering/validators/resolve_subagent_mode.sh`
- Coarse host summary: `framework/routing/compatibility-matrix.md`

Current browser-automation mapping:

- capability name: `browser_automation`
- current provider: Playwright MCP when the current host's `mcp list` output contains `playwright`
- recommended TTL: `7` days because local MCP server configuration can drift faster than CLI help surfaces or feature flags
- future providers should extend the mapping instead of renaming the capability

Current live Supabase verification mapping:

- capability name: `supabase_mcp`
- current provider: Supabase MCP when the current host's `mcp list` output contains `supabase`
- recommended TTL: `7` days because local MCP server configuration can drift faster than CLI help surfaces or feature flags
- future providers should extend the mapping instead of renaming the capability

The compatibility matrix is a planning aid. The local probe is the source of truth for explicit verification passes when a reliable probe exists. Startup should use the resolver's current-host-only check instead of shelling out to the full capability report.

## Extending To Another Host

This pattern is not limited to Codex, Claude Code, or Gemini CLI.

To add another host:

1. Add one or more rows to `framework/routing/capability-probes.tsv`
2. Prefer a real local probe when the host exposes one
3. Use `manual_only` when the capability can only be verified through vendor docs or controlled runtime testing
4. Re-run `bash harness-engineering/validators/probe_host_capabilities.sh`

If a host has no reliable probe yet, that is still useful information. Keep the row and leave the capability `unverified` instead of pretending the host is outside the system.
