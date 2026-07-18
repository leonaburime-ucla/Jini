import { describe, expect, it, vi } from 'vitest';
import { resolveDaemonUrl } from './daemon-url.js';

describe('resolveDaemonUrl', () => {
  it('prefers an explicit flag URL over everything else', async () => {
    const url = await resolveDaemonUrl({
      flagUrl: 'http://flag.example',
      env: { JINI_DAEMON_URL: 'http://env.example' },
      envVarName: 'JINI_DAEMON_URL',
      defaultUrl: 'http://default.example',
    });
    expect(url).toBe('http://flag.example');
  });

  it('treats an empty-string flag URL as unset', async () => {
    const url = await resolveDaemonUrl({
      flagUrl: '',
      env: { JINI_DAEMON_URL: 'http://env.example' },
      envVarName: 'JINI_DAEMON_URL',
    });
    expect(url).toBe('http://env.example');
  });

  it('falls back to the env var when no flag is given', async () => {
    const url = await resolveDaemonUrl({
      env: { JINI_DAEMON_URL: 'http://env.example' },
      envVarName: 'JINI_DAEMON_URL',
    });
    expect(url).toBe('http://env.example');
  });

  it('skips the env step entirely when envVarName is omitted', async () => {
    const url = await resolveDaemonUrl({
      env: { JINI_DAEMON_URL: 'http://env.example' },
      defaultUrl: 'http://default.example',
    });
    expect(url).toBe('http://default.example');
  });

  it('falls through to discover() when the env var is unset or empty', async () => {
    const discover = vi.fn(async () => 'http://discovered.example');
    const url = await resolveDaemonUrl({
      env: { JINI_DAEMON_URL: '' },
      envVarName: 'JINI_DAEMON_URL',
      discover,
    });
    expect(url).toBe('http://discovered.example');
    expect(discover).toHaveBeenCalledWith({ JINI_DAEMON_URL: '' }, 800);
  });

  it('passes a custom timeoutMs through to discover()', async () => {
    const discover = vi.fn(async () => 'http://discovered.example');
    await resolveDaemonUrl({ discover, timeoutMs: 50 });
    expect(discover).toHaveBeenCalledWith(process.env, 50);
  });

  it('falls through to defaultUrl when discover() resolves null', async () => {
    const discover = vi.fn(async () => null);
    const url = await resolveDaemonUrl({ discover, defaultUrl: 'http://default.example' });
    expect(url).toBe('http://default.example');
  });

  it('falls through to defaultUrl when discover() resolves an empty string', async () => {
    const discover = vi.fn(async () => '');
    const url = await resolveDaemonUrl({ discover, defaultUrl: 'http://default.example' });
    expect(url).toBe('http://default.example');
  });

  it('throws when every step is exhausted and no defaultUrl is given', async () => {
    await expect(resolveDaemonUrl({})).rejects.toThrow('no daemon URL resolved');
  });

  it('defaults env to process.env when not injected', async () => {
    const previous = process.env.JINI_TEST_DAEMON_URL;
    process.env.JINI_TEST_DAEMON_URL = 'http://from-process-env.example';
    try {
      const url = await resolveDaemonUrl({ envVarName: 'JINI_TEST_DAEMON_URL' });
      expect(url).toBe('http://from-process-env.example');
    } finally {
      if (previous === undefined) delete process.env.JINI_TEST_DAEMON_URL;
      else process.env.JINI_TEST_DAEMON_URL = previous;
    }
  });
});
