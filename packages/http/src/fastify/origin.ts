/**
 * Same-origin security guard: wraps the shared, framework-agnostic `isLocalSameOrigin` in the
 * module's `Result` pipeline so the Fastify Adapter can treat an origin failure the same as a
 * parse/handle failure. `isLocalSameOrigin` is imported from the shared root (`../origin-validation.js`)
 * rather than duplicated, since it operates on plain header values (not a framework `Request`) and
 * is already framework-agnostic — see `../pack-http.ts`'s doc for the same reasoning applied there.
 */
import type { FastifyRequest } from 'fastify';
import { createApiError } from '@jini/protocol';
import { isLocalSameOrigin } from '../origin-validation.js';
import { err, ok, type Result } from '../types.js';

/** The subset of server startup state `guardSameOrigin` needs: the resolved local port. */
export interface OriginContext {
  resolvedPortRef: { current: number };
}

/**
 * Wraps `isLocalSameOrigin` so the Fastify Adapter can fold the origin decision into the same
 * error-handling pipeline as parse/handle failures.
 */
export function guardSameOrigin(req: FastifyRequest, origin: OriginContext): Result<void> {
  if (isLocalSameOrigin(req, origin.resolvedPortRef.current)) {
    return ok(undefined);
  }
  return err(createApiError('FORBIDDEN', 'cross-origin request rejected'));
}
