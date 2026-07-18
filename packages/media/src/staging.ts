/**
 * Attachment staging — a generic "temp-store a local file before it's
 * submitted to a remote generation request" port. Generalized from Open
 * Design's `apps/daemon/src/media/amr-image-staging.ts`. Despite the
 * origin's AMR/vela-vendor-specific filename and its narrow "image paths for
 * an agent turn" framing, its actual logic carries zero OD/vendor coupling —
 * root-containment checks, copy-into-a-staging-dir, and TTL-based pruning
 * are all generic filesystem concerns. Ported as a real, testable port +
 * reference implementation (not just an interface) per the task brief,
 * mirroring this package's other port/in-memory-or-fs-reference pairs.
 */
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface AttachmentStagingOptions {
  /** Directory name created under `cwd` to hold staged copies. Defaults to `.media-attachments`. */
  readonly stagingDirName?: string;
  /** Max age (ms) a staged file is retained before opportunistic pruning removes it. Defaults to 24h. */
  readonly maxAgeMs?: number;
}

/**
 * Stages a host-supplied list of local file paths for submission: a path
 * already inside `cwd` is used as-is; a path outside `cwd` (and, when
 * `uploadRoot` is given, outside `uploadRoot`) is copied into a
 * `.media-attachments`-style staging directory under `cwd` with a random
 * prefix, avoiding collisions and leaving the original untouched. Malformed
 * or missing paths are silently skipped — attachments are advisory input,
 * not a validated contract. Opportunistically prunes staged files older
 * than `maxAgeMs` on each call.
 */
export interface AttachmentStaging {
  stage(imagePaths: readonly string[], uploadRoot?: string | null): Promise<string[]>;
}

const DEFAULT_STAGING_DIRNAME = '.media-attachments';
const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function isWithinRoot(root: string, candidate: string): boolean {
  const relativePath = path.relative(root, candidate);
  return relativePath === '' || (relativePath.length > 0 && !relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

async function pruneStagedAttachments(stagingDir: string, maxAgeMs: number): Promise<void> {
  let entries;
  try {
    entries = await fs.promises.readdir(stagingDir, { withFileTypes: true });
  } catch {
    return;
  }
  const cutoff = Date.now() - maxAgeMs;
  await Promise.all(
    entries.map(async (entry) => {
      if (!entry.isFile()) return;
      const filePath = path.join(stagingDir, entry.name);
      try {
        const stat = await fs.promises.stat(filePath);
        if (stat.mtimeMs < cutoff) {
          await fs.promises.rm(filePath, { force: true });
        }
      } catch {
        // Best-effort cleanup only.
      }
    }),
  );
}

/** Creates a filesystem-backed `AttachmentStaging` rooted at `cwd`. */
export function createFsAttachmentStaging(cwd: string, options: AttachmentStagingOptions = {}): AttachmentStaging {
  const stagingDirName = options.stagingDirName ?? DEFAULT_STAGING_DIRNAME;
  const maxAgeMs = options.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
  const root = path.resolve(cwd);
  const stagingDir = path.join(root, stagingDirName);

  return {
    async stage(imagePaths: readonly string[], uploadRoot?: string | null): Promise<string[]> {
      if (!Array.isArray(imagePaths) || imagePaths.length === 0) return [];
      const uploadRootReal = uploadRoot ? await fs.promises.realpath(uploadRoot).catch(() => null) : null;
      await fs.promises.mkdir(stagingDir, { recursive: true });
      await pruneStagedAttachments(stagingDir, maxAgeMs);

      const staged: string[] = [];
      for (const inputPath of imagePaths) {
        if (typeof inputPath !== 'string' || inputPath.trim().length === 0) continue;
        try {
          const resolved = path.resolve(inputPath);
          const real = await fs.promises.realpath(resolved);
          if (uploadRootReal && !isWithinRoot(uploadRootReal, real)) continue;
          const stat = await fs.promises.stat(real);
          if (!stat.isFile()) continue;
          if (isWithinRoot(root, real)) {
            staged.push(real);
            continue;
          }
          const basename = path.basename(real);
          const destination = path.join(stagingDir, `${randomUUID()}-${basename}`);
          await fs.promises.copyFile(real, destination);
          staged.push(destination);
        } catch {
          // Ignore malformed or missing files; attachments are advisory input.
        }
      }
      return staged;
    },
  };
}
