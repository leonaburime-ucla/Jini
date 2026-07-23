# Jini Foundry

`foundry/` is the workshop around the Jini engine. It groups the repository material used
to design, exercise, automate, and integrate Jini without making that material part of the
publishable `@jini/*` runtime.

## Contents

- `automation/` — the executable development control plane and project runner.
- `docs/` — architecture, porting plans, provenance, recon, and retained design debates.
- `integrations/` — product adapters and compatibility fixtures, beginning with Open Design.

Public runnable hosts and sample workspaces live at the repository root under
[`examples/`](../examples/README.md), not in the foundry.

## Boundary

The dependency direction is one-way:

```text
foundry integrations / automation  ──►  @jini/* packages
@jini/* packages                    ──╳  foundry/**
```

Engine packages must not import anything under `foundry/`. This keeps Jini neutral and
allows Open Design, Open Marketing, Tovu Runner, Zana, and future hosts to consume the same
published engine without inheriting a favored product shell.

For project context, begin with
[`docs/jini-port/START-HERE.md`](docs/jini-port/START-HERE.md) and then
[`docs/jini-port/extraction-plan.md`](docs/jini-port/extraction-plan.md).

Run the shared Chrome + Electron reference experience from the repository root with
`pnpm playground`. See
[`../examples/reference-web/README.md`](../examples/reference-web/README.md) and
[`../examples/reference-desktop/README.md`](../examples/reference-desktop/README.md).
