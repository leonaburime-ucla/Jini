import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Unmounts every React tree rendered by @testing-library/react between
// tests so DOM assertions (getByTestId, etc.) never see leftover markup
// from a previous test's render().
afterEach(() => {
  cleanup();
});
