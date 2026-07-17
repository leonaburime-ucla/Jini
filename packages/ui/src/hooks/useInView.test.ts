// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useInView } from './useInView.js';

class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  callback: IntersectionObserverCallback;
  options: IntersectionObserverInit | undefined;
  observed: Element[] = [];
  disconnected = false;

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = callback;
    this.options = options;
    FakeIntersectionObserver.instances.push(this);
  }

  observe(node: Element) {
    this.observed.push(node);
  }

  disconnect() {
    this.disconnected = true;
  }

  unobserve() {}

  trigger(isIntersecting: boolean) {
    this.callback(
      [{ isIntersecting } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
}

// The hook only observes once `ref.current` is populated, which normally
// happens via JSX (`<div ref={view.ref}>`). Assigning it directly in the
// render body stands in for that — since it's set before the commit
// finishes, the effect that runs after commit sees a populated ref, same as
// a real render would.
function renderWithNode() {
  const node = document.createElement('div');
  const hook = renderHook((options?: Parameters<typeof useInView>[0]) => {
    const view = useInView<HTMLDivElement>(options);
    if (!view.ref.current) view.ref.current = node;
    return view;
  });
  return { node, ...hook };
}

describe('useInView', () => {
  beforeEach(() => {
    FakeIntersectionObserver.instances = [];
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts out of view and observes the node', () => {
    const { result, node } = renderWithNode();
    expect(result.current.inView).toBe(false);
    const observer = FakeIntersectionObserver.instances.at(-1)!;
    expect(observer.observed).toContain(node);
  });

  it('flips to inView and disconnects once visible (once: true by default)', () => {
    const { result } = renderWithNode();
    const observer = FakeIntersectionObserver.instances.at(-1)!;
    act(() => observer.trigger(true));
    expect(result.current.inView).toBe(true);
    expect(observer.disconnected).toBe(true);
  });

  it('with once:false, going back out of view flips inView back to false', () => {
    const node = document.createElement('div');
    const { result } = renderHook(() => {
      const view = useInView<HTMLDivElement>({ once: false });
      if (!view.ref.current) view.ref.current = node;
      return view;
    });
    const observer = FakeIntersectionObserver.instances.at(-1)!;
    act(() => observer.trigger(true));
    expect(result.current.inView).toBe(true);
    expect(observer.disconnected).toBe(false);
    act(() => observer.trigger(false));
    expect(result.current.inView).toBe(false);
  });

  it('does not create an observer while the ref has no node yet', () => {
    renderHook(() => useInView<HTMLDivElement>());
    expect(FakeIntersectionObserver.instances).toHaveLength(0);
  });

  it('passes the given root ref\'s current element through to the observer', () => {
    const node = document.createElement('div');
    const rootNode = document.createElement('div');
    const rootRef = { current: rootNode as Element | null };
    renderHook(() => {
      const view = useInView<HTMLDivElement>({ root: rootRef });
      if (!view.ref.current) view.ref.current = node;
      return view;
    });
    const observer = FakeIntersectionObserver.instances.at(-1)!;
    expect(observer.options?.root).toBe(rootNode);
  });

  it('falls back to inView=true when IntersectionObserver is unavailable', () => {
    vi.unstubAllGlobals();
    const original = globalThis.IntersectionObserver;
    // @ts-expect-error -- simulate an environment without IntersectionObserver
    delete globalThis.IntersectionObserver;
    const node = document.createElement('div');
    const { result } = renderHook(() => {
      const view = useInView<HTMLDivElement>();
      if (!view.ref.current) view.ref.current = node;
      return view;
    });
    expect(result.current.inView).toBe(true);
    globalThis.IntersectionObserver = original;
  });
});
