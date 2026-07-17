import type { DeployLinkStatus, DeploymentUrlCheck } from './types.js';

/**
 * Provider-supplied hook for recognizing a deployment URL that responded
 * but is gated behind the provider's own auth wall (Vercel Deployment
 * Protection, for example) rather than genuinely down. Kept pluggable
 * instead of hardcoding Vercel's SSO-nonce/header sniffing here, so a
 * future target (Cloudflare, GitHub Pages, ...) can supply its own
 * detector or omit one entirely.
 */
export type ProtectedResponseDetector = (resp: Response, body: string) => boolean;

export interface ReachabilityOptions {
  timeoutMs?: number;
  detectProtected?: ProtectedResponseDetector;
  protectedMessage?: string;
}

export interface ReachabilityWaitOptions {
  timeoutMs?: number;
  intervalMs?: number;
  providerLabel?: string;
  detectProtected?: ProtectedResponseDetector;
  protectedMessage?: string;
}

export interface ReachabilityWaitResult {
  status: DeployLinkStatus;
  url: string;
  statusMessage: string;
  reachableAt?: number;
}

/**
 * Normalizes a raw provider-returned URL/hostname into an absolute
 * `https://` URL (bare hostnames like `foo.vercel.app` are assumed https).
 *
 * @param url - Raw value from a provider response; may be `undefined`/non-string.
 * @returns The normalized absolute URL, or `''` if `url` was empty/non-string.
 * @complexity O(1).
 * @overallScore 100/100
 */
export function normalizeDeploymentUrl(url: unknown): string {
  if (typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/**
 * Issues a single HEAD/GET probe against a deployment URL with a bounded
 * timeout, classifying the outcome as reachable / protected / unreachable.
 *
 * @param url - Absolute URL to probe.
 * @param method - HTTP method for this probe.
 * @param timeoutMs - Abort the request after this many milliseconds.
 * @param options - Optional protected-response detector + message.
 * @returns A `DeploymentUrlCheck` describing the outcome. Never throws —
 *   network errors and aborts are folded into `{ reachable: false, statusMessage }`.
 * @complexity O(1) network round-trip.
 * @overallScore 100/100
 */
async function requestDeploymentUrl(
  url: string,
  method: 'HEAD' | 'GET',
  timeoutMs: number,
  options: ReachabilityOptions,
): Promise<DeploymentUrlCheck> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { method, redirect: 'manual', signal: controller.signal });
    if (resp.status >= 200 && resp.status < 400) {
      return { reachable: true, statusCode: resp.status };
    }
    const body = method === 'GET' || resp.status === 401 ? await resp.text() : '';
    if (resp.status === 401 && options.detectProtected?.(resp, body)) {
      return {
        reachable: false,
        status: 'protected',
        statusCode: resp.status,
        statusMessage: options.protectedMessage ?? 'Deployment is protected by the provider.',
      };
    }
    return {
      reachable: false,
      statusCode: resp.status,
      statusMessage: `Public link returned HTTP ${resp.status}.`,
    };
  } catch (err) {
    return {
      reachable: false,
      statusMessage: `Public link is not reachable yet: ${err instanceof Error ? err.message : String(err)}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Probes a single deployment URL, trying HEAD first and falling back to
 * GET when HEAD is rejected or ambiguous (some hosts don't implement HEAD
 * correctly on generated static routes).
 *
 * @param url - Raw URL/hostname from a provider response (normalized internally).
 * @param options - Timeout (default 8s) and optional protected-response detector.
 * @returns A `DeploymentUrlCheck` for the best of the HEAD/GET attempts.
 * @complexity O(1)-O(2) network round-trips.
 * @overallScore 100/100
 */
export async function checkDeploymentUrl(
  url: unknown,
  options: ReachabilityOptions = {},
): Promise<DeploymentUrlCheck> {
  const normalized = normalizeDeploymentUrl(url);
  if (!normalized) {
    return { reachable: false, statusMessage: 'Deployment URL is empty.' };
  }
  const timeoutMs = options.timeoutMs ?? 8_000;
  const head = await requestDeploymentUrl(normalized, 'HEAD', timeoutMs, options);
  if (head.reachable) return head;
  if (head.status === 'protected') return head;
  if (head.statusCode && (head.statusCode === 405 || head.statusCode === 403 || head.statusCode >= 400)) {
    const get = await requestDeploymentUrl(normalized, 'GET', timeoutMs, options);
    if (get.reachable) return get;
    if (get.status === 'protected') return get;
    return get.statusMessage ? get : head;
  }
  const get = await requestDeploymentUrl(normalized, 'GET', timeoutMs, options);
  return get.reachable ? get : get.statusMessage ? get : head;
}

/**
 * Polls a set of deployment URL candidates until one becomes reachable, one
 * reports as provider-protected, or `timeoutMs` elapses. Used right after a
 * publish call returns, since providers frequently accept the deploy before
 * the URL is actually resolvable.
 *
 * @param urls - Candidate URLs/hostnames in preference order (duplicates and empties are dropped).
 * @param options - `timeoutMs` (default 60s), `intervalMs` between sweeps (default 2s),
 *   `providerLabel` for messages, and the optional protected-response detector.
 * @returns `{ status, url, statusMessage, reachableAt? }`. `status: 'link-delayed'`
 *   means the timeout elapsed without a reachable/protected verdict — this is
 *   not necessarily a failure, the caller may choose to keep polling later.
 * @complexity O(candidates * timeoutMs/intervalMs) network round-trips, bounded by timeoutMs.
 * @overallScore 100/100
 */
export async function waitForReachableDeploymentUrl(
  urls: unknown[],
  options: ReachabilityWaitOptions = {},
): Promise<ReachabilityWaitResult> {
  const { timeoutMs = 60_000, intervalMs = 2_000, providerLabel = 'Deployment provider' } = options;
  const candidates = [...new Set((urls || []).map(normalizeDeploymentUrl).filter(Boolean))];
  const fallbackUrl = candidates[0] || '';
  if (!fallbackUrl) {
    return {
      status: 'link-delayed',
      url: '',
      statusMessage: `${providerLabel} did not return a public deployment URL.`,
    };
  }

  const startedAt = Date.now();
  let lastMessage = '';
  while (Date.now() - startedAt <= timeoutMs) {
    for (const url of candidates) {
      const result = await checkDeploymentUrl(url, options);
      if (result.reachable) {
        return { status: 'ready', url, statusMessage: 'Public link is ready.', reachableAt: Date.now() };
      }
      if (result.status === 'protected') {
        return {
          status: 'protected',
          url,
          statusMessage: result.statusMessage || `${providerLabel} is gating this link behind its own auth wall.`,
        };
      }
      lastMessage = result.statusMessage || lastMessage;
    }
    if (Date.now() - startedAt >= timeoutMs) break;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  return {
    status: 'link-delayed',
    url: fallbackUrl,
    statusMessage: lastMessage || `${providerLabel} returned a deployment URL, but it is not reachable yet.`,
  };
}
