import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getDocumentBody,
  getViewportSize,
  openExternalUrl,
  scheduleInterval,
  scheduleTimeout,
  subscribeOutsideClickOrEscape,
  subscribeVisibleFocusOrVisibilityChange,
  subscribeWindowEvent,
} from './dom-subscriptions.js';

/** Minimal addEventListener/removeEventListener double that records the
 *  handler registered per event name, so a test can invoke it directly
 *  without a real DOM event-dispatch pipeline. */
function createListenerTarget() {
  const handlers = new Map<string, (event: unknown) => void>();
  return {
    addEventListener: vi.fn((name: string, handler: (event: unknown) => void) => {
      handlers.set(name, handler);
    }),
    removeEventListener: vi.fn((name: string) => {
      handlers.delete(name);
    }),
    fire(name: string, event: unknown = {}): void {
      handlers.get(name)?.(event);
    },
    has(name: string): boolean {
      return handlers.has(name);
    },
  };
}

describe('SSR safety (no window/document)', () => {
  it('every subscription/action is a no-op when window/document are undefined', () => {
    expect(getViewportSize()).toEqual({ width: 0, height: 0 });
    expect(getDocumentBody()).toBeNull();
    expect(() => openExternalUrl('https://example.com')).not.toThrow();
    expect(() => subscribeWindowEvent('resize', () => {})()).not.toThrow();
    expect(() => scheduleInterval(() => {}, 10)()).not.toThrow();
    expect(() => scheduleTimeout(() => {}, 10)()).not.toThrow();
    expect(() => subscribeOutsideClickOrEscape({ current: null }, () => {})()).not.toThrow();
    expect(() => subscribeVisibleFocusOrVisibilityChange(() => {})()).not.toThrow();
  });
});

describe('with window/document stubbed', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('getViewportSize reads window.innerWidth/innerHeight', () => {
    vi.stubGlobal('window', { innerWidth: 1280, innerHeight: 720 });
    expect(getViewportSize()).toEqual({ width: 1280, height: 720 });
  });

  it('getDocumentBody returns document.body', () => {
    const body = {};
    vi.stubGlobal('document', { body });
    expect(getDocumentBody()).toBe(body);
  });

  it('openExternalUrl opens the url in a new noopener/noreferrer tab', () => {
    const open = vi.fn();
    vi.stubGlobal('window', { open });
    openExternalUrl('https://example.com');
    expect(open).toHaveBeenCalledWith('https://example.com', '_blank', 'noopener,noreferrer');
  });

  it('subscribeWindowEvent adds then removes the listener on cleanup', () => {
    const target = createListenerTarget();
    vi.stubGlobal('window', target);
    const onEvent = vi.fn();
    const unsubscribe = subscribeWindowEvent('resize', onEvent);
    expect(target.has('resize')).toBe(true);
    target.fire('resize', { type: 'resize' });
    expect(onEvent).toHaveBeenCalledTimes(1);
    unsubscribe();
    expect(target.removeEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
  });

  it('scheduleInterval/scheduleTimeout delegate to window timers and cleanup clears them', () => {
    const setInterval = vi.fn(() => 7);
    const clearInterval = vi.fn();
    const setTimeout = vi.fn(() => 9);
    const clearTimeout = vi.fn();
    vi.stubGlobal('window', { setInterval, clearInterval, setTimeout, clearTimeout });

    const stopInterval = scheduleInterval(() => {}, 100);
    expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 100);
    stopInterval();
    expect(clearInterval).toHaveBeenCalledWith(7);

    const stopTimeout = scheduleTimeout(() => {}, 50);
    expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 50);
    stopTimeout();
    expect(clearTimeout).toHaveBeenCalledWith(9);
  });

  describe('subscribeOutsideClickOrEscape', () => {
    it('calls onClose for a mousedown target outside the container', () => {
      const doc = createListenerTarget();
      vi.stubGlobal('document', doc);
      const container = { current: { contains: vi.fn(() => false) } as unknown as HTMLElement };
      const onClose = vi.fn();
      subscribeOutsideClickOrEscape(container, onClose);

      doc.fire('mousedown', { target: 'outside-node' });
      expect(container.current.contains).toHaveBeenCalledWith('outside-node');
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose for a mousedown target inside the container', () => {
      const doc = createListenerTarget();
      vi.stubGlobal('document', doc);
      const container = { current: { contains: vi.fn(() => true) } as unknown as HTMLElement };
      const onClose = vi.fn();
      subscribeOutsideClickOrEscape(container, onClose);

      doc.fire('mousedown', { target: 'inside-node' });
      expect(onClose).not.toHaveBeenCalled();
    });

    it('calls onClose on Escape regardless of target', () => {
      const doc = createListenerTarget();
      vi.stubGlobal('document', doc);
      const onClose = vi.fn();
      subscribeOutsideClickOrEscape({ current: null }, onClose);

      doc.fire('keydown', { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);

      doc.fire('keydown', { key: 'Enter' });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('cleanup removes both listeners', () => {
      const doc = createListenerTarget();
      vi.stubGlobal('document', doc);
      const unsubscribe = subscribeOutsideClickOrEscape({ current: null }, () => {});
      unsubscribe();
      expect(doc.removeEventListener).toHaveBeenCalledWith('mousedown', expect.any(Function));
      expect(doc.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    });
  });

  describe('subscribeVisibleFocusOrVisibilityChange', () => {
    it('fires onVisible on window focus', () => {
      const win = createListenerTarget();
      const doc = createListenerTarget();
      vi.stubGlobal('window', win);
      vi.stubGlobal('document', { ...doc, visibilityState: 'visible' });
      const onVisible = vi.fn();
      subscribeVisibleFocusOrVisibilityChange(onVisible);

      win.fire('focus');
      expect(onVisible).toHaveBeenCalledTimes(1);
    });

    it('skips visibilitychange while the tab is hidden', () => {
      const win = createListenerTarget();
      vi.stubGlobal('window', win);
      const docState = { visibilityState: 'hidden', ...createListenerTarget() };
      vi.stubGlobal('document', docState);
      const onVisible = vi.fn();
      subscribeVisibleFocusOrVisibilityChange(onVisible);

      docState.fire('visibilitychange');
      expect(onVisible).not.toHaveBeenCalled();

      docState.visibilityState = 'visible';
      docState.fire('visibilitychange');
      expect(onVisible).toHaveBeenCalledTimes(1);
    });
  });
});
