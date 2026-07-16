# Harness Tech Debt Tracker

Tracks harness-engineering gaps that should be addressed incrementally rather than via a one-time rewrite.

| ID | Area | Debt | Impact | Next Step | Status |
|---|---|---|---|---|---|
| H-001 | CI | Validators were local-only and not wired into CI or release gates | Drift can re-enter silently | Keep `.github/framework/workflows/harness-validators.yml` aligned with `harness-engineering/validators/run-all.sh` | Closed |
| H-002 | Registry Integrity | `skills-registry.md` coverage is not yet enforced as a hard gate for every skill | Agents can miss or reference stale skills | Decide whether missing registry entries should warn or fail | Open |
| H-003 | Observer Cadence | Observer guidance existed, but recurring doc-garden and benchmark scans were not operationalized | Learning loop stays optional | Keep `harness-engineering/maintenance/observer-cadence.md` and Observer/Coordinator docs aligned | Closed |
| H-004 | Self-Validation | No app/runtime harness template exists for downstream repos | Programmer hands off work before full environment validation | Add project-level self-validation harness templates by stack | Open |
| H-005 | Benchmarks | Benchmark structure exists, but only pre-implementation roles have seeded fixtures so far | Instruction changes can regress without early warning | Add implementation-stage fixtures once codebase-specific artifacts exist | In Progress |
| H-006 | AGENTS Size | Root runtime instructions were heavier than ideal | Global context remained noisier than necessary | Keep `AGENTS.md` under the map-first threshold by routing new detail into `framework/operations/pipeline-quickstart.md` and `framework/routing/agent-index.md` | Closed |
| H-007 | Garbage Collection | No scheduled cleanup workflow opens small repair PRs | Slop can accumulate between maintainer passes | Run the defined doc-garden cadence now; evaluate auto-generated repair PRs later | In Progress |
| H-008 | Session Continuity | No durable cross-session progress artifact existed for long-running framework work | Fresh sessions could lose local state and priority ordering | Use `harness-engineering/runtime/session-continuity.md`, `framework/templates/progress-ledger-template.md`, and workflow ledger fields as the standard resume surface | Closed |
| H-009 | Middleware Tripwires | No pre-completion checklist or loop-detection tripwire existed | Agents could declare done too early or thrash on the same file repeatedly | Enforce `harness-engineering/runtime/tripwires.md` through Coordinator, Programmer, and workflow handoff gates | Closed |
| H-010 | Context Offloading | Large tool outputs and long-run summaries are not standardized into durable files | Context rot grows during long sessions and multi-stage work | Define file-backed offloading and restart rules for long-running tasks | Open |
| H-011 | Evaluator Contracts | Independent evaluator loops and build contracts were documented, but lacked retained templates and validator-backed presence checks | Long autonomous builds could regress into informal self-review and vague acceptance gates | Added retained evaluator templates plus `validate_evaluator_artifacts.py`; keep the progress-ledger trigger and template fields aligned as the contract evolves | Closed |
