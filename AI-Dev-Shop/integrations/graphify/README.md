---
name: graphify-integration
version: 0.1.0
last_updated: 2026-06-06
description: Managed integration boundary for the upstream Graphify repo, copied skill references, and AI Dev Shop wrapper behavior.
---

# Graphify Integration

This folder is the AI Dev Shop integration boundary for Graphify.

## Layout

- `upstream/`
  - Local git checkout of `https://github.com/safishamsi/graphify.git`.
  - Ignored by git so a user can keep third-party downloads inside the toolkit folder without committing the whole upstream repo.
  - Created only when a human or Coordinator runs:
    `bash harness-engineering/validators/check_graphify_capability.sh --download`
- `upstream-skill/codex/`
  - Copy of Graphify's upstream Codex skill and reference sidecars.
  - Kept as an integration reference, not as the active AI Dev Shop behavior.

## Why Not `harness-engineering/`

`harness-engineering/` owns policy, validators, runtime checks, and quality gates.
It should not contain mutable third-party source checkouts. Keeping the upstream
repo under `integrations/graphify/upstream/` keeps the downloaded dependency close
to AI Dev Shop while preserving a clean boundary:

- harness checks whether Graphify is available
- skills describe when agents may use Graphify
- integration folders hold third-party references and managed checkouts

## Update Model

Update the managed checkout:

```bash
bash harness-engineering/validators/check_graphify_capability.sh --update
```

Refresh the copied upstream Codex skill reference after an upstream update:

```bash
bash harness-engineering/validators/check_graphify_capability.sh --sync-skill
```

For a complete upstream refresh:

```bash
bash harness-engineering/validators/check_graphify_capability.sh --update --sync-skill
```

Check current availability without changing files:

```bash
bash harness-engineering/validators/check_graphify_capability.sh
```

Graphify CLI installation is still separate from the source checkout. Preferred
installers are `uv tool install graphifyy` or `pipx install graphifyy`; the
validator reports which installer capabilities are present.
