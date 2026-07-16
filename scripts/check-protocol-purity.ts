/**
 * R3: packages/protocol/** must not import any OD DTO / prompts / analytics / design-systems /
 * anything under integrations/**. Enforces the downward-only edge @od/* -> @jini/protocol.
 * Kept separate from the engine-boundary check (as OD splits its guards). SKELETON.
 */
import type { Violation } from './check-engine-boundaries.js';

export async function checkProtocolPurity(): Promise<Violation[]> {
  // TODO: walk packages/protocol/src, resolve every import, fail on any that lands in an OD/api/* or integrations/** target.
  return [];
}
