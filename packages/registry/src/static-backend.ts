/**
 * @module static-backend
 *
 * A read-mostly `RegistryBackend` over an in-memory {@link RegistryManifest}:
 * list/search/resolve/doctor computed directly from `manifest.entries`, no
 * publish/yank support. The base class every other backend in this package
 * extends — `github-backend` overrides `getManifest()`'s source and adds
 * publish/yank over a GitHub PR mutation; `database-backend` overrides
 * `getManifest()` to read from sqlite and adds publish/yank as direct writes.
 */
import {
  RegistryEntrySchema,
  RegistrySearchQuerySchema,
  type RegistryBackend,
  type RegistryBackendKind,
  type RegistryDoctorReport,
  type RegistryEntry,
  type RegistryManifest,
  type RegistrySearchQuery,
  type RegistrySearchResult,
  type RegistryTrust,
  type ResolvedRegistryEntry,
} from '@jini/protocol';
import { parseRegistrySpecifier, resolveRegistryEntryVersion } from './versioning.js';

export interface StaticRegistryBackendOptions {
  id: string;
  kind?: RegistryBackendKind;
  trust: RegistryTrust;
  manifest: RegistryManifest;
}

export class StaticRegistryBackend implements RegistryBackend {
  readonly id: string;
  readonly kind: RegistryBackendKind;
  readonly trust: RegistryTrust;

  protected readonly manifestData: RegistryManifest;

  constructor(options: StaticRegistryBackendOptions) {
    this.id = options.id;
    this.kind = options.kind ?? 'http';
    this.trust = options.trust;
    this.manifestData = options.manifest;
  }

  async list(): Promise<RegistryEntry[]> {
    return validEntries(this.getManifest()).filter((entry) => !entry.yanked);
  }

  async search(input: RegistrySearchQuery): Promise<RegistrySearchResult[]> {
    const query = RegistrySearchQuerySchema.parse(input);
    const terms = query.query.toLowerCase().split(/\s+/g).filter(Boolean);
    const tags = new Set((query.tags ?? []).map((tag) => tag.toLowerCase()));
    const entries = await this.list();
    const results: RegistrySearchResult[] = [];
    for (const entry of entries) {
      if (tags.size > 0) {
        const entryTags = new Set((entry.tags ?? []).map((tag) => tag.toLowerCase()));
        if (![...tags].every((tag) => entryTags.has(tag))) continue;
      }
      const haystack = [
        entry.name,
        entry.title ?? '',
        entry.description ?? '',
        ...(entry.tags ?? []),
        ...(entry.capabilitiesSummary ?? []),
        entry.publisher?.id ?? '',
        entry.publisher?.github ?? '',
      ]
        .join(' ')
        .toLowerCase();
      const matched = terms.filter((term) => haystack.includes(term));
      if (terms.length > 0 && matched.length === 0) continue;
      results.push({
        entry,
        score: terms.length === 0 ? 0 : matched.length / terms.length,
        matched,
      });
    }
    return results
      .sort((left, right) => right.score - left.score || left.entry.name.localeCompare(right.entry.name))
      .slice(0, query.limit ?? 100);
  }

  async resolve(name: string, range?: string): Promise<ResolvedRegistryEntry | null> {
    const parsed = parseRegistrySpecifier(range ? `${name}@${range}` : name);
    const entry = validEntries(this.getManifest()).find(
      (candidate) => candidate.name.toLowerCase() === parsed.name.toLowerCase(),
    );
    if (!entry) return null;
    const resolvedVersion = resolveRegistryEntryVersion(entry, parsed.range);
    if (!resolvedVersion) return null;
    return {
      backendId: this.id,
      backendKind: this.kind,
      trust: this.trust,
      entry,
      version: {
        version: resolvedVersion.version,
        source: resolvedVersion.source,
        ref: resolvedVersion.ref,
        integrity: resolvedVersion.archiveIntegrity,
        manifestDigest: resolvedVersion.manifestDigest,
        deprecated: resolvedVersion.deprecated,
      },
      source: resolvedVersion.source,
      ref: resolvedVersion.ref,
      integrity: resolvedVersion.archiveIntegrity,
      manifestDigest: resolvedVersion.manifestDigest,
    };
  }

  async manifest(name: string, version: string): Promise<RegistryEntry | null> {
    const resolved = await this.resolve(name, version);
    return resolved?.entry ?? null;
  }

  async doctor(): Promise<RegistryDoctorReport> {
    const issues: RegistryDoctorReport['issues'] = [];
    // Deliberately audits the RAW manifest entries (not the `validEntries()`
    // schema-filtered set `list`/`search`/`resolve` use) — doctor's whole
    // purpose is to surface malformed data, so silently dropping a bad entry
    // before doctor sees it would hide exactly the issue it exists to report.
    const entries = this.getManifest().entries;
    for (const entry of entries) {
      if (!/^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/.test(entry.name)) {
        issues.push({
          severity: 'error',
          code: 'invalid-name',
          message: 'Registry entry name must be vendor/name.',
          pluginName: entry.name,
        });
      }
      if (!entry.source && !entry.dist?.archive) {
        issues.push({
          severity: 'error',
          code: 'missing-source',
          message: 'Registry entry must provide source or dist.archive.',
          pluginName: entry.name,
        });
      }
      if (!entry.license) {
        issues.push({
          severity: 'warning',
          code: 'missing-license',
          message: 'Registry entry should declare a license.',
          pluginName: entry.name,
        });
      }
      if (!entry.capabilitiesSummary || entry.capabilitiesSummary.length === 0) {
        issues.push({
          severity: 'warning',
          code: 'missing-capabilities',
          message: 'Registry entry should summarize its capabilities.',
          pluginName: entry.name,
        });
      }
      if (entry.yanked && !entry.yankReason) {
        issues.push({
          severity: 'error',
          code: 'missing-yank-reason',
          message: 'Yanked entries must keep a human-readable reason.',
          pluginName: entry.name,
        });
      }
    }
    return {
      ok: !issues.some((issue) => issue.severity === 'error'),
      backendId: this.id,
      checkedAt: Date.now(),
      entriesChecked: entries.length,
      issues,
    };
  }

  protected getManifest(): RegistryManifest {
    return this.manifestData;
  }
}

/** @internal Drop any manifest entry that fails the wire schema rather than let a malformed entry propagate. */
function validEntries(manifest: RegistryManifest): RegistryEntry[] {
  return manifest.entries.flatMap((entry) => {
    const parsed = RegistryEntrySchema.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  });
}
