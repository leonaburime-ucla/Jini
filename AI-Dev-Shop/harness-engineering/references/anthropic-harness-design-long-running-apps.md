# Anthropic Harness Design For Long-Running Application Development Notes

Source:
- https://www.anthropic.com/engineering/harness-design-long-running-apps

Published:
- 2026-03-24

This is a local distillation for repo harness design, not a copy of the article.

## Key Takeaways

### 1. Separate Building From Judging

Anthropic found that agents are too lenient when grading their own work. A dedicated evaluator is easier to tune into a skeptical judge than trying to make the generator reliably critical of itself.

### 2. Make Subjective Quality Gradable

For design and product quality, "is this good?" is too vague. The harness improved when quality was broken into explicit criteria with weighted emphasis on the dimensions the base model usually underserves.

### 3. Negotiate A Contract Before Coding

For full-stack work, the generator and evaluator agreed on a sprint contract before implementation. That contract translated a high-level spec into a testable slice with explicit completion criteria.

### 4. Evaluate The Live Product Surface

The evaluator used the running app, not just static code review. Browser interaction, screenshots, API checks, and state inspection exposed bugs that a plausible-looking diff would have missed.

### 5. Context Resets Are Conditional, Not Eternal

The earlier harness needed resets because the model lost coherence and showed context anxiety. A later model handled longer continuous sessions well enough that automatic compaction became sufficient, which let Anthropic drop reset-heavy orchestration.

### 6. Audit Harness Complexity As Models Improve

Anthropic simplified the harness by removing one component at a time and checking whether quality actually dropped. The lesson is to keep the simplest harness that still adds lift, not to preserve old scaffolding by habit.

## Direct Implications For AI Dev Shop

- add a repo-local policy for independent evaluator loops instead of relying on builder self-review alone
- require a file-backed build contract before long-running autonomous implementation slices
- distinguish compaction from full context resets and re-test which is load-bearing on current models
- treat model and host upgrades as reasons to audit and prune harness complexity, not just add more layers
