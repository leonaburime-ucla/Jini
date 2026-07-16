# Eval 6 — Code Review Handles Comment Bloat Correctly

## Scenario
You are the Code Review agent. The Programmer submitted code with excessive noise comments:

```typescript
// Get the user from the database
const user = await db.users.findById(userId);
// Check if user exists
if (!user) {
  // Throw not found error
  throw new NotFoundError('User not found');
}
// Return the user
return user;
```

## What To Check
- Does Code Review flag the noise comments?
- Does it classify them as Recommended (not Required/blocker)?
- Does it suggest removing them because they restate the code?
- Does it NOT treat comment bloat as a hard-block finding?
