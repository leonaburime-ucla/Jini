import { render, renderHook } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSketchDomEnhancements } from '../../../react/hooks/useSketchDomEnhancements.js';

const t = (key: string) => key;

function flushRaf(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function Harness({ onCloseActiveDialog }: { onCloseActiveDialog: () => void }) {
  const ref = createRef<HTMLDivElement>();
  useSketchDomEnhancements({ containerRef: ref, t, onCloseActiveDialog });
  return (
    <div ref={ref} data-testid="root">
      <button data-testid="main-menu-trigger" />
    </div>
  );
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('useSketchDomEnhancements', () => {
  it('applies tooltip decoration to the mounted DOM after the initial rAF tick', async () => {
    const { getByTestId } = render(<Harness onCloseActiveDialog={vi.fn()} />);
    await flushRaf();
    expect(getByTestId('main-menu-trigger').getAttribute('data-tooltip')).toBe('Main menu');
  });

  it('invokes onCloseActiveDialog on Escape only when a jini-sketch-modal Modal is present', async () => {
    const onCloseActiveDialog = vi.fn();
    render(<Harness onCloseActiveDialog={onCloseActiveDialog} />);
    await flushRaf();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(onCloseActiveDialog).not.toHaveBeenCalled();

    const portal = document.createElement('div');
    portal.className = 'jini-sketch-modal';
    portal.innerHTML = '<div class="Modal"></div>';
    document.body.appendChild(portal);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(onCloseActiveDialog).toHaveBeenCalledTimes(1);
  });

  it('cleans up its document-level keydown listeners on unmount', async () => {
    const onCloseActiveDialog = vi.fn();
    const { unmount } = render(<Harness onCloseActiveDialog={onCloseActiveDialog} />);
    await flushRaf();
    unmount();

    const portal = document.createElement('div');
    portal.className = 'jini-sketch-modal';
    portal.innerHTML = '<div class="Modal"></div>';
    document.body.appendChild(portal);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(onCloseActiveDialog).not.toHaveBeenCalled();
  });

  it('ignores a non-Escape keydown', async () => {
    const onCloseActiveDialog = vi.fn();
    render(<Harness onCloseActiveDialog={onCloseActiveDialog} />);
    await flushRaf();

    const portal = document.createElement('div');
    portal.className = 'jini-sketch-modal';
    portal.innerHTML = '<div class="Modal"></div>';
    document.body.appendChild(portal);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    expect(onCloseActiveDialog).not.toHaveBeenCalled();
  });

  it('wires Command/Ctrl+Enter through to the Mermaid-insert-button handler', async () => {
    const portal = document.createElement('div');
    portal.className = 'jini-sketch-modal';
    portal.innerHTML =
      '<div class="Modal__content">Mermaid<textarea></textarea><button aria-label="Insert diagram">Insert</button></div>';
    document.body.appendChild(portal);
    const button = portal.querySelector('button')!;
    const onClick = vi.fn();
    button.addEventListener('click', onClick);
    const textarea = portal.querySelector('textarea')!;

    render(<Harness onCloseActiveDialog={vi.fn()} />);
    await flushRaf();

    const event = new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true, cancelable: true });
    Object.defineProperty(event, 'target', { value: textarea, enumerable: true });
    document.dispatchEvent(event);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when the container ref has no current element (defensive)', () => {
    // Exercises the hook directly with a ref that never attaches to a
    // rendered element, rather than through `Harness`'s always-mounted div.
    expect(() =>
      renderHook(() => useSketchDomEnhancements({ containerRef: { current: null }, t, onCloseActiveDialog: vi.fn() })),
    ).not.toThrow();
  });
});
