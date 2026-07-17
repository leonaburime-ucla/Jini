import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
// `@jini/ui`'s existing tests (features/connectors, the flat-group
// components) predate this and assert against plain DOM/element properties
// instead. Added for the settings-dialog feature's tests, which lean on
// jest-dom's richer matchers (`toBeInTheDocument`, `toHaveAttribute`, etc.)
// for readability; this augments `expect` globally, so it's harmless for
// every other test file in the package too.
import '@testing-library/jest-dom/vitest';

// Unmounts every React tree rendered by @testing-library/react between
// tests so DOM assertions (getByTestId, etc.) never see leftover markup
// from a previous test's render().
afterEach(() => {
  cleanup();
});
