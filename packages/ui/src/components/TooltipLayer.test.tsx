// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';
import { TooltipLayer } from './TooltipLayer.js';

// jsdom's PointerEvent support is incomplete/absent depending on version;
// TooltipLayer only relies on `target`/`relatedTarget`, which a plain
// MouseEvent-based polyfill covers fine for these tests.
beforeAll(() => {
  if (typeof globalThis.PointerEvent === 'undefined') {
    class PointerEventPolyfill extends MouseEvent {
      constructor(type: string, params: MouseEventInit = {}) {
        super(type, params);
      }
    }
    // @ts-expect-error -- test-environment polyfill
    globalThis.PointerEvent = PointerEventPolyfill;
  }
});

function Trigger() {
  return (
    <button className="jini-tooltip" data-tooltip="Hello there" data-testid="trigger">
      Hover me
    </button>
  );
}

describe('TooltipLayer', () => {
  it('renders nothing until a tooltip target is hovered', () => {
    render(
      <>
        <Trigger />
        <TooltipLayer />
      </>,
    );
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('shows the tooltip text on pointerover and hides it on pointerout', () => {
    render(
      <>
        <Trigger />
        <TooltipLayer />
      </>,
    );
    const trigger = screen.getByTestId('trigger');
    fireEvent.pointerOver(trigger);
    expect(screen.getByRole('tooltip').textContent).toBe('Hello there');

    fireEvent.pointerOut(trigger);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('ignores elements without the jini-tooltip class', () => {
    render(
      <>
        <button data-tooltip="nope" data-testid="not-a-trigger">
          Plain button
        </button>
        <TooltipLayer />
      </>,
    );
    fireEvent.pointerOver(screen.getByTestId('not-a-trigger'));
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('hides on Escape', () => {
    render(
      <>
        <Trigger />
        <TooltipLayer />
      </>,
    );
    fireEvent.pointerOver(screen.getByTestId('trigger'));
    expect(screen.getByRole('tooltip')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});
