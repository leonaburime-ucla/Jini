import { beforeEach, describe, expect, it } from 'vitest';
import {
  __resetComposerDraftCacheForTests,
  clearCachedDraft,
  MAX_CACHED_CONVERSATION_DRAFTS,
  readCachedDraft,
  writeCachedDraft,
} from '../composer-draft-cache.js';

describe('composer-draft-cache', () => {
  beforeEach(() => __resetComposerDraftCacheForTests());

  it('returns null for a conversation that was never written', () => {
    expect(readCachedDraft('never-touched')).toBeNull();
  });

  it('round-trips a written draft', () => {
    writeCachedDraft('convo-a', 'hello there');
    expect(readCachedDraft('convo-a')).toBe('hello there');
  });

  it('is a no-op read/write for a null or undefined conversation id', () => {
    writeCachedDraft(null, 'x');
    writeCachedDraft(undefined, 'y');
    expect(readCachedDraft(null)).toBeNull();
    expect(readCachedDraft(undefined)).toBeNull();
  });

  it('deletes the entry when the draft is written back as blank or whitespace-only', () => {
    writeCachedDraft('convo-a', 'hello there');
    writeCachedDraft('convo-a', '   ');
    expect(readCachedDraft('convo-a')).toBeNull();
  });

  it('evicts the oldest tracked conversation once the cap is exceeded', () => {
    for (let i = 0; i < MAX_CACHED_CONVERSATION_DRAFTS; i += 1) {
      writeCachedDraft(`convo-${i}`, `draft ${i}`);
    }
    expect(readCachedDraft('convo-0')).toBe('draft 0');

    writeCachedDraft('convo-overflow', 'one more than the cap');

    expect(readCachedDraft('convo-0')).toBeNull();
    expect(readCachedDraft('convo-overflow')).toBe('one more than the cap');
  });

  it('does not evict anything when overwriting an already-tracked conversation at the cap', () => {
    for (let i = 0; i < MAX_CACHED_CONVERSATION_DRAFTS; i += 1) {
      writeCachedDraft(`convo-${i}`, `draft ${i}`);
    }
    writeCachedDraft('convo-0', 'draft 0 edited');
    expect(readCachedDraft('convo-0')).toBe('draft 0 edited');
    expect(readCachedDraft('convo-1')).toBe('draft 1');
  });

  it('clearCachedDraft removes an entry explicitly', () => {
    writeCachedDraft('convo-a', 'hello there');
    clearCachedDraft('convo-a');
    expect(readCachedDraft('convo-a')).toBeNull();
  });

  it('clearCachedDraft is a no-op for a null or undefined conversation id', () => {
    expect(() => clearCachedDraft(null)).not.toThrow();
    expect(() => clearCachedDraft(undefined)).not.toThrow();
  });
});
