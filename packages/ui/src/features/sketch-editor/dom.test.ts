// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONTEXT_MENU_ACTION_ORDER, DEFAULT_CONTEXT_MENU_RECOGNIZED_ACTIONS, DEFAULT_SKETCH_TOOLTIP_TARGETS } from './constants.js';
import {
  applySketchContextMenuSimplification,
  applySketchDomTextOverrides,
  applySketchEditorTooltips,
  enhanceSketchExcalidrawPortals,
  findSketchMermaidInsertButton,
  handleSketchPortalCommandEnter,
  readDefaultSketchToolColor,
  readExcalidrawTheme,
  removeSketchMermaidShortcutHints,
  rewriteExcalidrawUnableToEmbedToasts,
} from './dom.js';
import { buildSketchTooltipLabels } from './rules.js';

const t = (key: string) => key;
const labels = buildSketchTooltipLabels(t);
const INSERT_PATTERN = /^(Insert)(\s|$|→)/i;

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
  document.body.innerHTML = '';
});

describe('readExcalidrawTheme', () => {
  it('reads data-theme off <html>, defaulting to light', () => {
    expect(readExcalidrawTheme()).toBe('light');
    document.documentElement.setAttribute('data-theme', 'dark');
    expect(readExcalidrawTheme()).toBe('dark');
  });
});

describe('readDefaultSketchToolColor', () => {
  it('matches the active theme', () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    expect(readDefaultSketchToolColor()).toBe('#ffffff');
    document.documentElement.setAttribute('data-theme', 'light');
    expect(readDefaultSketchToolColor()).toBe('#1c1b1a');
  });
});

describe('applySketchEditorTooltips', () => {
  it('decorates a toolbar trigger with data-tooltip/aria-label and the jini-tooltip class', () => {
    const root = document.createElement('div');
    root.innerHTML = '<button data-testid="main-menu-trigger"></button>';
    document.body.appendChild(root);

    applySketchEditorTooltips(root, labels, DEFAULT_SKETCH_TOOLTIP_TARGETS);

    const button = root.querySelector('[data-testid="main-menu-trigger"]')!;
    expect(button.getAttribute('data-tooltip')).toBe('Main menu');
    expect(button.getAttribute('data-tooltip-placement')).toBe('bottom');
    expect(button.getAttribute('aria-label')).toBe('Main menu');
    expect(button.classList.contains('jini-tooltip')).toBe(true);
  });

  it('decorates the closest <label> for a "closest-label" target', () => {
    const root = document.createElement('div');
    root.innerHTML = '<label><button data-testid="toolbar-rectangle"></button></label>';
    document.body.appendChild(root);

    applySketchEditorTooltips(root, labels, DEFAULT_SKETCH_TOOLTIP_TARGETS);

    const label = root.querySelector('label')!;
    const button = root.querySelector('[data-testid="toolbar-rectangle"]')!;
    expect(label.getAttribute('data-tooltip')).toBe('Rectangle');
    expect(button.getAttribute('aria-label')).toBe('Rectangle');
  });

  it('is idempotent across repeated calls (no duplicate class, same attributes)', () => {
    const root = document.createElement('div');
    root.innerHTML = '<button data-testid="main-menu-trigger"></button>';
    document.body.appendChild(root);
    applySketchEditorTooltips(root, labels, DEFAULT_SKETCH_TOOLTIP_TARGETS);
    applySketchEditorTooltips(root, labels, DEFAULT_SKETCH_TOOLTIP_TARGETS);
    const button = root.querySelector('[data-testid="main-menu-trigger"]')!;
    expect(button.getAttribute('data-tooltip')).toBe('Main menu');
    expect(button.classList.toString()).toBe('jini-tooltip');
  });

  it('only decorates each target element once within a single call, even if two targets resolve to it', () => {
    const root = document.createElement('div');
    // Both a direct selector match and a closest-label match could resolve
    // to the same <label> in principle; verify the `decorated` guard keeps
    // a single element from being written to twice in one pass.
    root.innerHTML = '<button data-testid="main-menu-trigger"></button>';
    document.body.appendChild(root);
    const targets = [
      { selector: '[data-testid="main-menu-trigger"]', label: 'mainMenu' as const, placement: 'bottom' as const },
      { selector: '[data-testid="main-menu-trigger"]', label: 'lock' as const, placement: 'top' as const },
    ];
    applySketchEditorTooltips(root, labels, targets);
    const button = root.querySelector('[data-testid="main-menu-trigger"]')!;
    expect(button.getAttribute('data-tooltip')).toBe('Main menu');
    expect(button.getAttribute('data-tooltip-placement')).toBe('bottom');
  });
});

describe('applySketchContextMenuSimplification', () => {
  function buildMenu(actions: string[]): { root: HTMLElement; menu: HTMLUListElement; popover: HTMLElement } {
    const root = document.createElement('div');
    const popover = document.createElement('div');
    popover.className = 'popover';
    const menu = document.createElement('ul');
    menu.className = 'context-menu';
    for (const action of actions) {
      const li = document.createElement('li');
      li.setAttribute('data-testid', action);
      li.textContent = action;
      menu.appendChild(li);
    }
    const hr = document.createElement('hr');
    menu.appendChild(hr);
    popover.appendChild(menu);
    root.appendChild(popover);
    document.body.appendChild(root);
    return { root, menu, popover };
  }

  it('removes disallowed actions and separators, keeping allow-listed ones in order', () => {
    const { root, menu, popover } = buildMenu(['delete', 'copyAsSvg', 'copy', 'duplicate']);
    applySketchContextMenuSimplification(root, root, DEFAULT_CONTEXT_MENU_ACTION_ORDER, DEFAULT_CONTEXT_MENU_RECOGNIZED_ACTIONS);
    const items = Array.from(menu.querySelectorAll('li')).map((li) => li.getAttribute('data-testid'));
    expect(items).toEqual(['copy', 'copyAsSvg']);
    expect(menu.querySelectorAll('hr')).toHaveLength(0);
    expect(menu.classList.contains('jini-sketch-context-menu')).toBe(true);
    expect(popover.classList.contains('jini-sketch-context-popover')).toBe(true);
  });

  it('ignores a context menu with no recognized Excalidraw action', () => {
    const { menu } = buildMenu(['someUnrelatedAction']);
    const root = menu.closest('div')!;
    applySketchContextMenuSimplification(root, root, DEFAULT_CONTEXT_MENU_ACTION_ORDER, DEFAULT_CONTEXT_MENU_RECOGNIZED_ACTIONS);
    expect(menu.classList.contains('jini-sketch-context-menu')).toBe(false);
    expect(menu.querySelectorAll('li')).toHaveLength(1);
  });

  it('removes the popover entirely when no allow-listed action survives', () => {
    const { root, popover } = buildMenu(['delete', 'duplicate']);
    applySketchContextMenuSimplification(root, root, DEFAULT_CONTEXT_MENU_ACTION_ORDER, DEFAULT_CONTEXT_MENU_RECOGNIZED_ACTIONS);
    expect(root.contains(popover)).toBe(false);
  });

  it('does not reorder DOM nodes when already in the correct order (avoids reorder churn)', () => {
    const { root, menu } = buildMenu(['copy', 'paste']);
    const firstChildBefore = menu.children[0];
    applySketchContextMenuSimplification(root, root, DEFAULT_CONTEXT_MENU_ACTION_ORDER, DEFAULT_CONTEXT_MENU_RECOGNIZED_ACTIONS);
    expect(menu.children[0]).toBe(firstChildBefore);
  });
});

describe('applySketchDomTextOverrides', () => {
  it('rewrites matching text nodes and attributes', () => {
    const root = document.createElement('div');
    root.innerHTML = '<button title="Close" aria-label="Close">Close</button>';
    applySketchDomTextOverrides(root, { Close: 'Fermer' });
    const button = root.querySelector('button')!;
    expect(button.textContent).toBe('Fermer');
    expect(button.getAttribute('title')).toBe('Fermer');
    expect(button.getAttribute('aria-label')).toBe('Fermer');
  });

  it('is a no-op when overrides are undefined or empty', () => {
    const root = document.createElement('div');
    root.innerHTML = '<button title="Close">Close</button>';
    applySketchDomTextOverrides(root, undefined);
    applySketchDomTextOverrides(root, {});
    expect(root.querySelector('button')!.textContent).toBe('Close');
  });
});

describe('rewriteExcalidrawUnableToEmbedToasts', () => {
  it('rewrites the recognized "can\'t embed" toast message', () => {
    const root = document.createElement('div');
    root.innerHTML = '<div class="Toast"><div class="Toast__message">Embedding this URL is currently not allowed</div></div>';
    document.body.appendChild(root);
    rewriteExcalidrawUnableToEmbedToasts(root, 'Cannot embed this link');
    const message = root.querySelector('.Toast__message')!;
    expect(message.textContent).toBe('Cannot embed this link');
    expect(message.closest('.Toast')!.getAttribute('data-jini-sketch-embed-toast-rewritten')).toBe('true');
  });

  it('leaves unrelated toast messages untouched', () => {
    const root = document.createElement('div');
    root.innerHTML = '<div class="Toast"><div class="Toast__message">Saved successfully</div></div>';
    rewriteExcalidrawUnableToEmbedToasts(root, 'Cannot embed this link');
    expect(root.querySelector('.Toast__message')!.textContent).toBe('Saved successfully');
  });
});

describe('findSketchMermaidInsertButton / removeSketchMermaidShortcutHints', () => {
  it('finds the Insert button inside a Mermaid dialog and strips shortcut hints', () => {
    const content = document.createElement('div');
    content.innerHTML = `
      <div>Mermaid syntax</div>
      <button aria-label="Cancel">Cancel</button>
      <button aria-label="Insert diagram">Insert <kbd>Cmd+Enter</kbd></button>
      <div class="ttd-dialog-submit-shortcut">Cmd+Enter</div>
    `;
    const button = findSketchMermaidInsertButton(content, INSERT_PATTERN);
    expect(button?.getAttribute('aria-label')).toBe('Insert diagram');

    removeSketchMermaidShortcutHints(content, INSERT_PATTERN);
    expect(content.querySelectorAll('kbd')).toHaveLength(0);
    expect(content.querySelectorAll('.ttd-dialog-submit-shortcut')).toHaveLength(0);
  });

  it('returns null for a non-Mermaid dialog', () => {
    const content = document.createElement('div');
    content.innerHTML = '<div>Some other dialog</div><button>Insert</button>';
    expect(findSketchMermaidInsertButton(content, INSERT_PATTERN)).toBeNull();
  });
});

describe('enhanceSketchExcalidrawPortals', () => {
  it('marks portals, toggles the help-modal class, and injects a labeled close button', () => {
    const portal = document.createElement('div');
    portal.className = 'excalidraw-modal-container';
    portal.innerHTML = '<div class="Modal__content">Hello <span class="HelpDialog__header"></span></div>';
    document.body.appendChild(portal);

    const onClose = vi.fn();
    enhanceSketchExcalidrawPortals('Close', onClose, undefined, INSERT_PATTERN);

    expect(portal.classList.contains('jini-sketch-modal')).toBe(true);
    expect(portal.classList.contains('jini-sketch-help-modal')).toBe(true);
    const close = portal.querySelector<HTMLButtonElement>('.jini-sketch-dialog-close')!;
    expect(close).not.toBeNull();
    expect(close.getAttribute('aria-label')).toBe('Close');

    close.click();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not inject a second close button on a repeat call', () => {
    const portal = document.createElement('div');
    portal.className = 'excalidraw-modal-container';
    portal.innerHTML = '<div class="Modal__content">Hello</div>';
    document.body.appendChild(portal);

    enhanceSketchExcalidrawPortals('Close', vi.fn(), undefined, INSERT_PATTERN);
    enhanceSketchExcalidrawPortals('Close', vi.fn(), undefined, INSERT_PATTERN);
    expect(portal.querySelectorAll('.jini-sketch-dialog-close')).toHaveLength(1);
  });

  it('applies domTextOverrides inside the portal', () => {
    const portal = document.createElement('div');
    portal.className = 'excalidraw-modal-container';
    portal.innerHTML = '<div class="Modal__content"><span>Preview</span></div>';
    document.body.appendChild(portal);

    enhanceSketchExcalidrawPortals('Fermer', vi.fn(), { Preview: 'Aperçu' }, INSERT_PATTERN);
    expect(portal.querySelector('span')!.textContent).toBe('Aperçu');
  });
});

describe('handleSketchPortalCommandEnter', () => {
  function keydown(target: Element, options: Partial<KeyboardEventInit> = {}): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true, cancelable: true, ...options });
    Object.defineProperty(event, 'target', { value: target, enumerable: true });
    return event;
  }

  it('clicks the Insert button on Cmd+Enter inside a Mermaid dialog textarea', () => {
    const portal = document.createElement('div');
    portal.className = 'jini-sketch-modal';
    portal.innerHTML =
      '<div class="Modal__content">Mermaid<textarea></textarea><button aria-label="Insert diagram">Insert</button></div>';
    document.body.appendChild(portal);
    const button = portal.querySelector('button')!;
    const onClick = vi.fn();
    button.addEventListener('click', onClick);

    const textarea = portal.querySelector('textarea')!;
    handleSketchPortalCommandEnter(keydown(textarea), INSERT_PATTERN);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does nothing for a plain Enter (no modifier)', () => {
    const portal = document.createElement('div');
    portal.className = 'jini-sketch-modal';
    portal.innerHTML = '<div class="Modal__content">Mermaid<textarea></textarea><button>Insert</button></div>';
    document.body.appendChild(portal);
    const button = portal.querySelector('button')!;
    const onClick = vi.fn();
    button.addEventListener('click', onClick);
    const textarea = portal.querySelector('textarea')!;
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    Object.defineProperty(event, 'target', { value: textarea, enumerable: true });
    handleSketchPortalCommandEnter(event, INSERT_PATTERN);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('does nothing outside a modal/without a textarea', () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    expect(() => handleSketchPortalCommandEnter(keydown(div), INSERT_PATTERN)).not.toThrow();
  });
});
