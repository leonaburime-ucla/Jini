# Vercel Becoming An AI Engineering Company Notes

Source:
- https://vercel.com/blog/becoming-an-ai-engineering-company

This is a local distillation for repo harness design, not a copy of the article.

## Key Takeaways

### 1. Feedback Cycles Are A Competitive Advantage

Teams can move faster than model vendors when they have tight local test-and-improve loops around their own data and domain.

### 2. Start With What Works, Then Optimize

A working but heavier setup is acceptable early. Cost and speed tuning come after the behavior is proven.

### 3. Evals Prevent Quiet Regressions

Shipping earlier only works if evaluation gates stay strict while the system evolves.

### 4. Domain Complexity And Local Data Matter

The strongest harnesses connect models to domain-specific context and validation rules that general models do not already know.

## Direct Implications For AI Dev Shop

- keep evals and benchmark baselines central when changing instructions
- prefer shipping a simple harness layer first, then optimize or automate once behavior is stable
- keep repo-local artifacts authoritative because that is the framework's domain context
