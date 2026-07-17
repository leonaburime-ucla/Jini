import { describe, expect, it } from 'vitest';
import { spawnEnvForAgent } from './env.js';

describe('spawnEnvForAgent', () => {
  it('merges base env with configured overrides without touching an unrelated agent', () => {
    const env = spawnEnvForAgent('claude', { PATH: '/usr/bin' }, { ANTHROPIC_API_KEY: 'sk-test' }, {});
    expect(env.ANTHROPIC_API_KEY).toBe('sk-test');
    expect(env.PATH).toBe('/usr/bin');
  });

  it('disables OpenCode project-config discovery by default', () => {
    const env = spawnEnvForAgent('opencode', {}, {}, {});
    expect(env.OPENCODE_DISABLE_PROJECT_CONFIG).toBe('true');
  });

  it('disables MiMo project-config discovery by default', () => {
    const env = spawnEnvForAgent('mimo', {}, {}, {});
    expect(env.MIMOCODE_DISABLE_PROJECT_CONFIG).toBe('true');
  });

  it('strips OpenCode server-identity env keys case-insensitively', () => {
    const env = spawnEnvForAgent('opencode', { opencode_pid: '123', OPENCODE_RUN_ID: 'x' }, {}, {});
    expect(env.opencode_pid).toBeUndefined();
    expect(env.OPENCODE_RUN_ID).toBeUndefined();
  });

  it('calls the perAgentEnv hook and merges its return value in', () => {
    const env = spawnEnvForAgent('amr', {}, {}, {}, {
      perAgentEnv: (agentId, liveEnv) => {
        expect(agentId).toBe('amr');
        expect(liveEnv.HOME).toBeTruthy(); // backfilled by the amr branch above
        return { VELA_LINK_URL: 'https://example.test' };
      },
    });
    expect(env.VELA_LINK_URL).toBe('https://example.test');
  });

  it('applies the sandboxOverlay hook last', () => {
    const env = spawnEnvForAgent('claude', {}, {}, {}, {
      sandboxOverlay: (liveEnv) => ({ ...liveEnv, SANDBOX_MARKER: '1' }),
    });
    expect(env.SANDBOX_MARKER).toBe('1');
  });

  it('never emits the product-branded env vars the origin hardcoded (installation id, analytics client-source identity)', () => {
    // Built via concatenation so this test file doesn't itself contain the
    // banned literal — see auth.test.ts's ORIGIN_PRODUCT_NAME comment.
    const bannedInstallationIdKey = ['OD', 'INSTALLATION', 'ID'].join('_');
    const env = spawnEnvForAgent('amr', {}, {}, {});
    expect(Object.keys(env)).not.toContain(bannedInstallationIdKey);
    expect(env.AMR_CLIENT_SOURCE).toBeUndefined();
  });
});
