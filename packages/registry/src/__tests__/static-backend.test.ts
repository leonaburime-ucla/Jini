import type { RegistryManifest } from '@jini/protocol';
import { describe, expect, it } from 'vitest';

import { StaticRegistryBackend } from '../static-backend.js';

function manifestOf(entries: RegistryManifest['entries']): RegistryManifest {
  return { specVersion: '1.0.0', name: 'fixture', version: '1.0.0', entries };
}

const exampleEntry = {
  name: 'vendor/example',
  title: 'Example',
  description: 'Searchable fixture entry',
  version: '1.1.0',
  source: 'github:vendor/example@v1.1.0/entry',
  versions: [
    { version: '1.0.0', source: 'github:vendor/example@v1.0.0/entry', integrity: 'sha256:old' },
    { version: '1.1.0', source: 'github:vendor/example@v1.1.0/entry', integrity: 'sha256:new' },
  ],
  distTags: { latest: '1.1.0' },
  license: 'MIT',
  capabilitiesSummary: ['prompt:inject'],
  tags: ['fixture'],
  publisher: { id: 'vendor', github: 'vendor-gh' },
};

describe('StaticRegistryBackend', () => {
  it('defaults kind to http when unspecified', () => {
    const backend = new StaticRegistryBackend({ id: 'fixture', trust: 'trusted', manifest: manifestOf([]) });
    expect(backend.kind).toBe('http');
  });

  it('lists non-yanked entries and drops malformed ones', async () => {
    const backend = new StaticRegistryBackend({
      id: 'fixture',
      trust: 'trusted',
      manifest: manifestOf([
        exampleEntry,
        { ...exampleEntry, name: 'vendor/yanked', yanked: true },
        { name: 'no-slash-invalid' } as never,
      ]),
    });
    const list = await backend.list();
    expect(list.map((e) => e.name)).toEqual(['vendor/example']);
  });

  it('resolves exact versions and dist-tags from the manifest', async () => {
    const backend = new StaticRegistryBackend({ id: 'fixture', trust: 'trusted', manifest: manifestOf([exampleEntry]) });
    await expect(backend.resolve('vendor/example')).resolves.toMatchObject({
      source: 'github:vendor/example@v1.1.0/entry',
      integrity: 'sha256:new',
    });
    await expect(backend.resolve('vendor/example@1.0.0')).resolves.toMatchObject({
      source: 'github:vendor/example@v1.0.0/entry',
      integrity: 'sha256:old',
    });
    await expect(backend.manifest('vendor/example', '1.0.0')).resolves.toMatchObject({ name: 'vendor/example' });
  });

  it('resolve returns null for an unknown name or an unsatisfiable range', async () => {
    const backend = new StaticRegistryBackend({ id: 'fixture', trust: 'trusted', manifest: manifestOf([exampleEntry]) });
    await expect(backend.resolve('vendor/missing')).resolves.toBeNull();
    await expect(backend.resolve('vendor/example', '^9.0.0')).resolves.toBeNull();
    await expect(backend.manifest('vendor/missing', '1.0.0')).resolves.toBeNull();
  });

  it('search matches by name/title/description/tags/capabilities/publisher, filters by tag, and sorts by score then name', async () => {
    const backend = new StaticRegistryBackend({
      id: 'fixture',
      trust: 'trusted',
      manifest: manifestOf([
        exampleEntry,
        { ...exampleEntry, name: 'vendor/aaa-tagged-only', description: '', title: '', tags: ['fixture'], capabilitiesSummary: [] },
      ]),
    });
    const results = await backend.search({ query: 'Searchable', tags: ['fixture'] });
    expect(results).toHaveLength(1);
    expect(results[0]?.entry.name).toBe('vendor/example');

    const allTagged = await backend.search({ query: '' });
    expect(allTagged.map((r) => r.entry.name)).toEqual(['vendor/aaa-tagged-only', 'vendor/example']);
    expect(allTagged[0]?.score).toBe(0);
  });

  it('search filters out entries missing a required tag (including one with no tags field at all) and respects the limit', async () => {
    const backend = new StaticRegistryBackend({
      id: 'fixture',
      trust: 'trusted',
      manifest: manifestOf([
        exampleEntry,
        { ...exampleEntry, name: 'vendor/other', tags: ['other'] },
        { name: 'vendor/bare', version: '1.0.0', source: 's' },
      ]),
    });
    await expect(backend.search({ query: '', tags: ['fixture'] })).resolves.toHaveLength(1);
    await expect(backend.search({ query: '', limit: 1 })).resolves.toHaveLength(1);
  });

  it('search matches a bare entry with no title/description via its name alone', async () => {
    const backend = new StaticRegistryBackend({
      id: 'fixture',
      trust: 'trusted',
      manifest: manifestOf([{ name: 'vendor/bare', version: '1.0.0', source: 's' }]),
    });
    await expect(backend.search({ query: 'bare' })).resolves.toHaveLength(1);
  });

  it('search excludes entries whose text does not contain every query term', async () => {
    const backend = new StaticRegistryBackend({ id: 'fixture', trust: 'trusted', manifest: manifestOf([exampleEntry]) });
    await expect(backend.search({ query: 'no-such-term-anywhere' })).resolves.toEqual([]);
  });

  describe('doctor', () => {
    it('reports ok with no issues for a well-formed entry', async () => {
      const backend = new StaticRegistryBackend({ id: 'fixture', trust: 'trusted', manifest: manifestOf([exampleEntry]) });
      const report = await backend.doctor();
      expect(report).toMatchObject({ ok: true, backendId: 'fixture', entriesChecked: 1, issues: [] });
    });

    it('flags an invalid name', async () => {
      const backend = new StaticRegistryBackend({
        id: 'fixture',
        trust: 'trusted',
        manifest: { specVersion: '1.0.0', name: 'fixture', version: '1.0.0', entries: [{ ...exampleEntry, name: 'bad name', source: 'x' }] },
      });
      const report = await backend.doctor();
      expect(report.ok).toBe(false);
      expect(report.issues).toContainEqual(expect.objectContaining({ code: 'invalid-name' }));
    });

    it('flags a missing source when dist.archive is also absent', async () => {
      const backend = new StaticRegistryBackend({
        id: 'fixture',
        trust: 'trusted',
        manifest: manifestOf([{ name: 'vendor/example', source: '', version: '1.0.0' }]),
      });
      const report = await backend.doctor();
      expect(report.issues).toContainEqual(expect.objectContaining({ code: 'missing-source' }));
    });

    it('does not flag missing-source when dist.archive is present', async () => {
      const backend = new StaticRegistryBackend({
        id: 'fixture',
        trust: 'trusted',
        manifest: manifestOf([{ name: 'vendor/example', source: '', version: '1.0.0', dist: { archive: 'a.tar.gz' } }]),
      });
      const report = await backend.doctor();
      expect(report.issues.some((i) => i.code === 'missing-source')).toBe(false);
    });

    it('flags missing license and missing capabilities as warnings without failing ok', async () => {
      const backend = new StaticRegistryBackend({
        id: 'fixture',
        trust: 'trusted',
        manifest: manifestOf([{ name: 'vendor/example', source: 's', version: '1.0.0' }]),
      });
      const report = await backend.doctor();
      expect(report.ok).toBe(true);
      expect(report.issues).toContainEqual(expect.objectContaining({ code: 'missing-license', severity: 'warning' }));
      expect(report.issues).toContainEqual(expect.objectContaining({ code: 'missing-capabilities', severity: 'warning' }));
    });

    it('flags a yanked entry with no yank reason', async () => {
      const backend = new StaticRegistryBackend({
        id: 'fixture',
        trust: 'trusted',
        manifest: {
          specVersion: '1.0.0',
          name: 'fixture',
          version: '1.0.0',
          entries: [{ ...exampleEntry, yanked: true, yankReason: undefined }],
        },
      });
      const report = await backend.doctor();
      expect(report.ok).toBe(false);
      expect(report.issues).toContainEqual(expect.objectContaining({ code: 'missing-yank-reason' }));
    });
  });
});
