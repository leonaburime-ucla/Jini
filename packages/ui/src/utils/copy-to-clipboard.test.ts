import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { copyToClipboard } from './copy-to-clipboard.js';

// This package has no jsdom/happy-dom test environment wired up yet (see
// packages/ui/source-map.md), so DOM globals are stubbed by hand here with
// the minimum surface `copyToClipboard` actually touches, rather than
// pulling in a full DOM test environment for one function.

class FakeElement {
  style: Record<string, string> = {};
  value = '';
  focus(_options?: { preventScroll?: boolean }): void {}
  select(): void {}
  get isConnected(): boolean {
    return true;
  }
}

function installFakeDom(options: { execCommandResult: boolean | 'throw' }) {
  const appendChild = vi.fn();
  const removeChild = vi.fn();
  const execCommand = vi.fn(() => {
    if (options.execCommandResult === 'throw') throw new Error('execCommand unsupported');
    return options.execCommandResult;
  });
  const priorFocusElement = new FakeElement();
  const focusSpy = vi.spyOn(priorFocusElement, 'focus');

  vi.stubGlobal('HTMLElement', FakeElement);
  vi.stubGlobal('document', {
    activeElement: priorFocusElement,
    createElement: () => new FakeElement(),
    execCommand,
    body: { appendChild, removeChild },
  });

  return { appendChild, removeChild, execCommand, priorFocusElement, focusSpy };
}

describe('copyToClipboard', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns true via the Clipboard API without touching the DOM fallback', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const { appendChild } = installFakeDom({ execCommandResult: true });

    await expect(copyToClipboard('hello')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('hello');
    expect(appendChild).not.toHaveBeenCalled();
  });

  describe('when the Clipboard API rejects', () => {
    beforeEach(() => {
      vi.stubGlobal('navigator', {
        clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
      });
    });

    it('falls back to execCommand(copy) and restores prior focus', async () => {
      const { appendChild, removeChild, execCommand, focusSpy } = installFakeDom({
        execCommandResult: true,
      });

      await expect(copyToClipboard('fallback text')).resolves.toBe(true);
      expect(appendChild).toHaveBeenCalledTimes(1);
      expect(execCommand).toHaveBeenCalledWith('copy');
      expect(removeChild).toHaveBeenCalledTimes(1);
      expect(focusSpy).toHaveBeenCalled();
    });

    it('returns false when execCommand reports failure', async () => {
      installFakeDom({ execCommandResult: false });
      await expect(copyToClipboard('x')).resolves.toBe(false);
    });

    it('returns false when execCommand throws', async () => {
      const { removeChild } = installFakeDom({ execCommandResult: 'throw' });
      await expect(copyToClipboard('x')).resolves.toBe(false);
      // Cleanup still runs even when execCommand throws.
      expect(removeChild).toHaveBeenCalledTimes(1);
    });

    it('skips restoring focus when document.activeElement is not an HTMLElement', async () => {
      const { execCommand } = installFakeDom({ execCommandResult: true });
      // Override activeElement with a plain object -- fails the
      // `instanceof HTMLElement` check regardless of the stubbed class.
      vi.stubGlobal('document', {
        activeElement: {},
        createElement: () => new FakeElement(),
        execCommand,
        body: { appendChild: vi.fn(), removeChild: vi.fn() },
      });

      await expect(copyToClipboard('x')).resolves.toBe(true);
    });

    it('skips restoring focus when the prior element is no longer connected', async () => {
      const execCommand = vi.fn(() => true);
      class DisconnectedElement extends FakeElement {
        get isConnected(): boolean {
          return false;
        }
      }
      const priorFocusElement = new DisconnectedElement();
      const focusSpy = vi.spyOn(priorFocusElement, 'focus');
      vi.stubGlobal('HTMLElement', FakeElement);
      vi.stubGlobal('document', {
        activeElement: priorFocusElement,
        createElement: () => new FakeElement(),
        execCommand,
        body: { appendChild: vi.fn(), removeChild: vi.fn() },
      });

      await expect(copyToClipboard('x')).resolves.toBe(true);
      expect(focusSpy).not.toHaveBeenCalled();
    });

    it('retries with no options when focus({ preventScroll }) throws', async () => {
      const execCommand = vi.fn(() => true);
      class PickyFocusElement extends FakeElement {
        override focus(options?: { preventScroll?: boolean }): void {
          if (options) throw new Error('preventScroll unsupported');
        }
      }
      const priorFocusElement = new PickyFocusElement();
      const focusSpy = vi.spyOn(priorFocusElement, 'focus');
      vi.stubGlobal('HTMLElement', FakeElement);
      vi.stubGlobal('document', {
        activeElement: priorFocusElement,
        createElement: () => new FakeElement(),
        execCommand,
        body: { appendChild: vi.fn(), removeChild: vi.fn() },
      });

      await expect(copyToClipboard('x')).resolves.toBe(true);
      expect(focusSpy).toHaveBeenCalledTimes(2);
      expect(focusSpy).toHaveBeenNthCalledWith(1, { preventScroll: true });
      expect(focusSpy).toHaveBeenNthCalledWith(2);
    });
  });
});
