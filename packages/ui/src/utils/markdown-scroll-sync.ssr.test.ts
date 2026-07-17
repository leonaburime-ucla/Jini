// @vitest-environment node
//
// `measureEditorBlockOffsets` is exported from the package's public barrel
// (`src/index.ts`), so an arbitrary host could call it directly outside a
// React effect — its `typeof document === 'undefined'` half of the guard is
// a genuine SSR-safety check, not something a hook wrapper already makes
// unreachable. It's untestable under jsdom (this package's default test
// environment, where `document` always exists), matching the precedent in
// `dom-subscriptions.test.ts`/`dom.ssr.test.ts`. See `packages/ui/source-map.md`.
import { describe, expect, it } from 'vitest';
import { measureEditorBlockOffsets } from './markdown-scroll-sync.js';

describe('measureEditorBlockOffsets (SSR)', () => {
  it('returns null when document is undefined, even with a non-empty blockLines list', () => {
    expect(typeof document).toBe('undefined');
    expect(measureEditorBlockOffsets({} as HTMLTextAreaElement, [1], 'hello')).toBeNull();
  });
});
