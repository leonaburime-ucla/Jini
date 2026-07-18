/**
 * Reads a boolean "visual stability" mode flag from `localStorage` — a
 * generic pattern for opting a session into deterministic/reduced-motion
 * rendering for visual-regression testing.
 *
 * Origin: `utils/visualStability.ts`, whose storage key was a
 * product-identity string namespaced to the origin product. Genericized to a
 * caller-configurable key (default `'jini:visual-stability'`).
 *
 * @overallScore 100
 */
export const DEFAULT_VISUAL_STABILITY_STORAGE_KEY = 'jini:visual-stability';

export function isVisualStabilityMode(
  storageKey: string = DEFAULT_VISUAL_STABILITY_STORAGE_KEY,
): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(storageKey) === '1';
  } catch {
    return false;
  }
}
