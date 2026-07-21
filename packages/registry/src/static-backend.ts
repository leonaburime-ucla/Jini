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
  RegistryListFilterSchema,
  RegistrySearchQuerySchema,
  type RegistryBackend,
  type RegistryBackendKind,
  type RegistryDoctorReport,
  type RegistryEntry,
  type RegistryListFilter,
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

  async list(filter?: RegistryListFilter): Promise<RegistryEntry[]> {
    const parsedFilter = RegistryListFilterSchema.parse(filter);
    let entries = validEntries(this.getManifest());

    if (!parsedFilter?.includeYanked) {
      entries = entries.filter((entry) => !entry.yanked);
    }

    if (parsedFilter?.publisher) {
      const publisher = parsedFilter.publisher.toLowerCase();
      entries = entries.filter(
        (entry) => entry.publisher?.id?.toLowerCase() === publisher || entry.publisher?.github?.toLowerCase() === publisher,
      );
    }

    if (parsedFilter?.tags && parsedFilter.tags.length > 0) {
      const tags = parsedFilter.tags.map((tag) => tag.toLowerCase());
      entries = entries.filter((entry) => {
        const entryTags = new Set((entry.tags ?? []).map((tag) => tag.toLowerCase()));
        return tags.every((tag) => entryTags.has(tag));
      });
    }

    if (parsedFilter?.query) {
      const terms = parsedFilter.query.toLowerCase().split(/\s+/g).filter(Boolean);
      if (terms.length > 0) {
        entries = entries.filter((entry) => terms.some((term) => searchHaystack(entry).includes(term)));
      }
    }

    return entries;
  }

  async search(input: RegistrySearchQuery): Promise<RegistrySearchResult[]> {
    const query = RegistrySearchQuerySchema.parse(input);
    const terms = query.query.toLowerCase().split(/\s+/g).filter(Boolean);
    const tags = new Set((query.tags ?? []).map((tag) => tag.toLowerCase()));
    // Pass `includeYanked` through to `list` so search honors the same
    // filter contract instead of unconditionally dropping yanked entries.
    const entries = await this.list({ includeYanked: query.includeYanked });
    const results: RegistrySearchResult[] = [];
    for (const entry of entries) {
      if (tags.size > 0) {
        const entryTags = new Set((entry.tags ?? []).map((tag) => tag.toLowerCase()));
        if (![...tags].every((tag) => entryTags.has(tag))) continue;
      }
      const haystack = searchHaystack(entry);
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
    // Because these are RAW/unvalidated entries (a caller can hand a
    // manifest object that never went through `RegistryManifestSchema`),
    // every field is guarded before it is dereferenced — a value that isn't
    // even a plausible object (null/array/primitive) is reported as
    // malformed instead of throwing out of `doctor()` itself.
    const entries = this.getManifest().entries;
    for (const raw of entries) {
      const value = raw as unknown;
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        issues.push({
          severity: 'error',
          code: 'malformed-entry',
          message: 'Registry entry is not a valid object and could not be checked.',
        });
        continue;
      }
      const candidate = value as Partial<RegistryEntry>;
      const name = typeof candidate.name === 'string' ? candidate.name : undefined;
      if (!name || !/^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/.test(name)) {
        issues.push({
          severity: 'error',
          code: 'invalid-name',
          message: 'Registry entry name must be vendor/name.',
          pluginName: name,
        });
      }
      const dist = candidate.dist && typeof candidate.dist === 'object' ? candidate.dist : undefined;
      if (!candidate.source && !dist?.archive) {
        issues.push({
          severity: 'error',
          code: 'missing-source',
          message: 'Registry entry must provide source or dist.archive.',
          pluginName: name,
        });
      }
      if (!candidate.license) {
        issues.push({
          severity: 'warning',
          code: 'missing-license',
          message: 'Registry entry should declare a license.',
          pluginName: name,
        });
      }
      const capabilitiesSummary = Array.isArray(candidate.capabilitiesSummary) ? candidate.capabilitiesSummary : undefined;
      if (!capabilitiesSummary || capabilitiesSummary.length === 0) {
        issues.push({
          severity: 'warning',
          code: 'missing-capabilities',
          message: 'Registry entry should summarize its capabilities.',
          pluginName: name,
        });
      }
      if (candidate.yanked && !candidate.yankReason) {
        issues.push({
          severity: 'error',
          code: 'missing-yank-reason',
          message: 'Yanked entries must keep a human-readable reason.',
          pluginName: name,
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

/** @internal The lowercase, space-joined text `list`/`search` match query terms against. */
function searchHaystack(entry: RegistryEntry): string {
  return [
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
}
