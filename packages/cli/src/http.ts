/**
 * @module http
 *
 * HTTP-client-mode transport plumbing, ported from OD's
 * `apps/daemon/src/cli.ts` `surfaceFetchError`/`postJsonToDaemon` (see
 * `source-map.md`). This is the "HTTP-client mode default" half of
 * extraction-plan §3's `@jini/cli` spec: fetch a daemon route, translate a
 * network failure or a daemon error envelope into the structured exit-code
 * contract from `errors.ts`.
 */

import { DEFAULT_CLI_EXIT_CODES, exitWithStructuredError, type ExitCodeTable } from './errors.js';

export interface SurfaceFetchErrorOptions {
  /** Defaults to `process.stderr.write`; inject for tests. */
  write?: (text: string) => void;
}

/**
 * Format a `fetch()` rejection (network-unreachable, sandbox-denied) into a
 * human-readable stderr line, with a hint when the underlying cause looks
 * like a sandboxed-environment outbound-connect denial.
 */
export function surfaceFetchError(err: unknown, daemonUrl: string, options: SurfaceFetchErrorOptions = {}): void {
  const write = options.write ?? ((text: string) => { process.stderr.write(text); });
  const cause = err !== null && typeof err === 'object' ? (err as { cause?: unknown }).cause : null;
  const code =
    cause !== null && typeof cause === 'object' && typeof (cause as { code?: unknown }).code === 'string'
      ? (cause as { code: string }).code
      : null;
  const causeMessage =
    cause !== null && typeof cause === 'object' && typeof (cause as { message?: unknown }).message === 'string'
      ? (cause as { message: string }).message
      : '';
  let detail = err instanceof Error ? err.message : String(err);
  if (code !== null) detail = `${code}${causeMessage.length > 0 ? ` — ${causeMessage}` : ''}`;
  else if (causeMessage.length > 0) detail = causeMessage;
  write(`failed to reach daemon at ${daemonUrl}: ${detail}\n`);
  if (code === 'EPERM' || code === 'ENETUNREACH') {
    write(
      'hint: outbound connect was denied, likely by a sandbox policy. ' +
        'If this command ran inside an agent sandbox, check its network policy — ' +
        'the daemon itself is unaffected and can be reached from a regular shell.\n',
    );
  }
}

interface DaemonJsonErrorBody {
  error?: { code?: unknown; message?: unknown; data?: unknown };
}

export interface PostJsonToDaemonOptions {
  headers?: Record<string, string>;
  exitCodes?: ExitCodeTable;
  /** Defaults to the global `fetch`; inject for tests. */
  fetchImpl?: typeof fetch;
  /** Defaults to `process.stderr.write`; inject for tests. Used only for the unrecognized-error-code fallback path. */
  write?: (text: string) => void;
  /** Defaults to `process.exit`; inject for tests (must not return). Used only for the unrecognized-error-code fallback path. */
  exit?: (code: number) => never;
}

/**
 * `POST` a JSON body to `<base><route>` and return the parsed JSON response.
 * A network failure or a non-2xx daemon response both exit via the
 * structured error contract (`errors.ts`) instead of returning — this
 * function either resolves with the parsed body or never returns.
 */
export async function postJsonToDaemon(
  base: string,
  route: string,
  body: unknown,
  options: PostJsonToDaemonOptions = {},
): Promise<unknown> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const write = options.write ?? ((text: string) => { process.stderr.write(text); });
  const exit = options.exit ?? ((exitCode: number) => process.exit(exitCode));
  const structuredOptions = {
    write,
    exit,
    ...(options.exitCodes !== undefined ? { exitCodes: options.exitCodes } : {}),
  };

  let resp: Response;
  try {
    resp = await fetchImpl(`${base}${route}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...options.headers },
      body: JSON.stringify(body),
    });
  } catch (err) {
    surfaceFetchError(err, base, { write });
    return exitWithStructuredError(
      { code: 'daemon-not-running', message: `Cannot reach daemon at ${base}` },
      structuredOptions,
    );
  }

  const data: unknown = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const errorObj = (data as DaemonJsonErrorBody).error;
    const exitCodes: ExitCodeTable = { ...DEFAULT_CLI_EXIT_CODES, ...options.exitCodes };
    const code = typeof errorObj?.code === 'string' && errorObj.code in exitCodes ? errorObj.code : null;
    if (code !== null) {
      const message = typeof errorObj?.message === 'string' ? errorObj.message : `HTTP ${resp.status}`;
      const rawData = errorObj?.data;
      const errorData =
        rawData !== undefined && typeof rawData === 'object' && rawData !== null
          ? (rawData as Record<string, unknown>)
          : undefined;
      return exitWithStructuredError(
        { code, message, ...(errorData !== undefined ? { data: errorData } : {}) },
        structuredOptions,
      );
    }
    write(`POST ${route} failed: ${resp.status} ${JSON.stringify(data)}\n`);
    return exit(1);
  }
  return data;
}
