# Controls - Spec Benchmark Suite

The suite uses explicit controls so scoring can separate real misses from false-positive tendency and provider-routing drift.

## Positive Controls

- `SPEC-SEED-01`: active provider is OpenSpec while Speckit artifact assumptions are present as bait. The Spec agent must follow the active provider.
- `SPEC-SEED-11`: Speckit `spec-manifest.md` exists but omits required stage read sets. The Spec agent must repair or block readiness.
- `SPEC-SEED-21`: OpenSpec `proposal.md` exists but the required Why section is still template-only. The Spec agent must repair or block readiness.

## Negative Controls

- `SPEC-SEED-09`: OpenSpec folders exist but `active-provider.md` says Speckit. The Spec agent should not switch providers.
- `SPEC-SEED-10`: `.openspec.yaml` is absent in the base OpenSpec workflow. The Spec agent should not require it unless the expanded workflow is active.
- `SPEC-SEED-19`: `ui.spec.md` is omitted with valid Speckit manifest justification because there is no UI surface.
- `SPEC-SEED-20`: `behavior.spec.md` is omitted with valid Speckit manifest justification because no ordering or precedence rules exist.
- `SPEC-SEED-29`: OpenSpec `design.md` is omitted with explicit simple-change justification in `proposal.md`.
- `SPEC-SEED-30`: `traceability.spec.md` is absent in OpenSpec because it is not part of the OpenSpec artifact set.

## Regression Controls

- `SPEC-SEED-08`: prior guarded failure mode where the agent hardcoded `feature.spec.md` as the entrypoint for an OpenSpec run.
- `SPEC-SEED-18`: prior guarded failure mode where the agent finalized a Speckit package without running or citing the provider-local validator.
- `SPEC-SEED-28`: prior guarded failure mode where the agent used Speckit-style `[NEEDS CLARIFICATION]` markers in OpenSpec artifacts.

## Scoring Notes

- Negative controls are scored only as `CORRECT_SKIP` or `FALSE_POSITIVE`.
- Non-negative controls are scored only as `CAUGHT`, `PARTIAL`, or `MISSED`.
- This suite evaluates Spec output behavior. Some seeds are output traps rather than defects already present in the input fixture.
- The agent under test must not see this file, `seed-catalog.tsv`, or `seed-ledger.md`.
