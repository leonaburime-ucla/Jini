/**
 * Legacy-shaped error helpers: build/send an `ApiError` from separate `code`/`message`/`init`
 * arguments, matching call sites that predate `JsonRouteSpec`/`mountJsonRoute` (e.g. a host
 * application's own hand-mounted routes). No internal dependencies. `sendApiError` here is
 * deliberately the same name as `response.ts`'s `ApiError`-object-taking `sendApiError` — they
 * are different signatures for the same "send an error" job at two call-site generations; the
 * package's `fastify/index.ts` barrel re-exports this one as `sendCompatApiError` to keep both
 * addressable without a collision. Deliberately duplicated from `../express/compat.ts` — see
 * `./response.ts`'s top-of-module doc for why this subtree does not import from `express/`.
 */
import type { ApiError, ApiErrorCode, ApiErrorResponse } from '@jini/protocol';
import type { FastifyReply } from 'fastify';

/** Builds an `ApiError` from separate `code`/`message`/`init` arguments (legacy call shape). */
export function createCompatApiError(
  code: ApiErrorCode,
  message: string,
  init: Omit<ApiError, 'code' | 'message'> = {},
): ApiError {
  return { code, message, ...init };
}

/** Wraps `createCompatApiError`'s result in the standard `{ error }` envelope. */
export function createCompatApiErrorResponse(
  code: ApiErrorCode,
  message: string,
  init: Omit<ApiError, 'code' | 'message'> = {},
): ApiErrorResponse {
  return { error: createCompatApiError(code, message, init) };
}

/**
 * Writes an `ApiError` response built from separate `code`/`message`/`init` arguments (legacy
 * call shape) with the given status code. Exported from `fastify/index.ts` as `sendCompatApiError`.
 */
export function sendApiError(
  reply: FastifyReply,
  status: number,
  code: ApiErrorCode,
  message: string,
  init: Omit<ApiError, 'code' | 'message'> = {},
): FastifyReply {
  return reply.code(status).send(createCompatApiErrorResponse(code, message, init));
}
