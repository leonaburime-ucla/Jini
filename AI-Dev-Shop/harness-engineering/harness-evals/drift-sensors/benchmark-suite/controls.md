# Controls — Drift Sensor Suite

Suite kind: `benchmark`

Positive controls:

- `SEED-DS-01` — critical vulnerability must trigger immediate blocker escalation to Security
- `SEED-DS-03` — dead-code threshold breach must escalate and route to Refactor
- `SEED-DS-05` — large coverage drop (>5%) must escalate with critical-path flag

Negative controls:

- `SEED-DS-02` — routine outdated deps must NOT escalate; advisory only, batch into maintenance
- `SEED-DS-04` — small coverage drop (<5%) must NOT escalate; advisory note only
- `SEED-DS-06` — new dead code in PR (within threshold) must NOT escalate; advisory warn only

Why these packs exist:

- Positive controls verify the Observer correctly identifies severity-appropriate findings and routes them to the right consumer agent.
- Negative controls verify the Observer does not over-react to low-severity signals by escalating or blocking when advisory is the correct response.
