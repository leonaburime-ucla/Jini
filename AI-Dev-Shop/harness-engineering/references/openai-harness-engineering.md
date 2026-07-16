# OpenAI Harness Engineering Notes

Source:
- https://openai.com/index/harness-engineering/

This is a local, repo-usable distillation of the article, not a copy.

## Key Takeaways

### 1. Engineers Design Environments

The role shifts from writing code directly to designing tools, repo structures, feedback loops, and enforcement systems that let coding agents work reliably.

### 2. The Repo Must Be The System Of Record

If product rules, architectural decisions, plans, or quality expectations live only in chat, docs outside the repo, or human memory, they are invisible to agents.

### 3. AGENTS Should Be A Map

Root instruction files should point to deeper sources of truth instead of trying to contain the whole operating manual. Smaller, navigable entrypoints age better and are easier to verify mechanically.

### 4. Legibility Beats Cleverness

Agents perform better when the codebase and docs are organized so they can discover structure, boundaries, and expectations directly. Predictable structure compounds.

### 5. Invariants Should Be Enforced Mechanically

Architecture rules, naming rules, file-shape rules, and quality constraints should be encoded into linters, tests, and validators. Error messages should tell the agent how to repair the violation.

### 6. Throughput Changes What Matters

When agents can generate changes quickly, the expensive resource is human attention. Short-lived PRs, fast correction loops, and review automation become more important than heavyweight waiting.

### 7. Entropy Is Guaranteed

Agent systems copy existing patterns, including bad ones. Continuous cleanup, quality grading, and small refactoring passes are required to prevent drift.

## Direct Implications For AI Dev Shop

- Keep `AGENTS.md` short and index-like.
- Treat `project-knowledge-template/` and related docs as the canonical memory system.
- Turn markdown rules into validators before adding more prose.
- Add recurring cleanup loops rather than large occasional rewrites.
- Build project-level self-validation harnesses in downstream repos that use this toolkit.
