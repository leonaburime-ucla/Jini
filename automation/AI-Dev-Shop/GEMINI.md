# AI Dev Shop (speckit) — Gemini CLI Entry Point

`<AI_DEV_SHOP_ROOT>` means the path to this toolkit folder (typically `AI-Dev-Shop/`).

**CRITICAL INSTRUCTION:** Read `<AI_DEV_SHOP_ROOT>/AGENTS.md` on startup for full operating instructions: all agent definitions, pipeline stages, routing rules, convergence policy, dispatch protocol, slash commands, and human checkpoints.

## Gemini CLI: Spawning Agents

Use your available tools to dispatch each specialized agent. Include their `<AI_DEV_SHOP_ROOT>/agents/<name>/skills.md`, the relevant `<AI_DEV_SHOP_ROOT>/skills/*/SKILL.md` files listed in their Skills section, the active spec with hash, and the specific task directive.

## Gemini CLI: Command Usage

Slash commands are not natively supported in Gemini CLI. Use Option B from `<AI_DEV_SHOP_ROOT>/AGENTS.md`: open `<AI_DEV_SHOP_ROOT>/framework/slash-commands/<command>.md`, paste the contents as your prompt, and replace `$ARGUMENTS`.

## Gemini CLI: Session Records

Gemini CLI has no lifecycle hooks, so session logging is manual. When the user asks to "save this session" or is wrapping up: write the Summary, Questions & Answers, and Decisions into `<ADS_MEMORY_ROOT>/sessions/CURRENT-SESSION.md`, then run
`bash <AI_DEV_SHOP_ROOT>/harness-engineering/hooks/session-record.sh update --models "Gemini 3.1 Pro (High)<plus any peers>" --user "<name>"`
followed by `... session-record.sh finalize --topic "<short topic>"`. See the Session Records section in `<AI_DEV_SHOP_ROOT>/AGENTS.md`.
