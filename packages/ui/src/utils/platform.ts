/**
 * Origin: `utils/platform.ts` — ported verbatim, no OD coupling (zero
 * imports, pure `navigator.platform` sniff).
 */
export function isMacPlatform(): boolean {
  return typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
}
