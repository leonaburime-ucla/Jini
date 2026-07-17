import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
// Registers jest-dom's DOM matchers (toBeInTheDocument, toHaveAttribute,
// etc.) on vitest's `expect` — added alongside `features/viewer-shell`
// (2026-07-17), the first task in this package to want those matchers;
// prior feature tests asserted against raw DOM/text-content instead. See
// `packages/ui/source-map.md`.
import '@testing-library/jest-dom/vitest';

// Unmounts every React tree rendered by @testing-library/react between
// tests so DOM assertions (getByTestId, etc.) never see leftover markup
// from a previous test's render().
afterEach(() => {
  cleanup();
});
