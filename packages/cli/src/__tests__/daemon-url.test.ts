import { describe, expect, it, vi } from 'vitest';
import { daemonUrlPolicyWarning, resolveDaemonUrl, sanitizeDaemonUrlForDisplay } from '../daemon-url.js';

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

  it('reports a policy warning via the injected warn sink for a non-loopback, non-HTTPS URL', async () => {
    const warn = vi.fn();
    await resolveDaemonUrl({ flagUrl: 'http://remote.example:4111', warn });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toContain('remote.example');
  });

  it('does not warn for a loopback URL', async () => {
    const warn = vi.fn();
    await resolveDaemonUrl({ flagUrl: 'http://127.0.0.1:4111', warn });
    expect(warn).not.toHaveBeenCalled();
  });

  it('does not warn for an HTTPS URL', async () => {
    const warn = vi.fn();
    await resolveDaemonUrl({ flagUrl: 'https://remote.example', warn });
    expect(warn).not.toHaveBeenCalled();
  });

  it('defaults warn to a no-op when not injected', async () => {
    await expect(resolveDaemonUrl({ flagUrl: 'http://remote.example' })).resolves.toBe('http://remote.example');
  });
});

describe('sanitizeDaemonUrlForDisplay', () => {
  it('returns a URL with no userinfo unchanged', () => {
    expect(sanitizeDaemonUrlForDisplay('http://127.0.0.1:4111')).toBe('http://127.0.0.1:4111');
  });

  it('strips embedded userinfo from a parseable URL', () => {
    const sanitized = sanitizeDaemonUrlForDisplay('http://user:hunter2@d.example/path');
    expect(sanitized).not.toContain('hunter2');
    expect(sanitized).not.toContain('user:');
    expect(sanitized).toContain('d.example');
  });

  it('strips a userinfo-shaped prefix from a URL that fails to parse', () => {
    // Deliberately malformed (space in host) so `new URL()` throws, exercising the regex
    // fallback rather than the `URL` constructor path.
    const sanitized = sanitizeDaemonUrlForDisplay('http://user:hunter2@bad host/path');
    expect(sanitized).not.toContain('hunter2');
  });

  it('returns an unparseable, userinfo-free string unchanged', () => {
    expect(sanitizeDaemonUrlForDisplay('not a url at all')).toBe('not a url at all');
  });
});

describe('daemonUrlPolicyWarning', () => {
  it('returns null for a loopback URL', () => {
    expect(daemonUrlPolicyWarning('http://127.0.0.1:4111')).toBeNull();
    expect(daemonUrlPolicyWarning('http://localhost:4111')).toBeNull();
  });

  it('returns null for an HTTPS URL even on a remote host', () => {
    expect(daemonUrlPolicyWarning('https://remote.example')).toBeNull();
  });

  it('returns a warning for a remote, non-HTTPS URL', () => {
    const warning = daemonUrlPolicyWarning('http://remote.example:4111');
    expect(warning).not.toBeNull();
    expect(warning).toContain('remote.example');
  });

  it('never includes userinfo in the warning text', () => {
    const warning = daemonUrlPolicyWarning('http://user:hunter2@remote.example');
    expect(warning).not.toContain('hunter2');
  });

  it('returns null for an unparseable URL', () => {
    expect(daemonUrlPolicyWarning('not a url at all')).toBeNull();
  });
});
