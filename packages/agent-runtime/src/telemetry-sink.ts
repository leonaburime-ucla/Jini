/**
 * @module telemetry-sink
 *
 * Port replacing the OD analytics naming baked into OD's
 * `runtimes/runs/run-artifacts.ts` (`run_finished.artifact_count`,
 * `runAskedUserQuestion` → `run_finished.asked_user_question`,
 * `deriveActivationMilestones`'s PostHog `$set_once` person-property
 * scheme) and `run-lifecycle-analytics.ts` (not present as a separate file
 * on this branch — its concerns are folded into `run-artifacts.ts` here).
 * None of that OD-schema logic is ported.
 *
 * Per r1b §1b: the engine emits a generic run-lifecycle event stream; the
 * host maps it to its own analytics schema. `data` is intentionally
 * `Record<string, unknown>` — artifactCount, askedUserQuestion, stopReason,
 * etc. are opaque to the engine, populated by whatever
 * `ArtifactTaxonomy`/`PromptAugmenter` implementation the host wires in.
 */
export interface RunLifecycleEvent {
  type: 'run_started' | 'run_finished' | 'run_failed' | 'tool_use' | 'artifact_written';
  runId: string;
  agentId: string;
  at: number;
  data?: Record<string, unknown>;
}

export interface TelemetrySink {
  emit(event: RunLifecycleEvent): void;
  reportFinalizedMessage?(input: { runId: string; text: string; meta: Record<string, unknown> }): void;
}

/** Discards every event. Safe default until a host supplies a real sink. */
export const noopTelemetrySink: TelemetrySink = {
  emit: () => {},
};
