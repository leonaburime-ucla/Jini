import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@jini/ui';
import { createFakeAnnotationCanvasDependencies } from '../../dependencies.js';
import { AnnotationCanvas } from './AnnotationCanvas.js';

// jsdom lays out nothing for real — stub the geometry every layout-driven
// hook in this feature reads (offsetWidth/Height for the resize effect,
// getBoundingClientRect for pointer math and the dock-placement engine) to
// a fixed, non-zero size so drawing/undo/redo and dock positioning have
// something real to compute against.
beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 800 });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 600 });
  // The floating dock itself must report a size well below the host/wrap
  // (800x600) or `computeDockPlacement`'s "host too small for this dock"
  // gate always wins and every test would only ever see DOCKED_PLACEMENT.
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const isDock = this.classList?.contains('jini-annotation-dock');
    const width = isDock ? 220 : 800;
    const height = isDock ? 60 : 600;
    return {
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: width,
      bottom: height,
      width,
      height,
      toJSON() {
        return this;
      },
    } as DOMRect;
  });
  if (typeof (globalThis as { ResizeObserver?: unknown }).ResizeObserver === 'undefined') {
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

afterEach(() => {
  vi.restoreAllMocks();
});

// jsdom has no PointerEvent constructor at all, and @testing-library's
// fireEvent.pointer* falls back to a bare `Event` with clientX/clientY
// silently dropped — so pointer math never runs. Dispatch a real
// MouseEvent (which jsdom fully supports, clientX/clientY included) typed
// as the pointer event instead; only `pointerId` needs faking on top.
function firePointerEvent(el: Element, type: string, clientX: number, clientY: number) {
  const ev = new MouseEvent(type, { clientX, clientY, bubbles: true, cancelable: true });
  Object.defineProperty(ev, 'pointerId', { value: 1 });
  el.dispatchEvent(ev);
}

function drawABox() {
  const canvas = document.querySelector('canvas')!;
  firePointerEvent(canvas, 'pointerdown', 100, 100);
  firePointerEvent(canvas, 'pointermove', 300, 300);
  firePointerEvent(canvas, 'pointerup', 300, 300);
}

// Box-select undo is one-way in the original (a removed box is never
// pushed to a redo stack — only freehand strokes are redoable), so the
// undo/redo *round-trip* tests below switch to the pen tool first.
async function selectPenTool(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Box select' }));
  await user.click(screen.getByRole('menuitemradio', { name: 'Pen' }));
}

function drawAStroke() {
  const canvas = document.querySelector('canvas')!;
  firePointerEvent(canvas, 'pointerdown', 100, 100);
  firePointerEvent(canvas, 'pointermove', 150, 150);
  firePointerEvent(canvas, 'pointermove', 200, 200);
  firePointerEvent(canvas, 'pointerup', 200, 200);
}

function undoButton() {
  return screen.getByRole('button', { name: 'Undo' }) as HTMLButtonElement;
}
function redoButton() {
  return screen.getByRole('button', { name: 'Redo' }) as HTMLButtonElement;
}

describe('AnnotationCanvas', () => {
  it('renders children and, while inactive, no toolbar', () => {
    render(
      <AnnotationCanvas active={false}>
        <div data-testid="host-content">host content</div>
      </AnnotationCanvas>,
    );
    expect(screen.getByTestId('host-content')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  });

  it('renders the toolbar (mark tool, history, attach, note, submit, close) while active', () => {
    render(
      <AnnotationCanvas active>
        <div>content</div>
      </AnnotationCanvas>,
    );
    expect(screen.getByRole('button', { name: 'Box select' })).toBeTruthy();
    expect(undoButton()).toBeTruthy();
    expect(redoButton()).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Attach image' })).toBeTruthy();
    expect(screen.getByPlaceholderText('Add a note…')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
  });

  it('drawing a box enables Undo; undo/redo update the button state', async () => {
    render(
      <AnnotationCanvas active>
        <div>content</div>
      </AnnotationCanvas>,
    );
    expect(undoButton().disabled).toBe(true);
    drawABox();
    await waitFor(() => expect(undoButton().disabled).toBe(false));
    expect(redoButton().disabled).toBe(true);
  });

  it('Cmd+Z undoes a drawn stroke and Cmd+Shift+Z redoes it', async () => {
    const user = userEvent.setup();
    render(
      <AnnotationCanvas active>
        <div>content</div>
      </AnnotationCanvas>,
    );
    await selectPenTool(user);
    drawAStroke();
    await waitFor(() => expect(undoButton().disabled).toBe(false));

    fireEvent.keyDown(window, { key: 'z', metaKey: true });
    await waitFor(() => expect(undoButton().disabled).toBe(true));
    expect(redoButton().disabled).toBe(false);

    fireEvent.keyDown(window, { key: 'z', metaKey: true, shiftKey: true });
    await waitFor(() => expect(undoButton().disabled).toBe(false));
    expect(redoButton().disabled).toBe(true);
  });

  it('the Undo/Redo toolbar buttons themselves also work', async () => {
    const user = userEvent.setup();
    render(
      <AnnotationCanvas active>
        <div>content</div>
      </AnnotationCanvas>,
    );
    await selectPenTool(user);
    drawAStroke();
    await waitFor(() => expect(undoButton().disabled).toBe(false));
    fireEvent.click(undoButton());
    await waitFor(() => expect(undoButton().disabled).toBe(true));
    fireEvent.click(redoButton());
    await waitFor(() => expect(undoButton().disabled).toBe(false));
  });

  it('the floating dock repositions after a 2nd box even though hasBox stays true throughout', async () => {
    // Regression coverage for a real bug caught during this port's own
    // Phase 8.5 audit: `hasBox` doesn't flip (true -> true) when a 2nd box
    // is committed, so without an explicit re-render trigger
    // (`drawing.layoutRevision`, threaded into the dock-placement hook's
    // deps) the toolbar would silently keep anchoring to the 1st box.
    render(
      <AnnotationCanvas active>
        <div>content</div>
      </AnnotationCanvas>,
    );
    const canvas = document.querySelector('canvas')!;
    const dock = () => document.querySelector('.jini-annotation-dock') as HTMLDivElement;

    firePointerEvent(canvas, 'pointerdown', 100, 100);
    firePointerEvent(canvas, 'pointermove', 150, 150);
    firePointerEvent(canvas, 'pointerup', 150, 150);
    await waitFor(() => expect(undoButton().disabled).toBe(false));
    const firstPlacement = dock().style.cssText;

    firePointerEvent(canvas, 'pointerdown', 600, 500);
    firePointerEvent(canvas, 'pointermove', 650, 550);
    firePointerEvent(canvas, 'pointerup', 650, 550);
    await waitFor(() => expect(dock().style.cssText).not.toBe(firstPlacement));
  });

  it('undoing a box is one-way — redo does not bring it back (matches the original)', async () => {
    render(
      <AnnotationCanvas active>
        <div>content</div>
      </AnnotationCanvas>,
    );
    drawABox();
    await waitFor(() => expect(undoButton().disabled).toBe(false));
    fireEvent.click(undoButton());
    await waitFor(() => expect(undoButton().disabled).toBe(true));
    expect(redoButton().disabled).toBe(true);
  });

  it('Escape deactivates the overlay', () => {
    const onActiveChange = vi.fn();
    render(
      <AnnotationCanvas active onActiveChange={onActiveChange}>
        <div>content</div>
      </AnnotationCanvas>,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onActiveChange).toHaveBeenCalledWith(false);
  });

  it('the close button deactivates the overlay and reports the exit toolbar event', () => {
    const onActiveChange = vi.fn();
    const onToolbarClick = vi.fn();
    render(
      <AnnotationCanvas active onActiveChange={onActiveChange} onToolbarClick={onToolbarClick}>
        <div>content</div>
      </AnnotationCanvas>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onToolbarClick).toHaveBeenCalledWith('exit');
    expect(onActiveChange).toHaveBeenCalledWith(false);
  });

  describe('the submit-action picker', () => {
    it('offers Send / Add to input / Queue, and picking one submits with that action', async () => {
      const dependencies = createFakeAnnotationCanvasDependencies();
      const submitSpy = vi.spyOn(dependencies.data, 'submitAnnotation');
      const user = userEvent.setup();
      render(
        <AnnotationCanvas active dependencies={dependencies}>
          <div>content</div>
        </AnnotationCanvas>,
      );
      await user.type(screen.getByPlaceholderText('Add a note…'), 'hello');
      await user.click(screen.getByRole('button', { name: 'Submit options' }));
      const menu = screen.getByRole('menu', { name: 'Submit options' });
      expect(within(menu).getByRole('menuitemradio', { name: 'Send' })).toBeTruthy();
      expect(within(menu).getByRole('menuitemradio', { name: 'Add to input' })).toBeTruthy();
      const queueItem = within(menu).getByRole('menuitemradio', { name: 'Queue' });
      await user.click(queueItem);
      await waitFor(() => expect(submitSpy).toHaveBeenCalledWith(expect.objectContaining({ action: 'queue', note: 'hello' })));
    });

    it('Enter in the note input submits via queue specifically', async () => {
      const dependencies = createFakeAnnotationCanvasDependencies();
      const submitSpy = vi.spyOn(dependencies.data, 'submitAnnotation');
      const user = userEvent.setup();
      render(
        <AnnotationCanvas active dependencies={dependencies}>
          <div>content</div>
        </AnnotationCanvas>,
      );
      const note = screen.getByPlaceholderText('Add a note…');
      await user.type(note, 'shipped it{Enter}');
      await waitFor(() => expect(submitSpy).toHaveBeenCalledWith(expect.objectContaining({ action: 'queue', note: 'shipped it' })));
    });

    it('the primary split-button half sends the currently-selected action (default Send)', async () => {
      const dependencies = createFakeAnnotationCanvasDependencies();
      const submitSpy = vi.spyOn(dependencies.data, 'submitAnnotation');
      const user = userEvent.setup();
      render(
        <AnnotationCanvas active dependencies={dependencies}>
          <div>content</div>
        </AnnotationCanvas>,
      );
      await user.type(screen.getByPlaceholderText('Add a note…'), 'hi');
      await user.click(screen.getByRole('button', { name: 'Send' }));
      await waitFor(() => expect(submitSpy).toHaveBeenCalledWith(expect.objectContaining({ action: 'send' })));
    });

    it('disables Send (with a reason) but keeps Queue/Add-to-input enabled when sendDisabled is set', async () => {
      const user = userEvent.setup();
      render(
        <AnnotationCanvas active sendDisabled sendDisabledReason="A task is running">
          <div>content</div>
        </AnnotationCanvas>,
      );
      await user.type(screen.getByPlaceholderText('Add a note…'), 'hi');
      await user.click(screen.getByRole('button', { name: 'Submit options' }));
      const menu = screen.getByRole('menu', { name: 'Submit options' });
      expect((within(menu).getByRole('menuitemradio', { name: 'Send' }) as HTMLButtonElement).disabled).toBe(true);
      expect((within(menu).getByRole('menuitemradio', { name: 'Queue' }) as HTMLButtonElement).disabled).toBe(false);
    });
  });

  it('mounts under I18nProvider with a dictionary and renders translated strings end-to-end', () => {
    render(
      <I18nProvider dictionaries={{ fr: { Undo: 'Annuler', Redo: 'Rétablir' } }} initialLocale="fr">
        <AnnotationCanvas active>
          <div>content</div>
        </AnnotationCanvas>
      </I18nProvider>,
    );
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Rétablir' })).toBeTruthy();
  });

  describe('the text-label tool', () => {
    it('dropping a label on the canvas opens it for editing immediately', async () => {
      const user = userEvent.setup();
      render(
        <AnnotationCanvas active>
          <div>content</div>
        </AnnotationCanvas>,
      );
      await user.click(screen.getByRole('button', { name: 'Box select' }));
      await user.click(screen.getByRole('menuitemradio', { name: 'Text' }));
      const canvas = document.querySelector('canvas')!;
      firePointerEvent(canvas, 'pointerdown', 150, 150);
      const textarea = await screen.findByRole('textbox', { name: 'Text' });
      expect(document.activeElement).toBe(textarea);
      expect((textarea as HTMLTextAreaElement).readOnly).toBe(false);
    });

    it('blurring an untyped label removes it', async () => {
      const user = userEvent.setup();
      render(
        <AnnotationCanvas active>
          <div>content</div>
        </AnnotationCanvas>,
      );
      await user.click(screen.getByRole('button', { name: 'Box select' }));
      await user.click(screen.getByRole('menuitemradio', { name: 'Text' }));
      const canvas = document.querySelector('canvas')!;
      firePointerEvent(canvas, 'pointerdown', 150, 150);
      const textarea = await screen.findByRole('textbox', { name: 'Text' });
      fireEvent.blur(textarea);
      await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Text' })).toBeNull());
    });

    it('a typed label survives blur and can be removed via its remove button', async () => {
      const user = userEvent.setup();
      render(
        <AnnotationCanvas active>
          <div>content</div>
        </AnnotationCanvas>,
      );
      await user.click(screen.getByRole('button', { name: 'Box select' }));
      await user.click(screen.getByRole('menuitemradio', { name: 'Text' }));
      const canvas = document.querySelector('canvas')!;
      firePointerEvent(canvas, 'pointerdown', 150, 150);
      const textarea = await screen.findByRole('textbox', { name: 'Text' });
      await user.type(textarea, 'hello');
      fireEvent.blur(textarea);
      expect(screen.getByRole('textbox', { name: 'Text' })).toBeTruthy();

      await user.click(screen.getByRole('button', { name: 'Remove annotation' }));
      await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Text' })).toBeNull());
    });
  });

  describe('the mark-tool dropdown menu', () => {
    it('closes on an outside pointer-down', async () => {
      const user = userEvent.setup();
      render(
        <AnnotationCanvas active>
          <div>content</div>
        </AnnotationCanvas>,
      );
      await user.click(screen.getByRole('button', { name: 'Box select' }));
      expect(screen.getByRole('menu', { name: 'Mark tool' })).toBeTruthy();
      fireEvent.mouseDown(document.body);
      await waitFor(() => expect(screen.queryByRole('menu', { name: 'Mark tool' })).toBeNull());
    });

    it('closes on Escape without deactivating the whole overlay', async () => {
      const user = userEvent.setup();
      const onActiveChange = vi.fn();
      render(
        <AnnotationCanvas active onActiveChange={onActiveChange}>
          <div>content</div>
        </AnnotationCanvas>,
      );
      await user.click(screen.getByRole('button', { name: 'Box select' }));
      expect(screen.getByRole('menu', { name: 'Mark tool' })).toBeTruthy();
      fireEvent.keyDown(window, { key: 'Escape' });
      await waitFor(() => expect(screen.queryByRole('menu', { name: 'Mark tool' })).toBeNull());
      expect(onActiveChange).not.toHaveBeenCalled();
    });
  });
});
