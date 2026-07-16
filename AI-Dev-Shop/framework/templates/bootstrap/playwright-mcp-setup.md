# Playwright MCP Setup

This is optional host-side setup for AI Dev Shop's current `browser_automation` provider.

Important split:

- your client owns the MCP install
- the repo only detects and uses the capability when present

That keeps the toolkit modular if a better browser automation provider replaces Playwright later.

## Current Provider

- Capability name: `browser_automation`
- Current provider mapping: Playwright MCP

## Install On Your Client

Codex CLI:

```bash
codex mcp add playwright npx "@playwright/mcp@latest"
```

Claude Code:

```bash
claude mcp add playwright npx @playwright/mcp@latest
```

Gemini CLI:

```bash
gemini mcp add playwright npx @playwright/mcp@latest
```

## Verify The Client Setup

Codex CLI:

```bash
codex mcp list
```

Claude Code:

```bash
claude mcp list
```

Gemini CLI:

```bash
gemini mcp list
```

Then verify the repo-level capability view:

```bash
bash harness-engineering/validators/probe_host_capabilities.sh --host <detected-host> --capability browser_automation
```

The repo should only describe live browser analysis as enabled when that probe reports `enabled`.

## Official References

- Playwright docs: `https://playwright.dev/docs/next/getting-started-mcp`
- Playwright MCP repo: `https://github.com/microsoft/playwright-mcp`
