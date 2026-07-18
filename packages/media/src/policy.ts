/**
 * `MediaPolicy` — a host-injected gate on media generation. Generalized from
 * OD's `apps/daemon/src/media/policy.ts`, which is a thin wrapper
 * around `@open-design/contracts`'s `MediaExecutionPolicy`/
 * `mediaExecutionPolicyDenial` (that package is OD-owned and out of scope
 * for this engine package). The underlying evaluation logic itself carries
 * no OD-specific moderation content or thresholds — it is a plain
 * enabled/disabled + surface/model allowlist gate — so it ports as generic
 * data + a pure evaluator, redefined locally rather than imported. A host
 * that needs real content-moderation rules (NSFW classifiers, per-tenant
 * quotas, etc.) implements `MediaPolicy` itself; `createAllowlistMediaPolicy`
 * is the reference implementation proving the port's shape, not a
 * moderation engine.
 */
import type { MediaSurface } from './types.js';

export type MediaExecutionMode = 'enabled' | 'disabled';

export type MediaPolicyDenialCode = 'MEDIA_EXECUTION_DISABLED' | 'MEDIA_SURFACE_DENIED' | 'MEDIA_MODEL_DENIED';

/** What a caller is asking permission to do. */
export interface MediaPolicyTarget {
  readonly surface: MediaSurface;
  readonly model?: string;
}

export interface MediaPolicyDenial {
  readonly code: MediaPolicyDenialCode;
  readonly message: string;
}

/** Declarative shape for `createAllowlistMediaPolicy` — an allowlist gate, not the only possible `MediaPolicy` implementation. */
export interface MediaExecutionPolicy {
  readonly mode: MediaExecutionMode;
  readonly allowedSurfaces?: readonly MediaSurface[];
  readonly allowedModels?: readonly string[];
}

export const DEFAULT_MEDIA_EXECUTION_POLICY: MediaExecutionPolicy = { mode: 'enabled' };

/**
 * Host-injected policy port. `@jini/media` never calls this itself — a
 * caller (a pack's app-service, a tool handler) evaluates a target before
 * dispatching generation and honors a non-null denial.
 */
export interface MediaPolicy {
  evaluate(target: MediaPolicyTarget): MediaPolicyDenial | null;
}

/**
 * Reference `MediaPolicy`: an enabled/disabled + surface/model allowlist
 * gate, ported verbatim from the origin's `mediaExecutionPolicyDenial`. A
 * missing/empty `allowedSurfaces`/`allowedModels` means "no restriction on
 * that dimension" (matches the origin's `Array.isArray(...) && length > 0` guard).
 */
export function createAllowlistMediaPolicy(policy: MediaExecutionPolicy = DEFAULT_MEDIA_EXECUTION_POLICY): MediaPolicy {
  return {
    evaluate(target: MediaPolicyTarget): MediaPolicyDenial | null {
      if (policy.mode === 'disabled') {
        return { code: 'MEDIA_EXECUTION_DISABLED', message: 'media generation is disabled for this run' };
      }
      if (policy.allowedSurfaces && policy.allowedSurfaces.length > 0 && !policy.allowedSurfaces.includes(target.surface)) {
        return { code: 'MEDIA_SURFACE_DENIED', message: `media surface "${target.surface}" is not allowed for this run` };
      }
      if (
        target.model &&
        policy.allowedModels &&
        policy.allowedModels.length > 0 &&
        !policy.allowedModels.includes(target.model)
      ) {
        return { code: 'MEDIA_MODEL_DENIED', message: `media model "${target.model}" is not allowed for this run` };
      }
      return null;
    },
  };
}
