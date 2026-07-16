---
name: codebase-memory-mcp-integration
version: 0.1.0
last_updated: 2026-06-25
description: Managed integration boundary for the upstream Codebase Memory MCP repo, local binary install, and AI Dev Shop graph-backend behavior.
---

# Codebase Memory MCP Integration

This folder is the AI Dev Shop integration boundary for Codebase Memory MCP.

## Layout

- `upstream/`
  - Local git checkout of `https://github.com/DeusData/codebase-memory-mcp.git`.
  - Ignored by git so a user can keep the third-party checkout inside the
    toolkit folder without committing upstream source history.
  - Created only when a human or Coordinator runs:
    `bash harness-engineering/validators/check_codebase_memory_capability.sh --download`
- `bin/`
  - Local binary install target for `codebase-memory-mcp`.
  - Ignored by git because the binary is a generated third-party artifact.
  - Created only when a human or Coordinator runs:
    `bash harness-engineering/validators/check_codebase_memory_capability.sh --install-binary`

## Why Not Agent Config

Codebase Memory MCP can install itself into several agent hosts. AI Dev Shop
does not let an analysis workflow silently mutate host MCP configuration.

The supported setup path installs a local binary with upstream `install.sh`
using `--skip-config`. Agents may then call the binary directly through CLI
mode, with `HOME` pointed at the project-owned local artifact directory:

```bash
HOME="<ADS_MEMORY_ROOT>/.local-artifacts/codebase-memory-mcp-home" \
  <AI_DEV_SHOP_ROOT>/integrations/codebase-memory-mcp/bin/codebase-memory-mcp \
  cli index_repository '{"repo_path":"<TARGET_REPO>"}'
```

This keeps repo memory local to the project, avoids global agent configuration
drift, and makes generated indexes disposable.

## Setup Model

Check current availability without changing files:

```bash
bash harness-engineering/validators/check_codebase_memory_capability.sh
```

Download the managed upstream checkout:

```bash
bash harness-engineering/validators/check_codebase_memory_capability.sh --download
```

Update the managed checkout:

```bash
bash harness-engineering/validators/check_codebase_memory_capability.sh --update
```

Install or refresh the local binary without MCP config mutation:

```bash
bash harness-engineering/validators/check_codebase_memory_capability.sh --install-binary
```

## Common Commands

Resolve the generated project name after indexing:

```bash
HOME="<ADS_MEMORY_ROOT>/.local-artifacts/codebase-memory-mcp-home" \
  <AI_DEV_SHOP_ROOT>/integrations/codebase-memory-mcp/bin/codebase-memory-mcp \
  cli list_projects
```

Inspect architecture:

```bash
HOME="<ADS_MEMORY_ROOT>/.local-artifacts/codebase-memory-mcp-home" \
  <AI_DEV_SHOP_ROOT>/integrations/codebase-memory-mcp/bin/codebase-memory-mcp \
  cli get_architecture '{"project":"<PROJECT_NAME>","aspects":["all"]}'
```

Find graph nodes by name:

```bash
HOME="<ADS_MEMORY_ROOT>/.local-artifacts/codebase-memory-mcp-home" \
  <AI_DEV_SHOP_ROOT>/integrations/codebase-memory-mcp/bin/codebase-memory-mcp \
  cli search_graph '{"project":"<PROJECT_NAME>","name_pattern":".*Graphify.*","limit":20}'
```

Search source text through the indexed graph:

```bash
HOME="<ADS_MEMORY_ROOT>/.local-artifacts/codebase-memory-mcp-home" \
  <AI_DEV_SHOP_ROOT>/integrations/codebase-memory-mcp/bin/codebase-memory-mcp \
  cli search_code '{"project":"<PROJECT_NAME>","pattern":"Graphify","limit":20}'
```

Retrieve a source snippet:

```bash
HOME="<ADS_MEMORY_ROOT>/.local-artifacts/codebase-memory-mcp-home" \
  <AI_DEV_SHOP_ROOT>/integrations/codebase-memory-mcp/bin/codebase-memory-mcp \
  cli get_code_snippet '{"project":"<PROJECT_NAME>","qualified_name":"<QUALIFIED_NAME>"}'
```

Detect changed files relative to the indexed state:

```bash
HOME="<ADS_MEMORY_ROOT>/.local-artifacts/codebase-memory-mcp-home" \
  <AI_DEV_SHOP_ROOT>/integrations/codebase-memory-mcp/bin/codebase-memory-mcp \
  cli detect_changes '{"project":"<PROJECT_NAME>"}'
```

## Agent Use

Coordinator and CodeBase Analyzer should run the capability check before relying
on this integration. If unavailable or unverified, they should explain what
Codebase Memory MCP is and ask before downloading, installing, or configuring
anything.
