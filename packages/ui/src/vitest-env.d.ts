// Ambient type augmentation for @testing-library/jest-dom's vitest matchers
// (toBeInTheDocument, toHaveTextContent, etc.). vitest.setup.ts imports the
// module for its runtime side effect, but that file sits outside `src/` and
// so is invisible to `tsc -p tsconfig.json` (which only includes `src`) —
// this file re-declares the same reference from inside `src/` so typecheck
// sees the same ambient `Assertion` augmentation vitest itself picks up.
/// <reference types="@testing-library/jest-dom/vitest" />
