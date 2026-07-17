// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
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

// Runs the rAF callback synchronously so resize/scroll-driven
// `scheduleUpdatePosition` calls are deterministic in tests.
function stubSyncRaf() {
  const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
    cb(0);
    return 1;
  });
  const caf = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  return () => {
    raf.mockRestore();
    caf.mockRestore();
  };
}

function Trigger(props: { placement?: 'top' | 'bottom' | 'left' | 'right'; title?: string; ariaExpanded?: boolean } = {}) {
  return (
    <button
      className="jini-tooltip"
      data-tooltip="Hello there"
      data-tooltip-placement={props.placement}
      data-testid="trigger"
      title={props.title}
      aria-expanded={props.ariaExpanded}
    >
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

  it('ignores a trigger with aria-expanded="true" (already has its own popover)', () => {
    render(
      <>
        <Trigger ariaExpanded />
        <TooltipLayer />
      </>,
    );
    fireEvent.pointerOver(screen.getByTestId('trigger'));
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('ignores a trigger whose data-tooltip is only whitespace', () => {
    render(
      <>
        <button className="jini-tooltip" data-tooltip="   " data-testid="trigger">
          Hover me
        </button>
        <TooltipLayer />
      </>,
    );
    fireEvent.pointerOver(screen.getByTestId('trigger'));
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('positions bottom/left/right placements without throwing', () => {
    const restore = stubSyncRaf();
    for (const placement of ['bottom', 'left', 'right'] as const) {
      const { unmount } = render(
        <>
          <Trigger placement={placement} />
          <TooltipLayer />
        </>,
      );
      fireEvent.pointerOver(screen.getByTestId('trigger'));
      expect(screen.getByRole('tooltip').textContent).toBe('Hello there');
      unmount();
    }
    restore();
  });

  it('suppresses and restores a native title attribute across show/hide', () => {
    render(
      <>
        <Trigger title="Native title" />
        <TooltipLayer />
      </>,
    );
    const trigger = screen.getByTestId('trigger');
    expect(trigger.getAttribute('title')).toBe('Native title');

    fireEvent.pointerOver(trigger);
    expect(trigger.getAttribute('title')).toBeNull();
    expect(trigger.getAttribute('data-jini-tooltip-native-title')).toBe('Native title');

    fireEvent.pointerOut(trigger);
    expect(trigger.getAttribute('title')).toBe('Native title');
    expect(trigger.getAttribute('data-jini-tooltip-native-title')).toBeNull();
  });

  it('does not restore a title a second time when re-hovering the same target', () => {
    render(
      <>
        <Trigger title="Native title" />
        <TooltipLayer />
      </>,
    );
    const trigger = screen.getByTestId('trigger');
    fireEvent.pointerOver(trigger);
    fireEvent.pointerOver(trigger);
    expect(trigger.getAttribute('title')).toBeNull();
    fireEvent.pointerOut(trigger);
    expect(trigger.getAttribute('title')).toBe('Native title');
  });

  it('hides without restoring the title on click activation', () => {
    render(
      <>
        <Trigger title="Native title" />
        <TooltipLayer />
      </>,
    );
    const trigger = screen.getByTestId('trigger');
    fireEvent.pointerOver(trigger);
    fireEvent.click(trigger);
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(trigger.getAttribute('data-jini-tooltip-native-title')).toBe('Native title');
  });

  it('restores the native title on unmount, while the trigger stays mounted', () => {
    // TooltipLayer is unmounted alone (a separate render root from the
    // trigger) so the trigger's DOM node stays attached to `document` and
    // the unmount-cleanup's `document.contains(target)` check is real.
    const { unmount } = render(<TooltipLayer />);
    render(<Trigger title="Native title" />);
    const trigger = screen.getByTestId('trigger');

    fireEvent.pointerOver(trigger);
    fireEvent.click(trigger);
    expect(trigger.getAttribute('data-jini-tooltip-native-title')).toBe('Native title');

    unmount();
    expect(trigger.getAttribute('title')).toBe('Native title');
  });

  it('hides on pointerdown activation', () => {
    render(
      <>
        <Trigger />
        <TooltipLayer />
      </>,
    );
    const trigger = screen.getByTestId('trigger');
    fireEvent.pointerOver(trigger);
    fireEvent.pointerDown(trigger);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('a click outside any tooltip target is a no-op', () => {
    render(
      <>
        <Trigger />
        <TooltipLayer />
      </>,
    );
    fireEvent.pointerOver(screen.getByTestId('trigger'));
    expect(screen.getByRole('tooltip')).toBeTruthy();
    fireEvent.click(document.body);
    // Clicking outside the trigger still calls hideTooltipForActivation(null),
    // which just hides — same as any other dismissal.
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('a pointerout on a non-trigger element is a no-op', () => {
    render(
      <>
        <Trigger />
        <TooltipLayer />
      </>,
    );
    fireEvent.pointerOver(screen.getByTestId('trigger'));
    expect(screen.getByRole('tooltip')).toBeTruthy();
    fireEvent.pointerOut(document.body);
    expect(screen.getByRole('tooltip')).toBeTruthy();
  });

  it('hides on pointercancel', () => {
    render(
      <>
        <Trigger />
        <TooltipLayer />
      </>,
    );
    const trigger = screen.getByTestId('trigger');
    fireEvent.pointerOver(trigger);
    fireEvent(document, new Event('pointercancel'));
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('shows on focus after keyboard input, and activates on Enter/Space', () => {
    render(
      <>
        <Trigger />
        <TooltipLayer />
      </>,
    );
    const trigger = screen.getByTestId('trigger');
    fireEvent.keyDown(document, { key: 'Tab' });
    fireEvent.focusIn(trigger);
    expect(screen.getByRole('tooltip').textContent).toBe('Hello there');

    fireEvent.keyDown(document, { key: 'Enter' });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('activates on Spacebar (legacy key name) too', () => {
    render(
      <>
        <Trigger title="native" />
        <TooltipLayer />
      </>,
    );
    const trigger = screen.getByTestId('trigger');
    fireEvent.pointerOver(trigger);
    fireEvent.keyDown(document, { key: 'Spacebar' });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('a plain keydown with no special key is a no-op', () => {
    render(
      <>
        <Trigger />
        <TooltipLayer />
      </>,
    );
    fireEvent.pointerOver(screen.getByTestId('trigger'));
    fireEvent.keyDown(document, { key: 'a' });
    expect(screen.getByRole('tooltip')).toBeTruthy();
  });

  it('focus via pointer without :focus-visible only suppresses the native title, no tooltip', () => {
    render(
      <>
        <Trigger title="native" />
        <TooltipLayer />
      </>,
    );
    const trigger = screen.getByTestId('trigger');
    fireEvent.pointerOver(trigger); // sets lastInputRef to 'pointer', shows tooltip
    fireEvent.pointerOut(trigger); // hides + restores title
    fireEvent.focusIn(trigger);
    // jsdom's `:focus-visible` support reports false for a programmatic
    // focus that didn't originate from a real keyboard interaction.
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(trigger.getAttribute('data-jini-tooltip-native-title')).toBe('native');
  });

  it('falls back to false when Element.matches(":focus-visible") throws', () => {
    const matchesSpy = vi.spyOn(HTMLElement.prototype, 'matches').mockImplementation(() => {
      throw new Error('unsupported pseudo-class');
    });
    render(
      <>
        <Trigger />
        <TooltipLayer />
      </>,
    );
    fireEvent.focusIn(screen.getByTestId('trigger'));
    expect(screen.queryByRole('tooltip')).toBeNull();
    matchesSpy.mockRestore();
  });

  it('a focusin/focusout on a non-trigger element is a no-op', () => {
    render(
      <>
        <button data-testid="plain">Plain</button>
        <TooltipLayer />
      </>,
    );
    const plain = screen.getByTestId('plain');
    fireEvent.focusIn(plain);
    fireEvent.focusOut(plain);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('does not hide on focusout when focus moves to a child of the same target', () => {
    render(
      <div>
        <button className="jini-tooltip" data-tooltip="Hello there" data-testid="trigger">
          <span data-testid="child">Hover me</span>
        </button>
        <TooltipLayer />
      </div>,
    );
    const trigger = screen.getByTestId('trigger');
    const child = screen.getByTestId('child');
    fireEvent.keyDown(document, { key: 'Tab' });
    fireEvent.focusIn(trigger);
    expect(screen.getByRole('tooltip')).toBeTruthy();
    fireEvent.focusOut(trigger, { relatedTarget: child });
    expect(screen.getByRole('tooltip')).toBeTruthy();
  });

  it('hides on focusout when focus moves elsewhere entirely', () => {
    render(
      <>
        <Trigger />
        <TooltipLayer />
      </>,
    );
    const trigger = screen.getByTestId('trigger');
    fireEvent.keyDown(document, { key: 'Tab' });
    fireEvent.focusIn(trigger);
    expect(screen.getByRole('tooltip')).toBeTruthy();
    fireEvent.focusOut(trigger, { relatedTarget: null });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('does not hide on pointerout when the pointer moves to a child of the same target', () => {
    render(
      <div>
        <button className="jini-tooltip" data-tooltip="Hello there" data-testid="trigger">
          <span data-testid="child">Hover me</span>
        </button>
        <TooltipLayer />
      </div>,
    );
    const trigger = screen.getByTestId('trigger');
    const child = screen.getByTestId('child');
    fireEvent.pointerOver(trigger);
    expect(screen.getByRole('tooltip')).toBeTruthy();
    fireEvent.pointerOut(trigger, { relatedTarget: child });
    expect(screen.getByRole('tooltip')).toBeTruthy();
  });

  it('hides via MutationObserver when the target stops being a tooltip target', async () => {
    render(
      <>
        <Trigger />
        <TooltipLayer />
      </>,
    );
    const trigger = screen.getByTestId('trigger');
    fireEvent.pointerOver(trigger);
    expect(screen.getByRole('tooltip')).toBeTruthy();

    trigger.classList.remove('jini-tooltip');
    await vi.waitFor(() => {
      expect(screen.queryByRole('tooltip')).toBeNull();
    });
  });

  it('clears the tooltip on scroll/resize when the target has left the DOM', async () => {
    // TooltipLayer stays at a stable child position (index 0) across the
    // rerender below — putting Trigger first would make React's positional
    // reconciliation treat the rerendered TooltipLayer as a brand new
    // component instance (different type at the same slot), silently
    // resetting its state instead of preserving it while Trigger unmounts.
    const { rerender } = render(
      <>
        <TooltipLayer />
        <Trigger />
      </>,
    );
    const trigger = screen.getByTestId('trigger');
    fireEvent.pointerOver(trigger);
    expect(screen.getByRole('tooltip')).toBeTruthy();

    // Unmount just the trigger (via React, so the DOM stays consistent for
    // testing-library's own teardown) while TooltipLayer stays mounted.
    rerender(<TooltipLayer />);
    fireEvent.scroll(window);
    // Real (unstubbed) rAF: waitFor polls until the scheduled frame has run.
    await vi.waitFor(() => {
      expect(screen.queryByRole('tooltip')).toBeNull();
    });

    // A second, later update-position pass — by now the first frame has
    // fully completed (rafRef reset) and state is already null, so this
    // exercises `updatePosition`'s own `!current` guard, reached only once
    // state has gone null from a *prior* completed frame rather than via
    // `hideTooltip` (which would have cancelled this one before it fired).
    // The tooltip is already absent, so `vi.waitFor` would short-circuit
    // instantly without actually letting the newly-scheduled frame run —
    // wait for a real frame explicitly instead.
    fireEvent.scroll(window);
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
    });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('keeps showing the last known text when data-tooltip is removed entirely before a reposition', () => {
    const restore = stubSyncRaf();
    render(
      <>
        <Trigger />
        <TooltipLayer />
      </>,
    );
    const trigger = screen.getByTestId('trigger');
    fireEvent.pointerOver(trigger);
    expect(screen.getByRole('tooltip').textContent).toBe('Hello there');

    delete trigger.dataset.tooltip;
    fireEvent(window, new Event('resize'));
    expect(screen.getByRole('tooltip').textContent).toBe('Hello there');
    restore();
  });

  it('clears the tooltip on resize when the target became aria-expanded', () => {
    const restore = stubSyncRaf();
    render(
      <>
        <Trigger />
        <TooltipLayer />
      </>,
    );
    const trigger = screen.getByTestId('trigger');
    fireEvent.pointerOver(trigger);
    expect(screen.getByRole('tooltip')).toBeTruthy();

    trigger.setAttribute('aria-expanded', 'true');
    fireEvent(window, new Event('resize'));
    expect(screen.queryByRole('tooltip')).toBeNull();
    restore();
  });

  it('repositions without changing text when only the DOM shifts (identity/no-op update path)', () => {
    const restore = stubSyncRaf();
    render(
      <>
        <Trigger />
        <TooltipLayer />
      </>,
    );
    const trigger = screen.getByTestId('trigger');
    fireEvent.pointerOver(trigger);
    expect(screen.getByRole('tooltip').textContent).toBe('Hello there');
    fireEvent(window, new Event('resize'));
    fireEvent(window, new Event('resize'));
    expect(screen.getByRole('tooltip').textContent).toBe('Hello there');
    restore();
  });

  it('updates the tooltip text live when data-tooltip changes on the current target', () => {
    const restore = stubSyncRaf();
    render(
      <>
        <Trigger />
        <TooltipLayer />
      </>,
    );
    const trigger = screen.getByTestId('trigger');
    fireEvent.pointerOver(trigger);
    expect(screen.getByRole('tooltip').textContent).toBe('Hello there');

    trigger.dataset.tooltip = 'Updated text';
    fireEvent(window, new Event('resize'));
    expect(screen.getByRole('tooltip').textContent).toBe('Updated text');
    restore();
  });

  it('re-showing the same target with unchanged text/placement is a no-op update', () => {
    render(
      <>
        <Trigger />
        <TooltipLayer />
      </>,
    );
    const trigger = screen.getByTestId('trigger');
    fireEvent.pointerOver(trigger);
    fireEvent.pointerOver(trigger);
    expect(screen.getByRole('tooltip').textContent).toBe('Hello there');
  });

  it('re-showing the same target with new text/placement merges into the existing state', () => {
    render(
      <>
        <Trigger />
        <TooltipLayer />
      </>,
    );
    const trigger = screen.getByTestId('trigger');
    fireEvent.pointerOver(trigger);
    expect(screen.getByRole('tooltip').textContent).toBe('Hello there');

    // Same target, but its tooltip text/placement changed since the last
    // pointerover — a second pointerover on the still-hovered target should
    // merge the new text/placement into the existing tooltip state.
    trigger.dataset.tooltip = 'Changed text';
    trigger.dataset.tooltipPlacement = 'bottom';
    fireEvent.pointerOver(trigger);
    expect(screen.getByRole('tooltip').textContent).toBe('Changed text');
  });

  it('cancels a pending position-update animation frame when hidden before it fires', () => {
    render(
      <>
        <Trigger />
        <TooltipLayer />
      </>,
    );
    const trigger = screen.getByTestId('trigger');
    fireEvent.pointerOver(trigger);
    expect(screen.getByRole('tooltip')).toBeTruthy();

    const cafSpy = vi.spyOn(window, 'cancelAnimationFrame');
    // Real (unstubbed) rAF: this schedules a pending frame that hasn't run
    // yet by the time we hide, so hideTooltip must cancel it.
    fireEvent(window, new Event('resize'));
    fireEvent.pointerOut(trigger);

    expect(cafSpy).toHaveBeenCalled();
    expect(screen.queryByRole('tooltip')).toBeNull();
    cafSpy.mockRestore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
});
