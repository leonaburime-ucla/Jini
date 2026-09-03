import { describe, expect, it } from 'vitest';
import { buildCodexHomeConfigToml, buildCodexMcpServerToml } from '../agent-executor.js';

const entry: Parameters<typeof buildCodexMcpServerToml>[0] = {
  command: '/usr/bin/node',
  args: ['/opt/jini/serve.js'],
  env: { JINI_RUN_ID: 'run-1', JINI_DAEMON_URL: 'http://127.0.0.1:4000', JINI_DAEMON_TOKEN: 'tok-1' },
};

describe('buildCodexHomeConfigToml', () => {
  it('does not duplicate the [mcp_servers.jini] table when the operator config already has one', () => {
    const existing = [
      'model = "gpt-5"',
      '',
      '[mcp_servers.jini]',
      'command = "/old/stale/node"',
      'args = ["/old/stale/serve.js"]',
      '',
      '[mcp_servers.jini.env]',
      'JINI_RUN_ID = "stale-run"',
      '',
      '[sandbox]',
      'policy = "workspace-write"',
    ].join('\n');

    const result = buildCodexHomeConfigToml(existing, entry);

    const jiniTableOccurrences = result.split('[mcp_servers.jini]').length - 1;
    expect(jiniTableOccurrences).toBe(1);
    // The operator's own unrelated settings must survive untouched.
    expect(result).toContain('model = "gpt-5"');
    expect(result).toContain('[sandbox]');
    expect(result).toContain('policy = "workspace-write"');
    // The stale entry must be gone, replaced by this run's own.
    expect(result).not.toContain('/old/stale/node');
    expect(result).not.toContain('stale-run');
    expect(result).toContain(buildCodexMcpServerToml(entry));
  });

  it('appends normally when no pre-existing [mcp_servers.jini] table is present', () => {
    const existing = 'model = "gpt-5"\n';
    const result = buildCodexHomeConfigToml(existing, entry);
    expect(result.split('[mcp_servers.jini]').length - 1).toBe(1);
    expect(result).toContain('model = "gpt-5"');
    expect(result).toContain(buildCodexMcpServerToml(entry));
  });

  it('handles an undefined existing config (fresh Codex install)', () => {
    const result = buildCodexHomeConfigToml(undefined, entry);
    expect(result).toBe(buildCodexMcpServerToml(entry));
  });
});
