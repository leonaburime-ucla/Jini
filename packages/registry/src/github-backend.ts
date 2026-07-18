/**
 * @module github-backend
 *
 * A `RegistryBackend` whose manifest lives in a GitHub repository. Reads the
 * whole manifest once (via an injected {@link GithubRegistryClient}) and
 * serves `list`/`search`/`resolve`/`doctor` from that in-memory snapshot
 * exactly like `StaticRegistryBackend`; `publish`/`yank` open a pull request
 * against the same repo (or return a dry-run payload when the client has no
 * mutation capability configured).
 */
import type {
  RegistryManifest,
  RegistryPublishOutcome,
  RegistryPublishRequest,
  RegistryYankOutcome,
} from '@jini/protocol';
import { StaticRegistryBackend } from './static-backend.js';

/** Read/write access to a GitHub-hosted registry manifest, injected by the host. */
export interface GithubRegistryClient {
  readManifest(owner: string, repo: string, ref: string, path: string): Promise<RegistryManifest>;
  createPublishPullRequest?(request: GithubPublishMutation): Promise<{ url: string }>;
}

export interface GithubPublishMutation {
  owner: string;
  repo: string;
  baseRef: string;
  branchName: string;
  title: string;
  body: string;
  files: Array<{ path: string; content: string }>;
}

export interface GithubRegistryBackendOptions {
  id: string;
  owner: string;
  repo: string;
  ref?: string;
  manifestPath?: string;
  client: GithubRegistryClient;
}

const DEFAULT_MANIFEST_PATH = 'registry/index.json';

export class GithubRegistryBackend extends StaticRegistryBackend {
  readonly owner: string;
  readonly repo: string;
  readonly ref: string;
  readonly manifestPath: string;
  readonly client: GithubRegistryClient;

  // `ref`/`manifestPath` are required (not `?:`) here — the only call site,
  // `create()`, always resolves them to concrete strings before constructing,
  // so a `??` default in this constructor would be unreachable dead code.
  private constructor(options: Omit<GithubRegistryBackendOptions, 'ref' | 'manifestPath'> & {
    ref: string;
    manifestPath: string;
    manifest: RegistryManifest;
  }) {
    super({ id: options.id, kind: 'github', trust: 'official', manifest: options.manifest });
    this.owner = options.owner;
    this.repo = options.repo;
    this.ref = options.ref;
    this.manifestPath = options.manifestPath;
    this.client = options.client;
  }

  /**
   * Read the manifest from the configured GitHub path and construct the backend.
   *
   * @param options - Repo coordinates, optional ref/path, and the client to read/write through.
   * @returns The constructed backend, already holding its first manifest snapshot.
   */
  static async create(options: GithubRegistryBackendOptions): Promise<GithubRegistryBackend> {
    const ref = options.ref ?? 'main';
    const manifestPath = options.manifestPath ?? DEFAULT_MANIFEST_PATH;
    const manifest = await options.client.readManifest(options.owner, options.repo, ref, manifestPath);
    return new GithubRegistryBackend({ ...options, ref, manifestPath, manifest });
  }

  async publish(request: RegistryPublishRequest): Promise<RegistryPublishOutcome> {
    const [vendor, name] = request.entry.name.split('/');
    const version = request.entry.version;
    const root = `entries/${vendor}/${name}`;
    const files = [
      { path: `${root}/entry.json`, content: `${JSON.stringify(request.entry, null, 2)}\n` },
      {
        path: `${root}/versions/${version}.json`,
        content: `${JSON.stringify({ ...request.entry, publishedAt: new Date().toISOString(), tag: request.tag ?? 'latest' }, null, 2)}\n`,
      },
    ];

    if (request.dryRun || !this.client.createPublishPullRequest) {
      return {
        ok: true,
        dryRun: true,
        changedFiles: files.map((file) => file.path),
        warnings: this.client.createPublishPullRequest ? [] : ['github mutation client unavailable; emitted dry-run payload only'],
      };
    }

    const mutation: GithubPublishMutation = {
      owner: this.owner,
      repo: this.repo,
      baseRef: this.ref,
      branchName: `publish/${vendor}-${name}-${version}`,
      title: `Add ${request.entry.name}@${version}`,
      body: renderPublishBody(request),
      files,
    };
    const pr = await this.client.createPublishPullRequest(mutation);
    return { ok: true, dryRun: false, pullRequestUrl: pr.url, changedFiles: files.map((file) => file.path), warnings: [] };
  }

  async yank(name: string, version: string, reason: string): Promise<RegistryYankOutcome> {
    const [vendor, entryName] = name.split('/');
    const path = `entries/${vendor}/${entryName}/versions/${version}.json`;
    if (!this.client.createPublishPullRequest) {
      return { ok: true, name, version, reason, warnings: ['github mutation client unavailable; emitted dry-run yank only'] };
    }
    const mutation: GithubPublishMutation = {
      owner: this.owner,
      repo: this.repo,
      baseRef: this.ref,
      branchName: `yank/${vendor}-${entryName}-${version}`,
      title: `Yank ${name}@${version}`,
      body: `Yank ${name}@${version}\n\nReason: ${reason}\n`,
      files: [
        {
          path,
          content: `${JSON.stringify({ name, version, yanked: true, yankedAt: new Date().toISOString(), yankReason: reason }, null, 2)}\n`,
        },
      ],
    };
    const pr = await this.client.createPublishPullRequest(mutation);
    return { ok: true, name, version, reason, pullRequestUrl: pr.url, warnings: [] };
  }
}

function renderPublishBody(request: RegistryPublishRequest): string {
  return [
    `Publish ${request.entry.name}@${request.entry.version}`,
    '',
    request.entry.description ?? '',
    '',
    '## Registry metadata',
    '',
    `- source: ${request.entry.source}`,
    `- integrity: ${request.entry.integrity ?? request.entry.dist?.integrity ?? '(pending)'}`,
    `- manifestDigest: ${request.entry.manifestDigest ?? request.entry.dist?.manifestDigest ?? '(pending)'}`,
    `- capabilities: ${(request.entry.capabilitiesSummary ?? []).join(', ') || '(none declared)'}`,
    request.changelog ? `\n## Changelog\n\n${request.changelog}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
