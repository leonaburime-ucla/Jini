# Startup Reminders

Tracks one-time setup prompts. The Coordinator reads this file on every startup
and skips any reminder listed under Dismissed.

To re-enable a reminder, tell the Coordinator: "re-enable reminder: <name>"
or delete the line from the Dismissed section.

---

## Dismissed

(none)

---

## slash-commands-setup

Available template commands: `/spec` `/plan` `/tasks` `/implement` `/code-review` `/clarify` `/agent` `/consensus` `/debate` `/audit-work` `/cowork` `/handoff`
Note: `/agent` works only after the template is installed into a host that supports custom slash commands. In Claude, use natural language such as "talk to architect" or "switch to programmer" if `/agent <name>` errors.
Placeholder note: `<AI_DEV_SHOP_ROOT>` means the toolkit folder path (usually `AI-Dev-Shop/`).

### Claude Code

Never bulk-copy the templates blindly — a plain `cp -r` would silently overwrite
any same-named command the host already has (for example an existing `/code-review`).
Always run the collision check first and show the user the result before installing.

If the user says "yes" or "set up slash commands":

1. Run the collision check (read-only, no writes):
   ```bash
   bash <AI_DEV_SHOP_ROOT>/framework/operations/scripts/install-slash-commands.sh --check
   ```
   This classifies every command as NEW / IDENTICAL / CONFLICT and flags any that
   also exist at user level (`~/.claude/commands`) or are project-specific (`gstack-*`).
2. Show the user the summary. If there are CONFLICTs, name them and ask whether to
   keep the host's existing command (default) or replace it. Do not decide for them.
3. Install:
   ```bash
   bash <AI_DEV_SHOP_ROOT>/framework/operations/scripts/install-slash-commands.sh --install
   ```
   This installs NEW commands, skips IDENTICAL, and SKIPS conflicts. Add `--overwrite`
   only for conflicts the user agreed to replace (originals are backed up to `*.ads-bak`);
   add `--include-project` to also install the `gstack-*` commands.
4. Confirm what was installed/skipped, then offer to dismiss the reminder.

After setup, `/spec`, `/plan`, `/code-review`, `/consensus`, `/debate`, `/audit-work`, `/cowork`, `/handoff`, etc. work directly in chat (except any you chose not to install).

### Gemini CLI

Slash commands are not natively supported. Use Option B:
paste the contents of `<AI_DEV_SHOP_ROOT>/framework/slash-commands/<command>.md` as your message.

### Codex CLI

Slash commands are not natively supported. Use Option B:
paste the contents of `<AI_DEV_SHOP_ROOT>/framework/slash-commands/<command>.md` as your message.

### Claude.ai (web)

Slash commands and filesystem access are not available. Use Option B:
open `<AI_DEV_SHOP_ROOT>/framework/slash-commands/<command>.md` on your machine, copy the contents,
and paste as your message. You will also need to paste relevant project files manually.

### Generic LLM

Slash commands are not supported. Use Option B:
open `<AI_DEV_SHOP_ROOT>/framework/slash-commands/<command>.md` on your machine, copy the contents,
and paste as your prompt along with any relevant project files.

### Host Detection

- Prefer the actual runtime/session identity over installed binaries on disk
- If startup code already knows the host, pass it explicitly to resolver scripts or set `AI_DEV_SHOP_HOST`
- Task tool + Bash tool available → usually Claude Code
- Bash tool available, no Task tool → Gemini CLI or Codex CLI; do not guess if both are installed
- No tool access → Claude.ai or Generic LLM
- If uncertain, ask the user which host they are on or stay conservative
