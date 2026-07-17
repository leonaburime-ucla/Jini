import { render } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSketchDomEnhancements } from './useSketchDomEnhancements.js';

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
});
