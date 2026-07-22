import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  inferMcpAuthModeForUrl,
  sanitizeMcpServer,
  sanitizeMcpConfig,
  readMcpConfig,
  writeMcpConfig,
  isManagedProjectCwd,
  buildClaudeMcpJson,
  buildAcpMcpServers,
  buildOpenCodeMcpConfigContent,
  type McpServerConfig,
} from '../index.js';

const tmpDirs: string[] = [];
function tmp(): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'jini-mcp-cfg-'));
  tmpDirs.push(d);
  return d;
}
afterEach(() => {
  for (const d of tmpDirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

describe('inferMcpAuthModeForUrl / loopback detection', () => {
  it('returns oauth when the url is absent', () => {
    expect(inferMcpAuthModeForUrl(undefined)).toBe('oauth');
  });
  it('treats loopback targets as none', () => {
    expect(inferMcpAuthModeForUrl('http://localhost:3000')).toBe('none');
    expect(inferMcpAuthModeForUrl('http://127.0.0.1:8080')).toBe('none');
    expect(inferMcpAuthModeForUrl('http://[::1]:8080')).toBe('none');
  });
  it('treats remote hosts as oauth', () => {
    expect(inferMcpAuthModeForUrl('https://mcp.example.com')).toBe('oauth');
  });
  it('falls back to oauth on an unparseable url', () => {
    expect(inferMcpAuthModeForUrl('::: not a url')).toBe('oauth');
  });
});

describe('sanitizeMcpServer', () => {
  it('rejects non-objects and bad ids', () => {
    expect(sanitizeMcpServer(null)).toBeNull();
    expect(sanitizeMcpServer({ id: 'has space', transport: 'stdio', command: 'x' })).toBeNull();
    expect(sanitizeMcpServer({ transport: 'stdio', command: 'x' })).toBeNull();
  });
  it('rejects an invalid transport', () => {
    expect(sanitizeMcpServer({ id: 'a', transport: 'carrier-pigeon', command: 'x' })).toBeNull();
  });
  it('defaults transport to stdio and enabled to true, keeps a trimmed label', () => {
    const s = sanitizeMcpServer({ id: 'a', command: 'node', label: '  My Server  ' });
    expect(s).toMatchObject({ id: 'a', transport: 'stdio', enabled: true, command: 'node', label: 'My Server' });
  });
  it('honors enabled:false and drops an empty label', () => {
    const s = sanitizeMcpServer({ id: 'a', command: 'node', enabled: false, label: '   ' });
    expect(s?.enabled).toBe(false);
    expect(s).not.toHaveProperty('label');
  });
  it('requires a command for stdio', () => {
    expect(sanitizeMcpServer({ id: 'a', transport: 'stdio' })).toBeNull();
    expect(sanitizeMcpServer({ id: 'a', transport: 'stdio', command: '   ' })).toBeNull();
  });
  it('keeps sanitized args and env, dropping junk', () => {
    const raw = JSON.parse(
      '{"id":"a","command":"node","args":["--x","--y"],"env":{"A":"1","":"skip","B":123,"C":"","D":"  ","__proto__":"p","constructor":"c"}}',
    );
    const s = sanitizeMcpServer(raw);
    expect(s?.args).toEqual(['--x', '--y']);
    expect(s?.env).toEqual({ A: '1' });
  });
  it('drops non-array args and all-junk env/args (undefined)', () => {
    const s = sanitizeMcpServer({ id: 'a', command: 'node', args: 'nope', env: { B: 123 } });
    expect(s).not.toHaveProperty('args');
    expect(s).not.toHaveProperty('env');
    const s2 = sanitizeMcpServer({ id: 'a', command: 'node', args: [1, 2] });
    expect(s2).not.toHaveProperty('args');
  });
  it('requires a valid http(s) url for remote transports', () => {
    expect(sanitizeMcpServer({ id: 'a', transport: 'http' })).toBeNull();
    expect(sanitizeMcpServer({ id: 'a', transport: 'http', url: '   ' })).toBeNull();
    expect(sanitizeMcpServer({ id: 'a', transport: 'http', url: 'not a url' })).toBeNull();
    expect(sanitizeMcpServer({ id: 'a', transport: 'http', url: 'ftp://example.com' })).toBeNull();
  });
  it('accepts a remote server, infers auth mode, and keeps headers', () => {
    const s = sanitizeMcpServer({
      id: 'remote',
      transport: 'http',
      url: 'https://mcp.example.com/mcp',
      headers: { Authorization: 'Bearer x' },
    });
    expect(s?.transport).toBe('http');
    expect(s?.authMode).toBe('oauth');
    expect(s?.headers).toEqual({ Authorization: 'Bearer x' });
  });
  it('honors an explicit valid authMode and ignores an invalid one', () => {
    const none = sanitizeMcpServer({ id: 'r', transport: 'sse', url: 'https://x.example.com', authMode: 'none' });
    expect(none?.authMode).toBe('none');
    const bogus = sanitizeMcpServer({ id: 'r', transport: 'sse', url: 'https://x.example.com', authMode: 'bogus' });
    expect(bogus?.authMode).toBe('oauth');
  });
});

describe('sanitizeMcpConfig', () => {
  it('returns empty for non-objects and non-array servers', () => {
    expect(sanitizeMcpConfig(42)).toEqual({ servers: [] });
    expect(sanitizeMcpConfig({ servers: 'nope' })).toEqual({ servers: [] });
  });
  it('drops invalid entries and de-dupes by id (first wins)', () => {
    const cfg = sanitizeMcpConfig({
      servers: [
        { id: 'a', command: 'node' },
        { id: 'bad' }, // no command
        { id: 'a', command: 'other' }, // dupe id dropped
        { id: 'b', command: 'deno' },
      ],
    });
    expect(cfg.servers.map((s) => s.id)).toEqual(['a', 'b']);
    expect(cfg.servers[0]?.command).toBe('node');
  });
});

describe('readMcpConfig / writeMcpConfig', () => {
  it('returns empty when the config file does not exist', async () => {
    await expect(readMcpConfig(tmp())).resolves.toEqual({ servers: [] });
  });
  it('returns empty and logs on corrupt JSON', async () => {
    const dir = tmp();
    fs.writeFileSync(path.join(dir, 'mcp-config.json'), '{ not json');
    await expect(readMcpConfig(dir)).resolves.toEqual({ servers: [] });
  });
  it('rethrows non-ENOENT / non-syntax read errors (EISDIR)', async () => {
    const dir = tmp();
    fs.mkdirSync(path.join(dir, 'mcp-config.json')); // reading a directory throws EISDIR
    await expect(readMcpConfig(dir)).rejects.toThrow();
  });
  it('sanitizes, persists, and round-trips through the mutex', async () => {
    const dir = tmp();
    const written = await writeMcpConfig(dir, { servers: [{ id: 'a', command: 'node' }, { id: 'bad' }] });
    expect(written.servers.map((s) => s.id)).toEqual(['a']);
    await expect(readMcpConfig(dir)).resolves.toEqual(written);
  });
  it('serializes concurrent writes on the same dataDir', async () => {
    const dir = tmp();
    const [a, b] = await Promise.all([
      writeMcpConfig(dir, { servers: [{ id: 'a', command: 'node' }] }),
      writeMcpConfig(dir, { servers: [{ id: 'b', command: 'deno' }] }),
    ]);
    expect(a.servers[0]?.id).toBe('a');
    expect(b.servers[0]?.id).toBe('b');
    const final = await readMcpConfig(dir);
    expect(final.servers[0]?.id).toBe('b'); // last write wins
  });

  it('writes mcp-config.json with owner-only (0600) permissions (CR-006 / SEC-RB-002 — env/headers may carry API keys)', async () => {
    const dir = tmp();
    await writeMcpConfig(dir, { servers: [{ id: 'a', command: 'node' }] });
    if (process.platform !== 'win32') {
      const mode = fs.statSync(path.join(dir, 'mcp-config.json')).mode & 0o777;
      expect(mode).toBe(0o600);
    }
  });
});

describe('isManagedProjectCwd', () => {
  it('accepts only real subdirectories of the projects root', () => {
    const projects = '/data/projects';
    expect(isManagedProjectCwd(`${projects}/p1`, projects)).toBe(true);
    expect(isManagedProjectCwd(projects, projects)).toBe(false);
    expect(isManagedProjectCwd('/somewhere/else', projects)).toBe(false);
    expect(isManagedProjectCwd(null, projects)).toBe(false);
    expect(isManagedProjectCwd(undefined, projects)).toBe(false);
    expect(isManagedProjectCwd('/data/projects/p', '')).toBe(false);
  });

  it('rejects a lexical ".." escape even though the raw string starts with the projects-root prefix (CR-006 / SEC-RB-011)', () => {
    const projects = '/data/projects';
    expect(isManagedProjectCwd(`${projects}/../escape`, projects)).toBe(false);
    expect(isManagedProjectCwd(`${projects}/p1/../../escape`, projects)).toBe(false);
  });

  describe('realpath-based containment against a real filesystem', () => {
    const realDirs: string[] = [];
    function realTmp(): string {
      const d = fs.mkdtempSync(path.join(os.tmpdir(), 'jini-mcp-managed-cwd-'));
      realDirs.push(d);
      return d;
    }
    afterEach(() => {
      for (const d of realDirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
    });

    it('accepts a real subdirectory of the projects root after realpath resolution', () => {
      const root = realTmp();
      const projects = path.join(root, 'projects');
      fs.mkdirSync(projects);
      const proj = path.join(projects, 'p1');
      fs.mkdirSync(proj);
      expect(isManagedProjectCwd(proj, projects)).toBe(true);
    });

    it('rejects a symlinked descendant that resolves outside the projects root', () => {
      const root = realTmp();
      const projects = path.join(root, 'projects');
      const outside = path.join(root, 'outside');
      fs.mkdirSync(projects);
      fs.mkdirSync(outside);
      const evilLink = path.join(projects, 'evil');
      fs.symlinkSync(outside, evilLink);
      expect(isManagedProjectCwd(evilLink, projects)).toBe(false);
    });

    it('rejects a symlinked projects root whose real target differs from a symlinked cwd elsewhere', () => {
      const root = realTmp();
      const realProjects = path.join(root, 'real-projects');
      const outside = path.join(root, 'outside');
      fs.mkdirSync(realProjects);
      fs.mkdirSync(outside);
      const projectsLink = path.join(root, 'projects-link');
      fs.symlinkSync(realProjects, projectsLink);
      // A path that is lexically under the symlinked root name, but whose
      // real target is outside the real projects tree.
      const evilLink = path.join(realProjects, 'evil');
      fs.symlinkSync(outside, evilLink);
      expect(isManagedProjectCwd(path.join(projectsLink, 'evil'), projectsLink)).toBe(false);
    });
  });
});

describe('buildClaudeMcpJson', () => {
  it('returns null when no servers are enabled', () => {
    expect(buildClaudeMcpJson([{ id: 'a', transport: 'stdio', enabled: false, command: 'node' }])).toBeNull();
  });
  it('builds stdio entries with and without args/env', () => {
    const servers: McpServerConfig[] = [
      { id: 'full', transport: 'stdio', enabled: true, command: 'node', args: ['x'], env: { A: '1' } },
      { id: 'bare', transport: 'stdio', enabled: true, command: 'deno' },
    ];
    expect(buildClaudeMcpJson(servers)).toEqual({
      mcpServers: {
        full: { command: 'node', args: ['x'], env: { A: '1' } },
        bare: { command: 'deno' },
      },
    });
  });
  it('injects the oauth bearer, respects pinned auth, skips none-mode, and drops blank auth', () => {
    const servers: McpServerConfig[] = [
      { id: 'oauth', transport: 'http', enabled: true, url: 'https://a.example.com', authMode: 'oauth' },
      { id: 'pinned', transport: 'http', enabled: true, url: 'https://b.example.com', authMode: 'oauth', headers: { Authorization: 'Bearer pinned', 'X-Extra': 'v' } },
      { id: 'nomode', transport: 'http', enabled: true, url: 'https://c.example.com', authMode: 'none' },
      { id: 'blank', transport: 'sse', enabled: true, url: 'https://d.example.com', authMode: 'none', headers: { Authorization: '   ' } },
    ];
    const out = buildClaudeMcpJson(servers, { oauth: 'TOK', pinned: 'IGNORED', nomode: 'NOPE' }) as {
      mcpServers: Record<string, Record<string, unknown>>;
    };
    expect(out.mcpServers.oauth).toEqual({ type: 'http', url: 'https://a.example.com', headers: { Authorization: 'Bearer TOK' } });
    expect(out.mcpServers.pinned?.headers).toEqual({ Authorization: 'Bearer pinned', 'X-Extra': 'v' });
    expect(out.mcpServers.nomode).toEqual({ type: 'http', url: 'https://c.example.com' });
    expect(out.mcpServers.blank).toEqual({ type: 'sse', url: 'https://d.example.com' });
  });
  it('infers oauth for a remote server with no explicit authMode', () => {
    const out = buildClaudeMcpJson(
      [{ id: 's', transport: 'http', enabled: true, url: 'https://remote.example.com' }],
      { s: 'TT' },
    ) as { mcpServers: Record<string, Record<string, unknown>> };
    expect(out.mcpServers.s?.headers).toEqual({ Authorization: 'Bearer TT' });
  });
});

describe('buildAcpMcpServers', () => {
  it('keeps only enabled stdio servers and flattens env, skipping non-string values', () => {
    const servers: McpServerConfig[] = [
      { id: 'a', transport: 'stdio', enabled: true, command: 'node', args: ['x'], env: { good: 'v', bad: 1 as unknown as string } },
      { id: 'noargs', transport: 'stdio', enabled: true },
      { id: 'remote', transport: 'http', enabled: true, url: 'https://x.example.com' },
      { id: 'off', transport: 'stdio', enabled: false, command: 'nope' },
    ];
    const out = buildAcpMcpServers(servers);
    expect(out).toEqual([
      { type: 'stdio', name: 'a', command: 'node', args: ['x'], env: [{ name: 'good', value: 'v' }] },
      { type: 'stdio', name: 'noargs', command: '', args: [], env: [] },
    ]);
  });
});

describe('buildOpenCodeMcpConfigContent', () => {
  it('returns null when nothing would be emitted', () => {
    expect(buildOpenCodeMcpConfigContent([])).toBeNull();
    // stdio without a command and remote without a url are both skipped
    expect(
      buildOpenCodeMcpConfigContent([
        { id: 'a', transport: 'stdio', enabled: true },
        { id: 'b', transport: 'http', enabled: true },
      ]),
    ).toBeNull();
  });
  it('emits local + remote entries with env and merged auth headers, and no headers for a none-auth remote', () => {
    const servers: McpServerConfig[] = [
      { id: 'loc', transport: 'stdio', enabled: true, command: 'node', args: ['x'], env: { A: '1' } },
      { id: 'rem', transport: 'http', enabled: true, url: 'https://r.example.com', authMode: 'oauth' },
      { id: 'rembare', transport: 'http', enabled: true, url: 'https://n.example.com', authMode: 'none' },
    ];
    const cfg = JSON.parse(buildOpenCodeMcpConfigContent(servers, { rem: 'TOK' }) as string);
    expect(cfg.mcp.loc).toEqual({ type: 'local', command: ['node', 'x'], environment: { A: '1' }, enabled: true });
    expect(cfg.mcp.rem).toEqual({ type: 'remote', url: 'https://r.example.com', headers: { Authorization: 'Bearer TOK' }, enabled: true });
    expect(cfg.mcp.rembare).toEqual({ type: 'remote', url: 'https://n.example.com', enabled: true });
  });
  it('emits a stdio entry without environment when env is empty', () => {
    const cfg = JSON.parse(
      buildOpenCodeMcpConfigContent([{ id: 'loc', transport: 'stdio', enabled: true, command: 'node' }]) as string,
    );
    expect(cfg.mcp.loc).toEqual({ type: 'local', command: ['node'], enabled: true });
  });
  it('builds an external_directory allowlist, honoring symlink real paths, root, and merging prior permission', () => {
    const realTarget = tmp();
    const linkParent = tmp();
    const linkPath = path.join(linkParent, 'link');
    fs.symlinkSync(realTarget, linkPath);
    const resolvedTarget = fs.realpathSync.native(linkPath); // link + /var->/private/var both resolved
    const cfg = JSON.parse(
      buildOpenCodeMcpConfigContent([], {}, {
        allowedDirectories: [
          linkPath, // realpath differs from the given path
          '/', // filesystem root -> normalizeAllowedDirectory returns root, glob joins without a doubled sep
          'relative/not/absolute', // dropped (not absolute)
          '   ', // dropped (blank)
          '/does/not/exist/xyz123', // realpath throws -> keeps the normalized path only
        ],
        extraConfig: { permission: { some_prior: 'allow' } },
      }) as string,
    );
    const allow = cfg.permission.external_directory as Record<string, string>;
    expect(cfg.permission.some_prior).toBe('allow'); // prior permission preserved
    expect(allow['/']).toBe('allow');
    expect(allow['/*']).toBe('allow'); // root joins to "/*", not "//*"
    expect(allow[linkPath]).toBe('allow'); // the given (unresolved) path
    expect(allow[resolvedTarget]).toBe('allow'); // and its resolved real target
    expect(allow['/does/not/exist/xyz123']).toBe('allow');
  });
  it('emits only extraConfig when there are no servers or directories', () => {
    const cfg = JSON.parse(
      buildOpenCodeMcpConfigContent([], {}, { extraConfig: { provider: { openai: {} } } }) as string,
    );
    expect(cfg).toEqual({ provider: { openai: {} } });
  });
  it('discards a non-object prior permission when attaching the external_directory allowlist', () => {
    const cfg = JSON.parse(
      buildOpenCodeMcpConfigContent([], {}, {
        allowedDirectories: ['/'],
        extraConfig: { permission: 'not-an-object' },
      }) as string,
    );
    expect(typeof cfg.permission).toBe('object');
    expect(cfg.permission.external_directory['/']).toBe('allow');
  });
});
