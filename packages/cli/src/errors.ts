/**
 * @module errors
 *
 * Structured error / exit-code handling, generalized from OD's
 * `apps/daemon/src/cli.ts` `exitWithStructuredError`/`structuredHttpFailure`
 * (see `source-map.md`). The mechanism — map a stable error `code` to a
 * process exit code, write a `{ error: { code, message, data } }` envelope
 * to stderr — is generic CLI transport plumbing; OD's own exit-code table
 * (`plugin-not-found`, `snapshot-stale`, …) is product-specific and was not
 * ported. Callers extend {@link DEFAULT_CLI_EXIT_CODES} with their own pack's
 * codes rather than this package hosting one global mutable map.
 */

export type ExitCodeTable = Readonly<Record<string, number>>;

/** A minimal, product-neutral starting table. Packs extend this with their own codes. */
export const DEFAULT_CLI_EXIT_CODES: ExitCodeTable = {
  'daemon-not-running': 64,
  'missing-input': 67,
  'invalid-flag': 2,
};

export interface StructuredErrorEnvelope {
  error: {
    code: string;
    message: string;
    data: Record<string, unknown>;
  };
}

export interface ExitWithStructuredErrorInput {
  code: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface StructuredErrorOptions {
  /** Extra/overriding `code -> exitCode` entries layered on {@link DEFAULT_CLI_EXIT_CODES}. */
  exitCodes?: ExitCodeTable;
  /** Defaults to `process.stderr.write`; inject for tests. */
  write?: (text: string) => void;
  /** Defaults to `process.exit`; inject for tests (must not return). */
  exit?: (code: number) => never;
}

/**
 * Write a `{ error }` envelope to stderr and exit with the code mapped from
 * `input.code` (falling back to `1` for an unrecognized code).
 */
export function exitWithStructuredError(
  input: ExitWithStructuredErrorInput,
  options: StructuredErrorOptions = {},
): never {
  const exitCodes: ExitCodeTable = { ...DEFAULT_CLI_EXIT_CODES, ...options.exitCodes };
  const exitCode = exitCodes[input.code] ?? 1;
  const envelope: StructuredErrorEnvelope = {
    error: { code: input.code, message: input.message, data: input.data ?? {} },
  };
  const write = options.write ?? ((text: string) => { process.stderr.write(text); });
  const exit = options.exit ?? ((code: number) => process.exit(code));
  write(`${JSON.stringify(envelope)}\n`);
  return exit(exitCode);
}

interface DaemonErrorBody {
  code?: unknown;
  message?: unknown;
  data?: unknown;
  details?: unknown;
  retryable?: unknown;
}

/** The minimal shape of a `fetch()` `Response` this module needs. */
export interface HttpFailureLike {
  status: number;
  text(): Promise<string>;
}

/**
 * Extract `{ data }` worth surfacing to the structured envelope from a
 * daemon error body: any `data` fields, plus `details`/`retryable` when
 * present. Returns `undefined` when there's nothing to attach.
 */
export function structuredErrorData(error: DaemonErrorBody | undefined): Record<string, unknown> | undefined {
  if (error === undefined) return undefined;
  const data: Record<string, unknown> = {};
  if (error.data !== undefined && typeof error.data === 'object' && error.data !== null) {
    Object.assign(data, error.data);
  }
  if (error.details !== undefined) data.details = error.details;
  if (typeof error.retryable === 'boolean') data.retryable = error.retryable;
  return Object.keys(data).length > 0 ? data : undefined;
}

function extractErrorObject(parsed: unknown): DaemonErrorBody | undefined {
  if (typeof parsed !== 'object' || parsed === null || !('error' in parsed)) return undefined;
  const error = (parsed as { error?: unknown }).error;
  if (typeof error === 'string') return { message: error };
  if (typeof error === 'object' && error !== null) return error as DaemonErrorBody;
  return undefined;
}

/**
 * Map a daemon HTTP error response into the structured exit-code envelope.
 * Daemon error bodies come in two shapes in practice: `{ error: { code,
 * message, ... } }` (structured routes) and `{ error: '<message>' }` (flat
 * legacy routes) — both normalize so the message always reaches the
 * envelope instead of collapsing to a bare `HTTP <status>`.
 */
export async function structuredHttpFailure(
  resp: HttpFailureLike,
  fallbackCode = 'daemon-not-running',
  options: StructuredErrorOptions = {},
): Promise<never> {
  let raw = '';
  let parsed: unknown = {};
  try {
    raw = await resp.text();
    parsed = raw.length > 0 ? JSON.parse(raw) : {};
  } catch {
    parsed = {};
  }
  const errorObj = extractErrorObject(parsed);
  const data = structuredErrorData(errorObj);
  const code = typeof errorObj?.code === 'string' ? errorObj.code : fallbackCode;
  const message =
    typeof errorObj?.message === 'string'
      ? errorObj.message
      : `HTTP ${resp.status}${raw.length > 0 ? `: ${raw}` : ''}`;
  return exitWithStructuredError({ code, message, ...(data !== undefined ? { data } : {}) }, options);
}
