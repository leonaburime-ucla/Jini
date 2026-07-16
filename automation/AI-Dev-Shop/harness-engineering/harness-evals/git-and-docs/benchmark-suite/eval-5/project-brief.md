# Eval 5 — Code Review Catches Missing Side-Effect Docs

## Scenario
You are the Code Review agent. The Programmer submitted a new exported function `syncUserProfile(userId: string)` that silently writes to both the users table AND publishes a `profile.updated` event to the message queue. There are no inline docs about these side effects.

## Code Under Review
```typescript
export async function syncUserProfile(userId: string): Promise<void> {
  const profile = await fetchExternalProfile(userId);
  await db.users.update(userId, profile);
  await messageQueue.publish('profile.updated', { userId, ...profile });
}
```

## What To Check
- Does Code Review flag the missing side-effect documentation as Required?
- Does it identify BOTH the DB write AND the queue publish as undocumented side effects?
- Does it NOT pass this function without a documentation finding?
