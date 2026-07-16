# Integrations

This folder holds optional third-party integration boundaries for AI Dev Shop.
Integration folders are where the project keeps lightweight wrapper files,
reference docs, copied skill metadata, and local-only upstream checkouts for
external tools.

The important rule is that large third-party downloads are not committed here.
They may exist on a developer machine after setup, but they are ignored by git
so the repository stays small and does not vendor full upstream projects.

## What Belongs Here

- Small integration documentation and wrapper files maintained by this project.
- Copied reference material needed to explain how an external tool connects to
  AI Dev Shop.
- Optional local-only source checkouts under integration-specific ignored
  folders, such as `graphify/upstream/`.
- Local virtual environments or generated artifacts used only while developing
  or validating an integration.

Do not commit bulky upstream repositories, dependency installs, build outputs,
or generated run artifacts in this folder.

Runtime outputs from integration tools should go under the project knowledge
tree when they are meant to be retained. For Graphify, the canonical output
location is:

```text
<ADS_MEMORY_ROOT>/reports/graphify-out/
```

For Codebase Memory MCP, keep the local cache home out of source control:

```text
<ADS_MEMORY_ROOT>/.local-artifacts/codebase-memory-mcp-home/
```

## Graphify

Graphify is intentionally not included as a committed upstream source checkout
for space purposes. The lightweight Graphify integration files can live in
`graphify/`, but the full upstream repository belongs in the ignored local path:

```bash
integrations/graphify/upstream/
```

Download it only when you need to inspect, update, validate, or use the local
Graphify source integration. From the AI Dev Shop root, run:

```bash
bash harness-engineering/validators/check_graphify_capability.sh --download
```

The checkout comes from:

```text
https://github.com/safishamsi/graphify.git
```

Keeping Graphify as an optional local download avoids bloating this repository,
keeps third-party source history separate from AI Dev Shop, and makes it clear
which files are project-owned versus upstream-owned.

Graphify run output should not be left at the toolkit root or inside analyzed
subfolders as `graphify-out/`. The AI Dev Shop Graphify freshness validator can
prepare a reports-backed output directory and print the path to pass through
Graphify's `GRAPHIFY_OUT` environment variable:

```bash
GRAPHIFY_OUT="$(python3 harness-engineering/validators/check_graphify_freshness.py <target-repo> --prepare-output --print-output-path)" \
  graphify update <target-repo> --force
```

For Graphify-specific update and sync commands, see
`integrations/graphify/README.md`.

## Codebase Memory MCP

Codebase Memory MCP is intentionally not included as a committed upstream source
checkout. The lightweight integration files can live in
`codebase-memory-mcp/`, but the full upstream repository belongs in the ignored
local path:

```bash
integrations/codebase-memory-mcp/upstream/
```

Download it only when you need to inspect, update, validate, or use the local
Codebase Memory MCP integration. From the AI Dev Shop root, run:

```bash
bash harness-engineering/validators/check_codebase_memory_capability.sh --download
```

The checkout comes from:

```text
https://github.com/DeusData/codebase-memory-mcp.git
```

Install its local binary only after the checkout exists:

```bash
bash harness-engineering/validators/check_codebase_memory_capability.sh --install-binary
```

The installer command above passes `--skip-config` to the upstream installer so
it does not mutate agent MCP configuration. Indexing should use a project-owned
local home under `<ADS_MEMORY_ROOT>/.local-artifacts/`, for example:

```bash
HOME="<ADS_MEMORY_ROOT>/.local-artifacts/codebase-memory-mcp-home" \
  <AI_DEV_SHOP_ROOT>/integrations/codebase-memory-mcp/bin/codebase-memory-mcp \
  cli index_repository '{"repo_path":"<TARGET_REPO>"}'
```

For Codebase Memory MCP-specific setup and query commands, see
`integrations/codebase-memory-mcp/README.md`.

## Other Integrations

Each integration should document its own expected local downloads, install
commands, ignored paths, and reason for being optional. Prefer a small committed
boundary plus an explicit setup command over committing a complete third-party
tool tree.
