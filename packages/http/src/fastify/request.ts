/**
 * Request-side normalization: turns a raw Fastify `FastifyRequest` into the framework-independent
 * `RouteInputContext` the rest of the module operates on, and builds a standard `BAD_REQUEST`
 * `ApiError` for validation failures. Deliberately duplicated from `../express/request.ts` — see
 * `./response.ts`'s top-of-module doc for why this subtree does not import from `express/`.
 */
import type { FastifyRequest } from 'fastify';
import { createApiError, type ApiError, type ApiValidationIssue } from '@jini/protocol';
import type { RouteInputContext } from '../types.js';

/**
 * Extracts `body`/`query`/`params` from a Fastify `FastifyRequest` into a `RouteInputContext`, so
 * a route's `parse` function can be unit-tested without constructing a real `FastifyRequest`.
 */
export function rawInput(request: FastifyRequest): RouteInputContext {
  return {
    body: request.body,
    query: (request.query ?? {}) as Record<string, unknown>,
    params: (request.params ?? {}) as Record<string, string>,
  };
}

/**
 * Builds a `BAD_REQUEST` `ApiError` for a failed parse. When `issues` is non-empty, attaches
 * them as structured validation details so clients can render per-field errors.
 */
export function validationError(
  message: string,
  issues: Pick<ApiValidationIssue, 'path' | 'message'>[] = [],
): ApiError {
  if (issues.length === 0) {
    return createApiError('BAD_REQUEST', message);
  }
  return createApiError('BAD_REQUEST', message, {
    details: { kind: 'validation', issues } as unknown as NonNullable<ApiError['details']>,
  });
}
