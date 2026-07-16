# Project Brief - Sampling Evidence Fixture

You are analyzing an existing TypeScript service before a pipeline run. The user asks for analysis only on `src/billing` and `src/shared`, with generated clients and unrelated domains explicitly out of scope.

The fake repository includes a small hand-written app surface plus a large generated tree. The agent under test must estimate size, sample safely, document exclusions, and avoid running project scripts.
