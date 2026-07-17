// A dedicated file (not a describe block in markdown-scroll-sync.test.ts) so
// the `vi.mock('micromark', ...)` below — which must be hoisted above every
// import to apply — only affects this one suite.
//
// `extractMarkdownBlockLines`'s try/catch around the micromark tokenizer is
// real defensive error handling, not dead code: micromark is a third-party
// dependency, and swallowing a tokenizer failure into an empty-anchor-list
// fallback (rather than letting it crash the split-pane scroll sync) is a
// deliberate contract. No amount of well-formed markdown reproduces a real
// micromark throw (CommonMark tokenizers are designed to accept any string),
// so the only faithful way to exercise the catch branch is to simulate the
// dependency failing, via a module mock — this is standard practice for
// testing a third-party error path, not a contrived branch-forcing test.
import { describe, expect, it, vi } from 'vitest';

vi.mock('micromark', async (importOriginal) => {
  const actual = await importOriginal<typeof import('micromark')>();
  return {
    ...actual,
    parse: () => {
      throw new Error('simulated micromark parse failure');
    },
  };
});

describe('extractMarkdownBlockLines (tokenizer failure)', () => {
  it('falls back to an empty array when the underlying markdown tokenizer throws', async () => {
    const { extractMarkdownBlockLines } = await import('./markdown-scroll-sync.js');
    expect(extractMarkdownBlockLines('# heading')).toEqual([]);
  });
});
