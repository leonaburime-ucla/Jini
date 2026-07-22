/**
 * Response-side serialization: writes a plain JSON body or a standard `ApiError` envelope onto a
 * Fastify `FastifyReply`, and maps an `ApiErrorCode` to its default HTTP status. No internal
 * dependencies — this is the terminal step of the Fastify Adapter's error-handling pipeline.
 *
 * Deliberately duplicated from `../express/response.ts` rather than shared: both files implement
 * the identical `ApiErrorCode` -> HTTP status mapping and error-envelope shape, but this
 * subtree's whole point is to stay independent of `express/` (see `../../source-map.md`'s
 * Fastify-transport section) — a Fastify-only consumer must be able to import this module without
 * ever pulling in anything that even *type*-references the `express` package.
 */
import type { FastifyReply } from 'fastify';
import { createApiErrorResponse, type ApiError, type ApiErrorCode } from '@jini/protocol';

/** Writes `body` as JSON with the given status code. */
export function sendJson(reply: FastifyReply, status: number, body: unknown): void {
  reply.code(status).send(body);
}

/** Writes an `ApiError`, wrapped in the standard `{ error }` envelope, with the given status code. */
export function sendApiError(reply: FastifyReply, status: number, error: ApiError): void {
  reply.code(status).send(createApiErrorResponse(error));
}

/**
 * @internal
 * Default HTTP status per generic `ApiErrorCode`. Codes not listed here fall back to 500 in
 * `statusForError` — deliberately conservative, since an unmapped code (including any
 * product-specific code a consuming pack defines) is more likely a new server-side failure mode
 * than a client error. Kept identical to `../express/response.ts`'s copy — see this file's
 * top-of-module doc for why it is duplicated rather than imported.
 */
const ERROR_STATUS_BY_CODE: Partial<Record<ApiErrorCode, number>> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  VALIDATION_FAILED: 422,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  UPSTREAM_UNAVAILABLE: 502,
  TOOL_TOKEN_MISSING: 401,
  TOOL_TOKEN_INVALID: 401,
  TOOL_TOKEN_EXPIRED: 401,
  TOOL_ENDPOINT_DENIED: 403,
  TOOL_OPERATION_DENIED: 403,
  TOOL_NOT_AVAILABLE: 503,
};

/** Resolves the HTTP status to send for an `ApiError`, defaulting to 500 for unmapped codes. */
export function statusForError(error: ApiError): number {
  return ERROR_STATUS_BY_CODE[error.code] ?? 500;
}
