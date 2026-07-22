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
    // Cleanup is repeated at each return point rather than living in a
    // `finally` clause: this `try`'s own `catch { return false; }` can
    // never itself throw, so a `finally` here would carry v8's synthetic
    // "abrupt completion through finally" branch permanently unreachable —
    // same dead-branch discipline as this repo's `daemon/tool-executor.ts`
    // and `packages/ui`'s `useMemoryExtractions.hooks.ts` precedents (see
    // packages/ui/source-map.md's 2026-07-22 dated entry).
    const cleanup = () => {
      document.body.removeChild(ta);
      if (priorFocus?.isConnected) {
        try {
          priorFocus.focus({ preventScroll: true });
        } catch {
          priorFocus.focus();
        }
      }
    };
    try {
      const result = document.execCommand('copy');
      cleanup();
      return result;
    } catch {
      cleanup();
      return false;
    }
  }
}
