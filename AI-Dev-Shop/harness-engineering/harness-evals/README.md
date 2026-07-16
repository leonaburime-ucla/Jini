# Harness Evals

Evaluation suites that test the harness system itself — contract enforcement, pipeline behavior, and framework correctness — as opposed to agent skills.

## Layout

- `contract-enforcement/` — tests whether the contract system (computational controls, runtime validation, architecture fitness, enforcement) produces correct pipeline behavior

## Distinction from Agent Evals

`agent-evals/` tests whether agents (Architect, Programmer, Code Review, etc.) produce correct outputs given inputs.

`harness-evals/` tests whether the harness infrastructure (contracts, enforcement, validators, pipeline gates) correctly governs agent behavior — blocking when it should, advising when it should, and escalating when it should.
