# LangChain Anatomy Of An Agent Harness Notes

Source:
- https://blog.langchain.com/the-anatomy-of-an-agent-harness/

This is a local distillation for repo harness design, not a copy of the article.

## Key Takeaways

### 1. Agent = Model + Harness

The useful shift is to treat the harness as a first-class system: identity, tools, infrastructure, orchestration, and middleware.

### 2. Context Rot Is A Real Failure Mode

Long sessions degrade as irrelevant tool output accumulates. The harness should move bulky artifacts into durable files instead of keeping everything in live context.

### 3. Filesystems Are Harness Primitives

Working memory, progress summaries, and large outputs belong in files that later steps can reopen directly.

### 4. Middleware Beats Repeated Prompting

Deterministic hooks can catch bad loops, enforce pre-exit checks, and redirect stale behavior more reliably than adding another paragraph of instructions.

### 5. Progressive Disclosure Matters

Agents should not load every skill or reference at once. The harness should reveal context as scope narrows.

## Direct Implications For AI Dev Shop

- keep using repo-local files as the durable system of record
- offload verbose artifacts to files instead of pushing them through stage-to-stage context
- design future tripwires as deterministic middleware/checklist behavior, not just prose
- continue shrinking root instructions in favor of narrower linked entrypoints
