// Copies text to the clipboard using the canonical Clipboard API, falling
// back to a hidden textarea + execCommand('copy') for older browsers,
// locked-clipboard contexts, or insecure (HTTP) origins where
// navigator.clipboard.writeText rejects.

/**
 * Copy `text` to the system clipboard.
 *
 * @param text - The text to place on the clipboard.
 * @returns `true` on success (either path), `false` when both the Clipboard
 *   API and the `execCommand('copy')` fallback fail.
 * @complexity O(1) — a single clipboard write, with a bounded-size DOM
 *   fallback (create/select/copy/remove one textarea) on rejection.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const priorFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    // `result` is assigned (rather than returned directly) so the try
    // block's own completion isn't itself a branch — with a bare `return`
    // as its last statement, v8's coverage instrumentation adds an
    // unreachable "fell through the closing brace instead of returning"
    // edge that no input can ever exercise.
    let result: boolean;
    try {
      result = document.execCommand('copy');
    } catch {
      result = false;
    } finally {
      document.body.removeChild(ta);
      if (priorFocus?.isConnected) {
        try {
          priorFocus.focus({ preventScroll: true });
        } catch {
          priorFocus.focus();
        }
      }
    }
    return result;
  }
}
