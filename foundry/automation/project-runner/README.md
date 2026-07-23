# project-runner

The **execution runtime** for Jini's agent-driven extraction — the one piece the automation stack is missing (AI-Dev-Shop is declarative pipeline defs; ADS-memory is durable decisions; this is the executor). See `foundry/docs/jini-port/extraction-plan.md` §12 C6.

## Scope (build minimal first — do NOT build a distributed scheduler up front)

- A local **SQLite ledger** keyed by AI-Dev-Shop's existing job state machine (`queued → leased/running → succeeded` + `retry_scheduled | waiting_for_human | failed | cancelled` + lease expiry). Adopt that machine; do not invent a second one.
- **One worker**, filesystem sandbox, manual approval gate.
- Spawns coding-agent CLIs by consuming `@jini/agent-runtime` **only as a pinned, published leaf subprocess/stream library** — never reuses the engine's `RunLifecycle`/`ToolRegistry`/event schemas (vocabulary firewall).
- `ledger/` (committed): the extraction tasks as a hashed DAG derived from extraction-plan §8. `tasks.md`/`pipeline-state.md` are generated views; runner state is authoritative.
- `leases/`, `.sandbox/` (gitignored): ephemeral.

## Bootstrap order

1. Prove the extraction loop **manually** on packages 1–3 (`@jini/protocol`, `@jini/platform`, `@jini/sidecar`) using the N/O CI gates as plain scripts.
2. Only then wire this runner to drive the remaining §8 tasks.

## Cloud execution

`claim`/`complete` (see `src/cli/`) are the entry points an external executor —
a Claude Code cloud routine, not an in-process `JobExecutor` — drives instead of
`worker.ts`. `cloud-routine-prompt.md` is the prompt template for that; use it
verbatim rather than re-deriving one, it encodes real lessons from prior runs.
