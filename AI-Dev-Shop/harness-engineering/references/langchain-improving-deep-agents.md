# LangChain Improving Deep Agents With Harness Engineering Notes

Source:
- https://blog.langchain.com/improving-deep-agents-with-harness-engineering/

This is a local distillation for repo harness design, not a copy of the article.

## Key Takeaways

### 1. Harness Changes Can Move Benchmarks Without Changing Models

The article's central point is that planning, verification, and failure recovery often improve more from harness changes than from model swaps.

### 2. Analyze Failure Traces, Then Target The Fix

Parallel trace review and pattern synthesis create a tighter feedback loop than broad prompt tweaking.

### 3. Add Pre-Completion Gates

Before an agent declares done, force a deterministic check against the original task or spec. This catches premature completion earlier than downstream review alone.

### 4. Detect Loops Deterministically

Track repeated edits or retries and inject a redirect before the agent burns the same cycle again.

### 5. Front-Load Local Context

Session-start local context mapping reduces wasted exploration and inconsistent environment assumptions.

### 6. Spend Reasoning Compute Unevenly

Planning and verification benefit from more reasoning than routine implementation. The harness should spend compute where mistakes are most expensive.

## Direct Implications For AI Dev Shop

- add pre-completion checklist hooks before handoff-heavy stages
- add loop-detection or retry tripwires below the current coarse convergence budget
- treat Observer trace analysis as a candidate per-run harness feature, not only a periodic review
- standardize local-context bootstrapping for longer or more autonomous runs
