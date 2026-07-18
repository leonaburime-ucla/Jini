/**
 * Ported from OD `apps/packaged/src/protocol.ts` (`od://` custom-scheme
 * fetch proxy). Genuinely generic mechanism — a privileged custom scheme
 * whose every request is rewritten onto a local HTTP origin and proxied
 * through `fetch` — de-branded: the scheme string, entry URL, and error
 * code are all caller-supplied/generic instead of hardcoded to `od`/
 * `OD_PROTOCOL_PROXY_FAILED`. The try/catch-to-502 behavior (never let a
 * proxying failure surface as a native "JavaScript error in main process"
 * dialog) is preserved verbatim — it is backend plumbing, not OD-specific.
 */

export interface ProtocolProxyErrorBody {
  error: string;
  message: string;
  code?: string;
  target: string;
}

function buildProxyErrorResponse(error: unknown, target: string): Response {
  const message = error instanceof Error ? error.message : String(error);
  const code =
    error instanceof Error && typeof (error as NodeJS.ErrnoException).code === 'string'
      ? (error as NodeJS.ErrnoException).code
      : null;
  const body: ProtocolProxyErrorBody = {
    error: 'JINI_PROTOCOL_PROXY_FAILED',
    message,
    target,
    ...(code == null ? {} : { code }),
  };
  return new Response(JSON.stringify(body), {
    status: 502,
    headers: { 'content-type': 'application/json' },
  });
}

export function buildProtocolProxyTargetUrl(targetBaseUrl: string, requestUrl: string): string {
  const incoming = new URL(requestUrl);
  const target = new URL(targetBaseUrl);
  target.pathname = incoming.pathname;
  target.search = incoming.search;
  target.hash = incoming.hash;
  return target.toString();
}

export type ProtocolFetch = (request: Request) => Promise<Response>;

export async function handleProtocolProxyRequest(
  request: Request,
  targetBaseUrl: string,
  fetchImpl: ProtocolFetch = fetch,
): Promise<Response> {
  const target = buildProtocolProxyTargetUrl(targetBaseUrl, request.url);
  try {
    return await fetchImpl(new Request(target, request));
  } catch (error) {
    return buildProxyErrorResponse(error, target);
  }
}

export interface ProtocolSchemeRegistration {
  scheme: string;
  entryUrl: string;
}

export interface ProtocolHandlerPort {
  registerSchemeProxy(scheme: string, targetBaseUrl: string): ProtocolSchemeRegistration;
}

export function schemeEntryUrl(scheme: string): string {
  return `${scheme}://app/`;
}
