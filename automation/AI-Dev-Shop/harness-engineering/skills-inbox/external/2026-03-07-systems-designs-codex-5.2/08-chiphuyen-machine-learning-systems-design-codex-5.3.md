# Distilled Learnings: chiphuyen / machine-learning-systems-design (codex-5.2, deep pass)

Source repo: https://github.com/chiphuyen/machine-learning-systems-design

## 1) What This Source Adds
- A practical production-ML design framework with four iterative stages:
  - project setup
  - data pipeline
  - modeling
  - serving
- Strong emphasis on production constraints over leaderboard optimization.
- A wide open-ended exercise set covering recommendation, fraud, ranking, retrieval, NLP, vision, and marketplace systems.

## 2) Core Distilled Learnings

### 2.1 ML system design is mostly systems design
- The source explicitly stresses that data, evaluation, serving, and feedback loops dominate project success.
- Model choice is only one stage and often not the hardest stage.

Skill gate:
- Require full lifecycle coverage, not just model architecture discussion.

### 2.2 Problem framing and metrics are first-order decisions
- Must define goals, user experience, precision/recall tradeoffs, and inferencing evaluation.
- Business metrics and model metrics are different and both must be tracked.

Skill gate:
- No design accepted without objective function + online evaluation strategy.

### 2.3 Production differs from research in priorities
- State-of-the-art model complexity often loses to simpler, reliable models in production.
- Serving latency, compute budget, and maintainability are explicit constraints.

Skill gate:
- Require baseline heuristic and simple-model baseline before complex model escalation.

## 3) Concrete Example Blueprint (Production-Ready)
- Use case: fraud scoring.
  - project setup: objective, false-negative cost, latency budget.
  - data pipeline: source quality, label reliability, bias checks, privacy controls.
  - modeling: baseline logistic/tree model, then escalate only if value justifies cost.
  - serving: staged rollout, monitoring for drift and business KPI changes, rollback trigger.

## 4) Distilled Process Rules from Source Content
- Ask explicit data availability and annotation-quality questions before modeling.
- Design for debuggability:
  - start simple
  - overfit small batch
  - set random seeds
- Include privacy and bias risk checks as core workflow, not appendix items.
- Build feedback loops from inference behavior back into training/data pipeline.

## 5) Anti-Patterns and Fixes
- Anti-pattern: “We’ll pick a big model first.”
  - Fix: require random/human/heuristic baselines and escalation criteria.
- Anti-pattern: focusing only on offline score.
  - Fix: require online metrics and user-impact measurement.
- Anti-pattern: training-serving skew ignored.
  - Fix: require feature/data contract and skew detection checks.
- Anti-pattern: no rollback/retraining policy.
  - Fix: require deployment safety gates and retraining triggers.

## 6) Decision Matrix (Skill-Ready)

| Lifecycle Stage | Required Artifact | Failure if Missing |
|---|---|---|
| Project setup | goals, constraints, cost of errors | wrong optimization target |
| Data pipeline | data contract + labeling + privacy/bias plan | brittle or harmful model behavior |
| Modeling | baseline + debugging plan + model choice rationale | over-complex and hard to fix |
| Serving | rollout, monitoring, rollback, retrain triggers | unsafe production operation |

## 7) Drop-In Skill Contract Additions
```md
## ML System Design Contract
- Goal function and user-impact metric
- Data/feature contract and quality checks
- Baseline models and escalation rule
- Serving constraints (latency/cost)
- Drift monitoring and retraining policy
- Rollback and human-override path
```

## 8) Note on Repository Answer Files
- The `answers/` directory is mostly scaffold prompts at this stage.
- The highest-value material for distillation is in:
  - `content/design-a-machine-learning-system.md`
  - `content/research-vs-production.md`
  - `content/case-studies.md`
  - `content/exercises.md`

## References
- Source article: https://www.kdnuggets.com/10-github-repositories-to-master-system-design
- Source repository: https://github.com/chiphuyen/machine-learning-systems-design
- Primary source file: https://raw.githubusercontent.com/chiphuyen/machine-learning-systems-design/master/README.md
- Content source: https://github.com/chiphuyen/machine-learning-systems-design/blob/master/content/design-a-machine-learning-system.md
- Content source: https://github.com/chiphuyen/machine-learning-systems-design/blob/master/content/research-vs-production.md
- Content source: https://github.com/chiphuyen/machine-learning-systems-design/blob/master/content/case-studies.md
- Content source: https://github.com/chiphuyen/machine-learning-systems-design/blob/master/content/exercises.md
