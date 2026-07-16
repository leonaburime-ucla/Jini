# Controls — Architect Eval Suite

Suite kind: `benchmark`

Positive controls (fatal invariants):

- `SEED-ARCH-01` — compliance_auditability must activate given explicit SOC 2
  and traceability requirements
- `SEED-ARCH-04` — microservices must be blocked for a 5-FTE team with no
  microservices experience and no Kubernetes

Negative controls (false-positive restraint):

- `SEED-ARCH-02` — do not activate tenant_isolation for a single-operator
  platform serving enterprise customers (multi-customer ≠ multi-tenant
  architecture)
- `SEED-ARCH-05` — do not reflexively dismiss the modular-monolith candidate;
  acknowledge genuine strengths before spec-grounded rejection
- `SEED-ARCH-21` — do not recommend a language change for I/O-bound Python at
  the stated load (GIL trap)
- `SEED-ARCH-23` — do not penalize Temporal for Kafka instability; it has
  independent Postgres-backed persistence
- `SEED-ARCH-26` — do not hard-block bounded event sourcing on team-skill
  grounds alone (over-blocking trap)

Regression controls:

- `SEED-ARCH-28` — dual-write without automated reconciliation (under-blocking
  trap)
- `SEED-ARCH-29` — ambiguous ledger write authority during migration phases
  (split-brain trap)

Regression provenance: these two under-blocking traps had their scoring
criteria tightened after the canary run + multi-model audit recorded in the
per-eval ledger v2 header. No per-seed run record was retained for that run,
so this anchoring is documentary rather than run-results-backed. Re-anchor
regression selection from `run-results.tsv` after the first retained
benchmark_full run.

Why these packs exist:

- Fatal invariant controls verify the agent catches mandatory axis
  activations and enforces blocking rules — the two most critical judgment
  behaviors.
- Negative controls measure false-positive behavior: over-activating optional
  axes, over-blocking viable candidates, and propagating risks along
  unverified dependency edges. NCs are ≥15% of standard seeds per the
  benchmark calibration rule.
- Regression controls track previously observed weak spots so future runs
  catch backsliding.
