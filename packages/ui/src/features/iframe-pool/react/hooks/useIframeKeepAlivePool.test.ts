import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useIframeKeepAlivePool } from './useIframeKeepAlivePool.js';

function makeHost() {
  return document.createElement('div');
}

describe('useIframeKeepAlivePool (fallback pool, no Provider mounted)', () => {
  it('attach() creates and appends an element, reusing it on a repeat attach', () => {
    const { result } = renderHook(() => useIframeKeepAlivePool());
    const host = makeHost();
    let created = 0;
    const create = () => {
      created++;
      return document.createElement('iframe');
    };
    const first = result.current.attach('a', host, create);
    expect(host.contains(first)).toBe(true);
    expect(created).toBe(1);

    const second = result.current.attach('a', host, create);
    expect(second).toBe(first);
    expect(created).toBe(1);
  });

  it('release() and evict() both remove the entry from the DOM', () => {
    const { result } = renderHook(() => useIframeKeepAlivePool());
    const host = makeHost();
    const el = result.current.attach('b', host, () => document.createElement('iframe'));
    result.current.release('b');
    expect(host.contains(el)).toBe(false);

    const el2 = result.current.attach('c', host, () => document.createElement('iframe'));
    result.current.evict('c');
    expect(host.contains(el2)).toBe(false);
  });

  it('evictMatching() removes every entry the predicate matches', () => {
    const { result } = renderHook(() => useIframeKeepAlivePool());
    const host = makeHost();
    const elA = result.current.attach('proj:a', host, () => document.createElement('iframe'));
    const elB = result.current.attach('proj:b', host, () => document.createElement('iframe'));
    result.current.evictMatching((entry) => entry.key.startsWith('proj:'));
    expect(host.contains(elA)).toBe(false);
    expect(host.contains(elB)).toBe(false);
  });

  it('evictMatching() with includeActive: false still removes matches (fallback pool never parks)', () => {
    const { result } = renderHook(() => useIframeKeepAlivePool());
    const host = makeHost();
    const el = result.current.attach('d', host, () => document.createElement('iframe'));
    result.current.evictMatching((entry) => entry.key === 'd', { includeActive: false });
    expect(host.contains(el)).toBe(false);
  });

  it('release()/evict() on a key that was never attached is a no-op', () => {
    const { result } = renderHook(() => useIframeKeepAlivePool());
    expect(() => result.current.release('never-attached')).not.toThrow();
    expect(() => result.current.evict('never-attached')).not.toThrow();
  });

  it('unmount cleans up any remaining fallback entries', () => {
    const { result, unmount } = renderHook(() => useIframeKeepAlivePool());
    const host = makeHost();
    const el = result.current.attach('e', host, () => document.createElement('iframe'));
    unmount();
    expect(host.contains(el)).toBe(false);
  });
});
