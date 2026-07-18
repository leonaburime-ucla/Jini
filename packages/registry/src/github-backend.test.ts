import type { RegistryManifest } from '@jini/protocol';
import { describe, expect, it } from 'vitest';

import { GithubRegistryBackend, type GithubRegistryClient } from './github-backend.js';

const manifest: RegistryManifest = {
  specVersion: '1.0.0',
  name: 'fixture',
  version: '1.0.0',
  entries: [
    {
      name: 'vendor/example',
      title: 'Example',
      description: 'Searchable fixture entry',
      version: '1.1.0',
      source: 'github:vendor/example@v1.1.0/entry',
      integrity: 'sha256:top',
      manifestDigest: 'sha256:digest',
      capabilitiesSummary: ['prompt:inject'],
    },
  ],
};

describe('GithubRegistryBackend', () => {
  it('reads the manifest at the default path/ref and serves it like a static backend', async () => {
    let readArgs: unknown[] = [];
    const client: GithubRegistryClient = {
      async readManifest(...args) {
        readArgs = args;
        return manifest;
      },
    };
    const backend = await GithubRegistryBackend.create({ id: 'official', owner: 'acme', repo: 'registry', client });
    expect(readArgs).toEqual(['acme', 'registry', 'main', 'registry/index.json']);
    expect(backend.kind).toBe('github');
    expect(backend.trust).toBe('official');
    expect(backend.ref).toBe('main');
    expect(backend.manifestPath).toBe('registry/index.json');
    await expect(backend.resolve('vendor/example')).resolves.toMatchObject({ source: manifest.entries[0]?.source });
  });

  it('honors an explicit ref/manifestPath', async () => {
    const client: GithubRegistryClient = { async readManifest() { return manifest; } };
    const backend = await GithubRegistryBackend.create({
      id: 'official',
      owner: 'acme',
      repo: 'registry',
      ref: 'release',
      manifestPath: 'custom/path.json',
      client,
    });
    expect(backend.ref).toBe('release');
    expect(backend.manifestPath).toBe('custom/path.json');
  });

  it('publish returns a dry-run payload with a warning when the client has no mutation capability', async () => {
    const client: GithubRegistryClient = { async readManifest() { return manifest; } };
    const backend = await GithubRegistryBackend.create({ id: 'official', owner: 'acme', repo: 'registry', client });
    const entry = manifest.entries[0]!;
    const outcome = await backend.publish?.({ entry });
    expect(outcome).toMatchObject({ ok: true, dryRun: true });
    expect(outcome?.warnings).toEqual(['github mutation client unavailable; emitted dry-run payload only']);
    expect(outcome?.changedFiles).toEqual(['entries/vendor/example/entry.json', 'entries/vendor/example/versions/1.1.0.json']);
  });

  it('publish returns a dry-run payload with no warning when request.dryRun is explicit and the client can mutate', async () => {
    const client: GithubRegistryClient = {
      async readManifest() { return manifest; },
      async createPublishPullRequest() { throw new Error('should not be called for a dry run'); },
    };
    const backend = await GithubRegistryBackend.create({ id: 'official', owner: 'acme', repo: 'registry', client });
    const outcome = await backend.publish?.({ entry: manifest.entries[0]!, dryRun: true });
    expect(outcome).toMatchObject({ ok: true, dryRun: true, warnings: [] });
  });

  it('publish opens a PR mutation with deterministic paths and a rendered body (with changelog)', async () => {
    let mutationFiles: string[] = [];
    let mutationBody = '';
    const client: GithubRegistryClient = {
      async readManifest() {
        return manifest;
      },
      async createPublishPullRequest(mutation) {
        mutationFiles = mutation.files.map((file) => file.path);
        mutationBody = mutation.body;
        expect(mutation.branchName).toBe('publish/vendor-example-1.1.0');
        expect(mutation.baseRef).toBe('main');
        return { url: 'https://github.com/acme/registry/pull/1' };
      },
    };
    const backend = await GithubRegistryBackend.create({ id: 'official', owner: 'acme', repo: 'registry', client });
    const outcome = await backend.publish?.({ entry: manifest.entries[0]!, changelog: 'Initial release' });
    expect(outcome).toMatchObject({ ok: true, dryRun: false, pullRequestUrl: 'https://github.com/acme/registry/pull/1' });
    expect(mutationFiles).toEqual(['entries/vendor/example/entry.json', 'entries/vendor/example/versions/1.1.0.json']);
    expect(mutationBody).toContain('Publish vendor/example@1.1.0');
    expect(mutationBody).toContain('- integrity: sha256:top');
    expect(mutationBody).toContain('- manifestDigest: sha256:digest');
    expect(mutationBody).toContain('## Changelog');
    expect(mutationBody).toContain('Initial release');
  });

  it('publish body falls back to dist-level integrity/digest and "(none declared)" capabilities when absent', async () => {
    const bareEntry = { name: 'vendor/bare', version: '1.0.0', source: 's', dist: { integrity: 'sha256:d', manifestDigest: 'sha256:m' } };
    let mutationBody = '';
    const client: GithubRegistryClient = {
      async readManifest() {
        return { ...manifest, entries: [bareEntry] };
      },
      async createPublishPullRequest(mutation) {
        mutationBody = mutation.body;
        return { url: 'https://github.com/acme/registry/pull/2' };
      },
    };
    const backend = await GithubRegistryBackend.create({ id: 'official', owner: 'acme', repo: 'registry', client });
    await backend.publish?.({ entry: bareEntry });
    expect(mutationBody).toContain('- integrity: sha256:d');
    expect(mutationBody).toContain('- manifestDigest: sha256:m');
    expect(mutationBody).toContain('(none declared)');
  });

  it('publish body shows "(pending)" when no integrity/digest is available anywhere', async () => {
    const bareEntry = { name: 'vendor/bare', version: '1.0.0', source: 's' };
    let mutationBody = '';
    const client: GithubRegistryClient = {
      async readManifest() {
        return { ...manifest, entries: [bareEntry] };
      },
      async createPublishPullRequest(mutation) {
        mutationBody = mutation.body;
        return { url: 'https://github.com/acme/registry/pull/3' };
      },
    };
    const backend = await GithubRegistryBackend.create({ id: 'official', owner: 'acme', repo: 'registry', client });
    await backend.publish?.({ entry: bareEntry });
    expect(mutationBody).toContain('- integrity: (pending)');
    expect(mutationBody).toContain('- manifestDigest: (pending)');
  });

  it('yank returns a dry-run outcome with a warning when the client has no mutation capability', async () => {
    const client: GithubRegistryClient = { async readManifest() { return manifest; } };
    const backend = await GithubRegistryBackend.create({ id: 'official', owner: 'acme', repo: 'registry', client });
    const outcome = await backend.yank?.('vendor/example', '1.1.0', 'security issue');
    expect(outcome).toMatchObject({ ok: true, name: 'vendor/example', version: '1.1.0', reason: 'security issue' });
    expect(outcome?.warnings).toEqual(['github mutation client unavailable; emitted dry-run yank only']);
  });

  it('yank opens a PR mutation with a deterministic path and branch name', async () => {
    let mutationPath = '';
    const client: GithubRegistryClient = {
      async readManifest() {
        return manifest;
      },
      async createPublishPullRequest(mutation) {
        mutationPath = mutation.files[0]?.path ?? '';
        expect(mutation.branchName).toBe('yank/vendor-example-1.1.0');
        return { url: 'https://github.com/acme/registry/pull/4' };
      },
    };
    const backend = await GithubRegistryBackend.create({ id: 'official', owner: 'acme', repo: 'registry', client });
    const outcome = await backend.yank?.('vendor/example', '1.1.0', 'security issue');
    expect(mutationPath).toBe('entries/vendor/example/versions/1.1.0.json');
    expect(outcome).toMatchObject({ ok: true, pullRequestUrl: 'https://github.com/acme/registry/pull/4' });
  });
});
