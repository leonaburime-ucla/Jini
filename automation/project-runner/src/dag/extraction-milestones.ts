/**
 * The ten milestones from docs/jini-port/extraction-plan.md §8 ("First 10
 * extraction tasks"), transcribed verbatim (titles trimmed, gate text kept in
 * full) so `build-dag.ts` can turn them into a hashed WorkItem DAG.
 *
 * This is intentionally a static, hand-transcribed list rather than a
 * markdown parser reading extraction-plan.md at runtime: the plan's prose
 * numbering and gate text are not a stable machine format, and a parser would
 * be its own source of silent drift. Drift between this list and the source
 * doc is instead caught by hashing the doc section — see `hash.ts` and
 * `PlanHashDriftError` — which forces an explicit human re-derivation instead
 * of a parser guessing at a changed structure.
 */
export interface ExtractionMilestone {
  /** 1-based milestone number, matching extraction-plan.md §8's numbered list. */
  readonly milestone: number;
  readonly title: string;
  /** The gate text from §8 that must pass before the milestone's approval task can be granted. */
  readonly gate: string;
}

export const EXTRACTION_MILESTONES: readonly ExtractionMilestone[] = [
  {
    milestone: 1,
    title: 'Harnesses + sync-ownership manifest',
    gate: 'N health-boot from tarballs; a known upstream daemon patch applies via the path transform.',
  },
  {
    milestone: 2,
    title: '@jini/protocol — run events/errors/cursors/cancellation/idempotency, seeded from packages/contracts with OD nouns stripped',
    gate: 'Fixture compiles without OD contracts; no sync-owned OD path changed.',
  },
  {
    milestone: 3,
    title: 'Typed tokens + bindings + resolver + startup diagnostics in @jini/core',
    gate: 'Tests prove missing/duplicate/version errors are legible; patch canary green.',
  },
  {
    milestone: 4,
    title: '@jini/platform + @jini/sidecar verbatim, path-mirrored + patch-router',
    gate: 'Packed build; a real historical packages/platform patch routes cleanly.',
  },
  {
    milestone: 5,
    title: 'RunLifecycle + replayable EventLog (@jini/daemon), runs keyed on contextRef',
    gate: "Minimal-host start/stream/cancel/resume a fake run; OD characterization tests emit the same ordered event sequence; identifier lint proves no project/conversation noun.",
  },
  {
    milestone: 6,
    title: 'ToolExecutor boundary',
    gate: 'Minimal-host one allowed + one denied tool call, resumable confirmation, timeout, cancellation, output truncation, audit record — no HTTP involved.',
  },
  {
    milestone: 7,
    title: '@jini/agent-runtime with instance registry (built-ins generated; external agent packs)',
    gate: "Minimal-host drives OD's mocks/ replay CLIs end-to-end; a historical runtimes/defs/* patch re-targets via the router; delegated-path security patches update both OD mapping and Jini.",
  },
  {
    milestone: 8,
    title: 'Store ports + @jini/sqlite',
    gate: 'Minimal-host survives restart + cursor replay; a Postgres stub compiles against the async ports; conformance suite has no OD schema nouns.',
  },
  {
    milestone: 9,
    title: 'Runs + chat app-services (no HTTP yet), then @jini/http + @jini/cli',
    gate: "Same fixture run works via HTTP and CLI --json --prompt-file; adding a command pack needs no central SUBCOMMAND_MAP edit.",
  },
  {
    milestone: 10,
    title: 'products/open-design/daemon/ adapter behind the facade + external-consumption proof',
    gate: 'OD boots green; OD/Open-Marketing/Tovu consume packed tarballs; a representative upstream security patch applies and tests the RUNNING impl (not a dead copy). This canary stays in CI permanently.',
  },
] as const;
