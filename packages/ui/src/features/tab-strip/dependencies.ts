import type { TabStripHapticsPort } from './ports.js';

/**
 * Real browser haptics implementation — ported from `WorkspaceTabsBar.tsx`'s
 * `pulseTabDragHaptic`: SSR-guarded, opportunistic (a `navigator.vibrate`
 * failure/absence is silently swallowed, matching the source's own
 * "unsupported environments should keep dragging normally" comment).
 */
export function createBrowserTabStripHaptics(): TabStripHapticsPort {
  return {
    pulse(durationMs: number) {
      if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
      try {
        navigator.vibrate(durationMs);
      } catch {
        // Haptics are opportunistic; unsupported environments keep dragging normally.
      }
    },
  };
}
