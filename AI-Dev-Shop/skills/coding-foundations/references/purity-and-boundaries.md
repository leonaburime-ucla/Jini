# Purity And Boundaries

## Default

Separate decision logic from effect execution.

- Decision logic should usually be deterministic, assertion-friendly, and free of hidden dependencies.
- Effectful code should usually be thin: fetch, persist, emit, log, or transact around a clearer decision step.

## Good Shapes

### Pure Decision + Thin Effect Wrapper

```ts
export const resolveAccountStatus = ({
  isSuspended,
  hasOutstandingBalance,
}: {
  isSuspended: boolean;
  hasOutstandingBalance: boolean;
}): 'suspended' | 'delinquent' | 'active' => {
  if (isSuspended) return 'suspended';
  if (hasOutstandingBalance) return 'delinquent';
  return 'active';
};
```

```ts
export const updateAccountStatus = async (
  { accountId, accountRepo }: { accountId: string; accountRepo: AccountRepo },
): Promise<void> => {
  const account = await accountRepo.getById({ accountId });
  const status = resolveAccountStatus({
    isSuspended: account.isSuspended,
    hasOutstandingBalance: account.balanceCents > 0,
  });
  await accountRepo.saveStatus({ accountId, status });
};
```

## Acceptable Impurity

Impurity is fine when it is the point of the function:

- HTTP handlers
- repositories and adapters
- transaction boundaries
- logging and metrics emission
- cache population and invalidation
- event publication and queue writes

The rule is not "everything pure." The rule is "keep effects obvious and contained."

## Mutation Guidance

- Prefer not mutating inputs.
- Prefer returning a new value when the function is mainly business logic or transformation.
- Accept controlled mutation when it is materially simpler or measurably cheaper on a hot path.
- If you mutate for performance, say so near the code.

## Useful Mental Model

Aim for a functional core and imperative shell where practical, but do not introduce wrapper theater.

Bad:

- a "pure" function that still reads global config or current time
- an effectful function split into three wrappers that hide the real side effects

Good:

- a pure helper for the rule
- a small orchestrator that performs the unavoidable effects
