/**
 * @module research
 *
 * `POST /api/research/search` — a thin route wrapper over Tavily's real Search API
 * (`POST {baseUrl}/search`), ported from OD's `apps/daemon/src/research/tavily.ts` (read directly
 * in the sibling `/Users/la/Desktop/Programming/OSS-Repos/open-design` checkout on this machine —
 * not guessed, per this repo's "verify against the real source, don't guess" convention). Only the
 * request/response shape and defaults are ported (`search_depth: 'basic'`, `include_answer: true`,
 * `include_raw_content: false`, a 20-result hard cap, the `results[]` -> `ResearchSource[]` mapping)
 * — OD's own `TavilyError` class, `AbortController`-based 30s timeout, and `requestInit.dispatcher`
 * passthrough are not carried over; this route pack's own SEC-005 error-handling convention (a
 * generic `INTERNAL_ERROR` + correlation id, matching every other route pack in this package)
 * replaces the origin's thrown-`TavilyError` shape, and no request-level timeout/connection-pooling
 * knobs are exposed yet (`fetch`'s own defaults apply) — a future pass can add them the same way
 * `media.ts#MediaGenerationRequestInit` optionally threads a `dispatcher` through, if a real need
 * for one shows up.
 *
 * **`ResearchSource`/`ResearchSearchResponse` field names match OD's real `@open-design/contracts/
 * api/research.ts` `ResearchSource` shape** (`title`/`url`/`snippet`/`publishedAt?`/`provider`) —
 * kept identical rather than invented fresh, since this is a direct port of a real, working
 * contract, not a from-scratch design.
 *
 * **Credential resolution**: `resolveCredentials` defaults to `@jini/media`'s
 * `resolveProviderCredentialsFromEnv('tavily')` — a genuine **runtime** (non-type) import of
 * `@jini/media`, which is fine: unlike `@jini/capability-providers` (see `connectors.ts`'s module
 * doc for that package's boundary-checker nuance), `@jini/media` is already a real, non-type
 * dependency of `packages/http` (`media.ts` already lists it in `package.json`, this file just adds
 * a second import from the same already-real dependency). A host with its own secrets layer
 * supplies its own `resolveCredentials` instead.
 *
 * **Missing credentials is a clean `NOT_CONFIGURED` (503), not an `INTERNAL_ERROR`.** No API key
 * configured is an expected, non-exceptional state (matching `connectors.ts`'s "capability exists,
 * reachable, inert until configured" shape) — it never reaches the SEC-005 sink, since there is no
 * real exception or secret to hide, just an honest "not set up yet" answer.
 *
 * **SEC-005 for everything else**: a genuine Tavily request/response failure is caught, reported
 * through `onInternalError` (defaults to `console.error`, matching every other route pack), and
 * surfaced to the caller as a generic `INTERNAL_ERROR` — the raw error message (which can echo
 * request details) is never sent to the HTTP caller directly. `redactSecrets` (reused from
 * `@jini/agent-runtime`'s `connection-guard.ts`, already reachable via this package's existing
 * `@jini/agent-runtime` dependency — the same "shared primitive, one implementation" reuse this
 * task's agent-runtime work applied to `sse-decode.ts`/`turn-end-guard.ts`) strips the bearer
 * token out of any upstream error text before it is even logged, belt-and-braces alongside the
 * generic-message substitution.
 */
import { randomUUID } from 'node:crypto';
import type { Express } from 'express';
import { redactSecrets, validateBaseUrl } from '@jini/agent-runtime';
import { resolveProviderCredentialsFromEnv, type ProviderCredentials } from '@jini/media';
import { createApiError } from '@jini/protocol';
import { defineJsonRoute, mountJsonRoute, type AdapterContext } from './adapter.js';
import { validationError } from './request.js';
import { err, ok, type Result, type RouteInputContext } from './types.js';

const DEFAULT_TAVILY_BASE_URL = 'https://api.tavily.com';
/** Tavily's own documented cap on `max_results` (see OD's `tavily.ts#TAVILY_MAX_RESULTS_LIMIT`). */
const TAVILY_MAX_RESULTS_LIMIT = 20;
const DEFAULT_MAX_SOURCES = 5;

export interface ResearchSource {
  readonly title: string;
  readonly url: string;
  readonly snippet: string;
  readonly publishedAt?: string;
  readonly provider: string;
}

export interface ResearchSearchResponse {
  readonly answer: string;
  readonly sources: readonly ResearchSource[];
}

export interface ResearchInternalErrorContext {
  readonly correlationId: string;
  readonly error: unknown;
}

export interface ResearchHttpDeps {
  /** Resolves per-provider credentials. Defaults to `@jini/media`'s `resolveProviderCredentialsFromEnv('tavily')` — see module doc. */
  readonly resolveCredentials?: (providerId: string) => Promise<ProviderCredentials>;
  /** Host-owned sink for the real exception behind a generic `INTERNAL_ERROR` response (SEC-005). Defaults to `console.error`. */
  readonly onInternalError?: (context: ResearchInternalErrorContext) => void;
}

function defaultInternalErrorSink(context: ResearchInternalErrorContext): void {
  // eslint-disable-next-line no-console
  console.error(`[@jini/http] internal error (research/search, correlationId=${context.correlationId})`, context.error);
}

async function defaultResolveCredentials(providerId: string): Promise<ProviderCredentials> {
  return resolveProviderCredentialsFromEnv(providerId);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

interface ResearchSearchRequest {
  readonly query: string;
  readonly maxSources?: number;
}

function parseResearchSearch(input: RouteInputContext): Result<ResearchSearchRequest> {
  if (!isRecord(input.body)) return err(validationError('body must be a JSON object'));
  const query = nonEmptyString(input.body.query);
  if (!query) return err(validationError('query must be a non-empty string', [{ path: 'query', message: 'required non-empty string' }]));
  const maxSources = input.body.maxSources;
  if (maxSources !== undefined && (typeof maxSources !== 'number' || !Number.isFinite(maxSources) || maxSources <= 0)) {
    return err(validationError('maxSources must be a positive number when provided'));
  }
  return ok({ query, ...(maxSources !== undefined ? { maxSources: maxSources as number } : {}) });
}

interface TavilyRawResult {
  readonly title?: unknown;
  readonly url?: unknown;
  readonly content?: unknown;
  readonly score?: unknown;
  readonly published_date?: unknown;
}

interface TavilyRawResponse {
  readonly answer?: unknown;
  readonly results?: unknown;
}

/** Calls Tavily's real `POST /search` endpoint directly — see module doc for the port's exact scope/provenance. Throws (never a `Result`) on any failure; the route handler below is the one place that converts a thrown error into the package's SEC-005 response shape. */
async function tavilySearch(credentials: ProviderCredentials, request: ResearchSearchRequest): Promise<ResearchSearchResponse> {
  const apiKey = credentials.apiKey;
  if (!apiKey) {
    // The caller (the route handler below) always checks this before calling in — see its own
    // `NOT_CONFIGURED` branch — so this is a defense-in-depth guard, not the primary contract.
    throw new Error('Tavily API key is not configured');
  }
  const baseUrl = credentials.baseUrl ?? DEFAULT_TAVILY_BASE_URL;
  const baseUrlCheck = validateBaseUrl(baseUrl);
  if (baseUrlCheck.error) {
    throw new Error(baseUrlCheck.error);
  }
  const base = baseUrl.replace(/\/+$/, '');
  const maxResults = Math.max(0, Math.min(request.maxSources ?? DEFAULT_MAX_SOURCES, TAVILY_MAX_RESULTS_LIMIT));
  const body = {
    query: request.query,
    search_depth: 'basic',
    max_results: maxResults,
    include_answer: true,
    include_raw_content: false,
  };

  let response: Response;
  try {
    response = await fetch(`${base}/search`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(redactSecrets(`Tavily request failed: ${message}`, [apiKey]));
  }
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(redactSecrets(`Tavily ${response.status}: ${text.slice(0, 200) || 'no body'}`, [apiKey]));
  }

  const json = (await response.json()) as TavilyRawResponse;
  const answer = typeof json.answer === 'string' ? json.answer : '';
  const rawResults = Array.isArray(json.results) ? json.results : [];
  const sources: ResearchSource[] = [];
  for (const raw of rawResults as TavilyRawResult[]) {
    const url = typeof raw.url === 'string' ? raw.url : '';
    if (!url) continue;
    const publishedAt = typeof raw.published_date === 'string' && raw.published_date.trim() ? raw.published_date.trim() : undefined;
    sources.push({
      title: typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : url,
      url,
      snippet: typeof raw.content === 'string' ? raw.content.trim().slice(0, 800) : '',
      provider: 'tavily',
      ...(publishedAt ? { publishedAt } : {}),
    });
  }
  return { answer, sources };
}

export const researchSearchRoute = defineJsonRoute<ResearchSearchRequest, ResearchSearchResponse, ResearchHttpDeps>({
  method: 'post',
  path: '/api/research/search',
  requireSameOrigin: true,
  parse: parseResearchSearch,
  handle: async (request, deps) => {
    const resolveCredentials = deps.resolveCredentials ?? defaultResolveCredentials;
    const onInternalError = deps.onInternalError ?? defaultInternalErrorSink;

    let credentials: ProviderCredentials;
    try {
      credentials = await resolveCredentials('tavily');
    } catch (error) {
      const correlationId = randomUUID();
      onInternalError({ correlationId, error });
      return err(createApiError('INTERNAL_ERROR', 'an internal error occurred', { requestId: correlationId }));
    }

    if (!credentials.apiKey) {
      return err(createApiError('NOT_CONFIGURED', 'tavily provider not configured'));
    }

    try {
      const result = await tavilySearch(credentials, request);
      return ok(result);
    } catch (error) {
      const correlationId = randomUUID();
      onInternalError({ correlationId, error });
      return err(createApiError('INTERNAL_ERROR', 'an internal error occurred', { requestId: correlationId }));
    }
  },
});

/** Mounts `POST /api/research/search` on `app`. A pack's `http(app, services)` calls this directly. */
export function registerResearchRoutes(app: Express, deps: ResearchHttpDeps, adapter: AdapterContext): void {
  mountJsonRoute(app, researchSearchRoute, deps, adapter);
}
