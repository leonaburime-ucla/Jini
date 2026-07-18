/**
 * `WorkspaceTabsBar.tsx`'s `pulseTabDragHaptic` (`navigator.vibrate`,
 * opportunistic/best-effort) is the one browser-global touch in this
 * feature's drag mechanics, so it's the one injectable seam — same
 * "context/callback + host-injected adapter, default a real browser
 * implementation" shape as `features/connectors/`'s auth-pending storage
 * ports and `features/viewer-shell/`'s clipboard port.
 *
 * Coverage: this file is `export interface` only — zero emitted executable
 * statements, same documented carve-out as `features/viewer-shell/ports.ts`.
 */
export interface TabStripHapticsPort {
  pulse(durationMs: number): void;
}

export const noopTabStripHaptics: TabStripHapticsPort = {
  pulse: () => {},
};
