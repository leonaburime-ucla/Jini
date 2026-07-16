# Compatibility Matrix

Maps AI Dev Shop host capabilities to host environments. Use this before adopting a feature to know what usually works, then confirm unstable capabilities with the local capability probe instead of trusting the matrix blindly.

Provider-specific planning behavior is not defined here. Resolve that from `framework/spec-providers/active-provider.md` and the matching provider profile.

**Hosts covered:** Claude Code · Claude.ai (web) · Codex CLI · Gemini CLI · Generic LLM (prompt-only)
Placeholder note: `<AI_DEV_SHOP_ROOT>` means the path to this toolkit folder (usually `AI-Dev-Shop/`).

Local verification:

```bash
bash harness-engineering/validators/probe_host_capabilities.sh --host <detected-host>
bash harness-engineering/validators/resolve_subagent_mode.sh --host <detected-host>
```

For the current environment, prefer the probe above plus `harness-engineering/runtime/capability-verification.md`. Treat this matrix as a planning default, not the final truth for version-sensitive features. Use the resolver for startup; use the full probe when you need an explicit capability audit.

---

## Feature Matrix

| Feature | Claude Code | Claude.ai (web) | Codex CLI | Gemini CLI | Generic LLM |
|---------|------------|-----------------|-----------|------------|-------------|
| **Slash commands** (`/spec`, `/plan`, `/tasks`, `/implement`, `/code-review`, `/clarify`, `/consensus`, `/debate`, `/audit-work`, `/cowork`, `/handoff`) | ✅ Full (after one-time setup) | ❌ Not supported | ❌ Not supported | ❌ Not supported | ❌ Not supported |
| **Option B manual workflow** (paste template contents as prompt) | ✅ Full | ✅ Full | ✅ Full | ✅ Full | ✅ Full |
| **Task tool / agent spawning** | ✅ Full | ❌ Not supported | ⚠️ Runtime-verified; probe locally | ⚠️ Unverified here; verify locally or with vendor docs | ❌ Not supported |
| **MCP server management** | ✅ Full | ❌ Not supported | ✅ Full | ✅ Full | ❌ Not supported |
| **Live browser automation** (`browser_automation`, current provider: Playwright MCP) | ⚠️ Probe locally; enabled only when a browser MCP server is configured | ❌ Not supported | ⚠️ Probe locally; enabled only when a browser MCP server is configured | ⚠️ Probe locally; enabled only when a browser MCP server is configured | ❌ Not supported |
| **Live Supabase verification** (`supabase_mcp`, current provider: Supabase MCP) | ⚠️ Probe locally; enabled only when a Supabase MCP server is configured | ❌ Not supported | ⚠️ Probe locally; enabled only when a Supabase MCP server is configured | ⚠️ Probe locally; enabled only when a Supabase MCP server is configured | ❌ Not supported |
| **Simulated multi-agent** (single session, roleplay stages) | ✅ Possible | ✅ Possible | ✅ Possible | ✅ Possible | ✅ Possible |
| **Filesystem reads** (project spec roots such as `ADS-memory/specs/`, `project-knowledge-template/`, `framework/spec-providers/`, `framework/templates/`, `framework/workflows/`, `framework/slash-commands/`) | ✅ Native | ❌ Requires paste | ✅ Native | ✅ Native | ❌ Requires paste |
| **Filesystem writes** (state file, spec artifacts) | ✅ Native | ❌ Requires copy-out | ✅ Native | ✅ Native | ❌ Requires copy-out |
| **Bash tool** (TestRunner: `npm test`, `pytest`, etc.) | ✅ Full | ❌ Not supported | ✅ Full | ⚠️ Limited | ❌ Not supported |
| **SHA-256 content hashing** (spec hash, ADR hash) | ✅ Via Bash | ⚠️ Manual only | ✅ Via Bash | ✅ Via Bash | ⚠️ Manual only |
| **Pipeline state file** (`pipeline-state.md`) | ✅ Auto-written | ⚠️ Manual upkeep | ✅ Auto-written | ✅ Auto-written | ⚠️ Manual upkeep |
| **Constitution gates** (blocking escalation on violation) | ✅ Full | ✅ Full (manual routing) | ✅ Full (manual routing) | ✅ Full (manual routing) | ✅ Full (manual routing) |
| **[NEEDS CLARIFICATION] marker resolution** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | ✅ Full |
| **FEAT number assignment** | ✅ Auto (reads `<ADS_MEMORY_ROOT>/reports/pipeline/`) | ⚠️ Manual | ⚠️ Manual | ⚠️ Manual | ⚠️ Manual |
| **Parallel task execution** (`[P]` markers in tasks.md) | ✅ Full (Task tool) | ❌ Sequential only | ⚠️ Runtime-verified; probe locally | ⚠️ Unverified here; verify locally or with vendor docs | ❌ Sequential only |
| **Observer Agent** (runs alongside pipeline) | ✅ Full | ⚠️ Deferred pass only | ⚠️ Deferred pass only | ⚠️ Deferred pass only | ⚠️ Deferred pass only |
| **Memory-store / project knowledge persistence** | ✅ Auto (file writes) | ⚠️ Manual copy-out | ✅ Auto | ✅ Auto | ⚠️ Manual copy-out |

**Legend:** ✅ Full native support · ⚠️ Version-sensitive, partial, or requires verification · ❌ Not supported

---

## Host Notes

### Claude Code (full feature set)

All features work as documented. Slash commands require the one-time setup:

```bash
cp -r <AI_DEV_SHOP_ROOT>/framework/slash-commands/ .claude/commands/
```

The Task tool enables true parallel agent dispatch and isolated context windows per agent. This is the recommended host for production use of this framework.

MCP servers are supported. The current browser-automation provider is Playwright MCP. Add it with:

```bash
claude mcp add playwright npx @playwright/mcp@latest
```

Do not describe live browser automation as enabled until `claude mcp list` or `bash harness-engineering/validators/probe_host_capabilities.sh --host claude-code --capability browser_automation` proves that `playwright` is configured on the current machine.

Do not describe live Supabase verification as enabled until `claude mcp list` or `bash harness-engineering/validators/probe_host_capabilities.sh --host claude-code --capability supabase_mcp` proves that `supabase` is configured on the current machine.

### Claude.ai (web)

No Task tool, no slash commands, no filesystem access. All pipeline stages run in a single conversation with manual routing. Use Option B: paste the contents of `framework/slash-commands/<command>.md` directly as your message.

For SHA-256 hashes, compute manually using your OS shell or a web tool and paste the result into the artifact. Pipeline state file must be maintained by copy-pasting the current state into a local file between sessions.

### Codex CLI

Filesystem reads and writes work natively. Slash commands are not supported; use Option B. Bash tool available for test running.

Do not hardcode task-spawning assumptions from memory alone. Verify current capability status with `bash harness-engineering/validators/probe_host_capabilities.sh` or `codex features list`.

MCP servers are supported. The current browser-automation provider is Playwright MCP. Add it with:

```bash
codex mcp add playwright npx "@playwright/mcp@latest"
```

Do not describe live browser automation as enabled until `codex mcp list` or `bash harness-engineering/validators/probe_host_capabilities.sh --host codex-cli --capability browser_automation` proves that `playwright` is configured on the current machine.

Do not describe live Supabase verification as enabled until `codex mcp list` or `bash harness-engineering/validators/probe_host_capabilities.sh --host codex-cli --capability supabase_mcp` proves that `supabase` is configured on the current machine.

If Codex subagent spawning is available, do not assume spawned helpers automatically inherit AI Dev Shop repo personas. Codex platform helpers are only valid delegated AI Dev Shop agents when the spawn prompt explicitly bootstraps `agents/<resolved-agent>/skills.md` and the helper confirms it loaded.

For `/audit-work`-style peer dispatch, the visible dispatch-copy path strategy should translate across OSes, but the shell snippets in this repo are still Bash-oriented and are not yet verified on native Windows shells.

### Gemini CLI

Filesystem reads and writes work natively. Bash tool availability depends on your Gemini CLI configuration — verify before relying on TestRunner automation. Slash commands not supported; use Option B.

Some Gemini CLI capabilities still require local or vendor verification in this repo. If the probe cannot prove a feature, describe it as `unverified`, not `unsupported`.

MCP servers are supported. The current browser-automation provider is Playwright MCP. Add it with:

```bash
gemini mcp add playwright npx @playwright/mcp@latest
```

Do not describe live browser automation as enabled until `gemini mcp list` or `bash harness-engineering/validators/probe_host_capabilities.sh --host gemini-cli --capability browser_automation` proves that `playwright` is configured on the current machine.

Do not describe live Supabase verification as enabled until `gemini mcp list` or `bash harness-engineering/validators/probe_host_capabilities.sh --host gemini-cli --capability supabase_mcp` proves that `supabase` is configured on the current machine.

For `/audit-work`-style peer dispatch, the visible dispatch-copy path strategy should translate across OSes, but the shell snippets in this repo are still Bash-oriented and are not yet verified on native Windows shells.

### Generic LLM (prompt-only, no tools)

Paste all relevant context into the prompt manually. Use Option B for every pipeline stage. SHA-256 hashes must be computed outside the LLM session. Pipeline state tracking is fully manual. Constitution gates and spec integrity checks rely on the LLM following instructions — there is no enforcement mechanism.

---

## Choosing a Workflow Mode

| Your situation | Recommended approach |
|---------------|---------------------|
| Claude Code with full tool access | Option A — slash commands + Task tool |
| Any LLM with filesystem access | Option B — manual prompts + auto file writes |
| Any LLM without filesystem access | Option B — manual prompts + manual file management |
| Single-session (no multi-agent) | Run each pipeline stage sequentially in one conversation; paste previous stage output as context for the next |

---

## Known Limitations by Feature

**Parallel tasks (`[P]` markers):**
Claude Code supports true isolated agent dispatch. Other hosts must be treated as runtime-sensitive instead of assumed from memory. Use the local capability probe to decide whether `[P]` means real parallel isolation or only a sequencing hint on the current install.

If parallel agent support is unavailable or unverified on the current host, execute `[P]` tasks sequentially and keep discovery/validation output compact so accumulated context does not sprawl.

**Browser automation via MCP:**
Treat browser automation as a host capability, not a repo guarantee. The current provider mapping uses a configured `playwright` MCP server. If the current host cannot prove that provider is configured, keep the work in code/test/manual-debug mode instead of pretending live browser evidence exists.

**SHA-256 hashing on web hosts:**
Without Bash, generate hashes with `shasum -a 256 <file>` on macOS/Linux or `Get-FileHash -Algorithm SHA256 <file>` on Windows. Paste the result into the spec header. A missing or unverified hash degrades spec integrity guarantees but does not break the pipeline — flag it in the pipeline state Notes section.

**External audit transport on Windows:**
The current peer-audit transport design is `stdin`-first, with a shared temporary repo-visible dispatch fallback when a peer needs file reads and cannot access ignored paths. That should be portable, but the shell examples and preflight snippets are still Bash-flavored. Treat native Windows shells as unverified until a PowerShell or cross-platform helper is added.

**Observer Agent on non-Claude Code hosts:**
The Observer's LLM-as-judge pass and weekly scoring still work — they are read-only analysis tasks. What degrades is real-time interleaving with the pipeline. Run the Observer as a deferred pass after each feature ships rather than alongside the pipeline.
