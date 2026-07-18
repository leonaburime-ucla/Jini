import { describe, expect, it, vi } from 'vitest';
import {
  defaultDnsLookup,
  isBlockedExternalApiHostname,
  isLoopbackApiHost,
  redactSecrets,
  validateBaseUrl,
  validateBaseUrlResolved,
  type DnsLookupAddress,
} from './connection-guard.js';

describe('isLoopbackApiHost', () => {
  it('recognizes localhost and ::1', () => {
    expect(isLoopbackApiHost('localhost')).toBe(true);
    expect(isLoopbackApiHost('::1')).toBe(true);
    expect(isLoopbackApiHost('[::1]')).toBe(true);
  });

  it('recognizes 127.0.0.0/8', () => {
    expect(isLoopbackApiHost('127.0.0.1')).toBe(true);
    expect(isLoopbackApiHost('127.255.255.255')).toBe(true);
  });

  it('is case-insensitive and strips a trailing dot (FQDN form)', () => {
    expect(isLoopbackApiHost('LOCALHOST.')).toBe(true);
    expect(isLoopbackApiHost('127.0.0.1.')).toBe(true);
  });

  it('recognizes IPv4-mapped IPv6 loopback (dotted and hex forms)', () => {
    expect(isLoopbackApiHost('::ffff:127.0.0.1')).toBe(true);
    expect(isLoopbackApiHost('::ffff:7f00:1')).toBe(true);
  });

  it('rejects non-loopback hosts', () => {
    expect(isLoopbackApiHost('example.com')).toBe(false);
    expect(isLoopbackApiHost('10.0.0.1')).toBe(false);
    expect(isLoopbackApiHost('::ffff:10.0.0.1')).toBe(false);
  });

  it('rejects a malformed IPv4-mapped hex form', () => {
    expect(isLoopbackApiHost('::ffff:zzzz:1')).toBe(false);
    expect(isLoopbackApiHost('::ffff:1:2:3')).toBe(false);
  });

  it('treats an out-of-range IPv4 octet as not a valid IPv4 address at all', () => {
    expect(isLoopbackApiHost('999.0.0.1')).toBe(false);
  });
});

describe('isBlockedExternalApiHostname', () => {
  it('blocks the unspecified IPv6 address', () => {
    expect(isBlockedExternalApiHostname('::')).toBe(true);
  });

  it('blocks RFC1918 / link-local / CGNAT / multicast IPv4 ranges', () => {
    expect(isBlockedExternalApiHostname('0.0.0.0')).toBe(true);
    expect(isBlockedExternalApiHostname('100.64.0.1')).toBe(true);
    expect(isBlockedExternalApiHostname('100.127.255.255')).toBe(true);
    expect(isBlockedExternalApiHostname('169.254.1.1')).toBe(true);
    expect(isBlockedExternalApiHostname('10.1.2.3')).toBe(true);
    expect(isBlockedExternalApiHostname('192.168.1.1')).toBe(true);
    expect(isBlockedExternalApiHostname('172.16.0.1')).toBe(true);
    expect(isBlockedExternalApiHostname('172.31.255.255')).toBe(true);
    expect(isBlockedExternalApiHostname('224.0.0.1')).toBe(true);
  });

  it('does not block a normal public IPv4 address', () => {
    expect(isBlockedExternalApiHostname('8.8.8.8')).toBe(false);
    expect(isBlockedExternalApiHostname('172.32.0.1')).toBe(false);
    expect(isBlockedExternalApiHostname('100.63.0.1')).toBe(false);
    expect(isBlockedExternalApiHostname('100.128.0.1')).toBe(false);
  });

  it('blocks unique-local and link-local IPv6', () => {
    expect(isBlockedExternalApiHostname('fc00::1')).toBe(true);
    expect(isBlockedExternalApiHostname('fd12::1')).toBe(true);
    expect(isBlockedExternalApiHostname('fe80::1')).toBe(true);
    expect(isBlockedExternalApiHostname('fe90::1')).toBe(true);
    expect(isBlockedExternalApiHostname('fea0::1')).toBe(true);
    expect(isBlockedExternalApiHostname('feb0::1')).toBe(true);
  });

  it('does not block a normal public IPv6 address', () => {
    expect(isBlockedExternalApiHostname('2001:4860:4860::8888')).toBe(false);
  });

  it('blocks an IPv4-mapped blocked address', () => {
    expect(isBlockedExternalApiHostname('::ffff:10.0.0.1')).toBe(true);
  });

  it('does not block a hostname that is not a recognizable IP literal', () => {
    expect(isBlockedExternalApiHostname('example.com')).toBe(false);
  });
});

describe('validateBaseUrl', () => {
  it('accepts a normal https url', () => {
    const result = validateBaseUrl('https://api.openai.com/v1');
    expect(result.error).toBeUndefined();
    expect(result.parsed?.hostname).toBe('api.openai.com');
  });

  it('rejects an unparseable url', () => {
    expect(validateBaseUrl('not a url').error).toBe('Invalid baseUrl');
  });

  it('rejects a non-http(s) scheme', () => {
    expect(validateBaseUrl('ftp://example.com').error).toBe('Only http/https allowed');
  });

  it('rejects a blocked internal hostname as forbidden', () => {
    const result = validateBaseUrl('http://10.0.0.5/v1');
    expect(result.error).toBe('Internal IPs blocked');
    expect(result.forbidden).toBe(true);
  });

  it('allows a loopback hostname through even though it would otherwise match no block rule', () => {
    const result = validateBaseUrl('http://127.0.0.1:11434/v1');
    expect(result.error).toBeUndefined();
  });

  it('strips trailing slashes before parsing', () => {
    const result = validateBaseUrl('https://api.openai.com/v1///');
    expect(result.parsed?.toString()).toBe('https://api.openai.com/v1');
  });
});

describe('validateBaseUrlResolved', () => {
  it('short-circuits on a sync validation failure without calling lookup', async () => {
    const lookup = vi.fn();
    const result = await validateBaseUrlResolved('not a url', lookup);
    expect(result.error).toBe('Invalid baseUrl');
    expect(lookup).not.toHaveBeenCalled();
  });

  it('skips DNS resolution for a loopback hostname', async () => {
    const lookup = vi.fn();
    const result = await validateBaseUrlResolved('http://localhost:11434', lookup);
    expect(result.error).toBeUndefined();
    expect(lookup).not.toHaveBeenCalled();
  });

  it('skips DNS resolution for a literal IP hostname (IPv4)', async () => {
    const lookup = vi.fn();
    const result = await validateBaseUrlResolved('https://8.8.8.8/v1', lookup);
    expect(result.error).toBeUndefined();
    expect(lookup).not.toHaveBeenCalled();
  });

  it('skips DNS resolution for a literal IPv6 hostname', async () => {
    const lookup = vi.fn();
    const result = await validateBaseUrlResolved('https://[2001:4860:4860::8888]/v1', lookup);
    expect(result.error).toBeUndefined();
    expect(lookup).not.toHaveBeenCalled();
  });

  it('resolves a public hostname and passes when every address is public', async () => {
    const lookup = vi.fn(async (): Promise<DnsLookupAddress[]> => [{ address: '8.8.8.8', family: 4 }]);
    const result = await validateBaseUrlResolved('https://api.example.com/v1', lookup);
    expect(result.error).toBeUndefined();
    expect(lookup).toHaveBeenCalledWith('api.example.com');
  });

  it('rejects a public hostname that resolves to a blocked address', async () => {
    const lookup = vi.fn(async (): Promise<DnsLookupAddress[]> => [{ address: '10.0.0.5', family: 4 }]);
    const result = await validateBaseUrlResolved('https://internal.example.com/v1', lookup);
    expect(result.error).toBe('Internal IPs blocked');
    expect(result.forbidden).toBe(true);
  });

  it('treats a loopback-resolved address as allowed', async () => {
    const lookup = vi.fn(async (): Promise<DnsLookupAddress[]> => [{ address: '127.0.0.1', family: 4 }]);
    const result = await validateBaseUrlResolved('https://foo.localhost/v1', lookup);
    expect(result.error).toBeUndefined();
  });

  it('does not treat a DNS lookup failure as a security signal', async () => {
    const lookup = vi.fn(async () => {
      throw new Error('ENOTFOUND');
    });
    const result = await validateBaseUrlResolved('https://unresolvable.example.com/v1', lookup);
    expect(result.error).toBeUndefined();
  });
});

describe('defaultDnsLookup', () => {
  it('resolves loopback for localhost via the real node:dns module', async () => {
    const addresses = await defaultDnsLookup('localhost');
    expect(addresses.length).toBeGreaterThan(0);
    expect(addresses.every((a) => typeof a.address === 'string' && typeof a.family === 'number')).toBe(true);
  });
});

describe('redactSecrets', () => {
  it('returns an empty string for non-string/empty input', () => {
    expect(redactSecrets('')).toBe('');
    expect(redactSecrets(undefined as unknown as string)).toBe('');
  });

  it('redacts a Bearer token', () => {
    expect(redactSecrets('Authorization: Bearer sk-abc123.def')).toBe('Authorization: Bearer [REDACTED]');
  });

  it('redacts x-api-key / api-key / x-goog-api-key style headers', () => {
    expect(redactSecrets('x-api-key: secret123')).toBe('x-api-key: [REDACTED]');
    expect(redactSecrets('api-key=secret123')).toBe('api-key: [REDACTED]');
    expect(redactSecrets('x-goog-api-key: secret123')).toBe('x-goog-api-key: [REDACTED]');
  });

  it('redacts a ?key= query value', () => {
    expect(redactSecrets('https://example.com?key=abc123&other=1')).toBe(
      'https://example.com?key=[REDACTED]&other=1',
    );
  });

  it('redacts every occurrence of an exact secret, escaping regex metacharacters', () => {
    expect(redactSecrets('key is a.b+c and again a.b+c', ['a.b+c'])).toBe(
      'key is [REDACTED] and again [REDACTED]',
    );
  });

  it('ignores blank/undefined/null entries in exactSecrets', () => {
    expect(redactSecrets('hello world', [undefined, null, ''])).toBe('hello world');
  });
});
