import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_CLI_EXIT_CODES } from './errors.js';
import { postJsonToDaemon, surfaceFetchError } from './http.js';

class ExitSentinel extends Error {
  constructor(public code: number) {
    super(`exit ${code}`);
  }
}

function captureWrite() {
  const written: string[] = [];
  return { written, write: (text: string) => { written.push(text); } };
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe('surfaceFetchError', () => {
  it('formats a plain Error with no cause', () => {
    const { written, write } = captureWrite();
    surfaceFetchError(new Error('boom'), 'http://d.example', { write });
    expect(written[0]).toBe('failed to reach daemon at http://d.example: boom\n');
  });

  it('formats a non-Error thrown value via String()', () => {
    const { written, write } = captureWrite();
    surfaceFetchError('just a string', 'http://d.example', { write });
    expect(written[0]).toBe('failed to reach daemon at http://d.example: just a string\n');
  });

  it('prefers cause.code + cause.message when present', () => {
    const { written, write } = captureWrite();
    const err = new Error('outer');
    (err as unknown as { cause: unknown }).cause = { code: 'ECONNREFUSED', message: 'refused' };
    surfaceFetchError(err, 'http://d.example', { write });
    expect(written[0]).toBe('failed to reach daemon at http://d.example: ECONNREFUSED — refused\n');
  });

  it('uses cause.code alone when cause has no message', () => {
    const { written, write } = captureWrite();
    const err = new Error('outer');
    (err as unknown as { cause: unknown }).cause = { code: 'ECONNREFUSED' };
    surfaceFetchError(err, 'http://d.example', { write });
    expect(written[0]).toBe('failed to reach daemon at http://d.example: ECONNREFUSED\n');
  });

  it('uses cause.message alone when cause has no code', () => {
    const { written, write } = captureWrite();
    const err = new Error('outer');
    (err as unknown as { cause: unknown }).cause = { message: 'timed out' };
    surfaceFetchError(err, 'http://d.example', { write });
    expect(written[0]).toBe('failed to reach daemon at http://d.example: timed out\n');
  });

  it('adds a sandbox hint for EPERM', () => {
    const { written, write } = captureWrite();
    const err = new Error('outer');
    (err as unknown as { cause: unknown }).cause = { code: 'EPERM' };
    surfaceFetchError(err, 'http://d.example', { write });
    expect(written).toHaveLength(2);
    expect(written[1]).toContain('sandbox');
  });

  it('adds a sandbox hint for ENETUNREACH', () => {
    const { written, write } = captureWrite();
    const err = new Error('outer');
    (err as unknown as { cause: unknown }).cause = { code: 'ENETUNREACH' };
    surfaceFetchError(err, 'http://d.example', { write });
    expect(written).toHaveLength(2);
  });

  it('does not add a hint for an unrelated cause code', () => {
    const { written, write } = captureWrite();
    const err = new Error('outer');
    (err as unknown as { cause: unknown }).cause = { code: 'EOTHER' };
    surfaceFetchError(err, 'http://d.example', { write });
    expect(written).toHaveLength(1);
  });

  it('defaults write to process.stderr.write when not injected', () => {
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
      surfaceFetchError(new Error('boom'), 'http://d.example');
      expect(spy).toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});

describe('postJsonToDaemon', () => {
  it('returns the parsed JSON body on a 2xx response', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { ok: true }));
    const data = await postJsonToDaemon('http://d.example', '/api/x', { a: 1 }, { fetchImpl });
    expect(data).toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledWith('http://d.example/api/x', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ a: 1 }),
    });
  });

  it('merges caller-supplied headers', async () => {
    const fetchImpl = vi.fn(async (..._args: Parameters<typeof fetch>) => jsonResponse(200, {}));
    await postJsonToDaemon('http://d.example', '/api/x', {}, { fetchImpl, headers: { 'x-token': 't' } });
    const call = fetchImpl.mock.calls[0]!;
    expect(call[1]?.headers).toEqual({ 'content-type': 'application/json', 'x-token': 't' });
  });

  it('exits via the structured-error path on a network failure', async () => {
    const fetchImpl = vi.fn(async () => { throw new Error('network down'); });
    const exit = vi.fn((code: number): never => { throw new ExitSentinel(code); });
    const write = vi.fn();
    await expect(
      postJsonToDaemon('http://d.example', '/api/x', {}, { fetchImpl, exit, write }),
    ).rejects.toThrow(ExitSentinel);
    expect(exit).toHaveBeenCalledWith(DEFAULT_CLI_EXIT_CODES['daemon-not-running']);
  });

  it('exits via the structured-error path when the daemon returns a recognized error code', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(422, { error: { code: 'missing-input', message: 'need x', data: { field: 'x' } } }),
    );
    const exit = vi.fn((code: number): never => { throw new ExitSentinel(code); });
    const write = vi.fn();
    await expect(
      postJsonToDaemon('http://d.example', '/api/x', {}, { fetchImpl, exit, write }),
    ).rejects.toThrow(ExitSentinel);
    expect(exit).toHaveBeenCalledWith(DEFAULT_CLI_EXIT_CODES['missing-input']);
  });

  it('honors caller-supplied exitCodes for a code outside the default table', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(409, { error: { code: 'custom-conflict', message: 'nope' } }),
    );
    const exit = vi.fn((code: number): never => { throw new ExitSentinel(code); });
    const write = vi.fn();
    await expect(
      postJsonToDaemon('http://d.example', '/api/x', {}, {
        fetchImpl,
        exit,
        write,
        exitCodes: { 'custom-conflict': 77 },
      }),
    ).rejects.toThrow(ExitSentinel);
    expect(exit).toHaveBeenCalledWith(77);
  });

  it('falls back to "HTTP <status>" as the message when a recognized error code has no message field', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(422, { error: { code: 'missing-input' } }));
    const exit = vi.fn((code: number): never => { throw new ExitSentinel(code); });
    const write = vi.fn();
    await expect(
      postJsonToDaemon('http://d.example', '/api/x', {}, { fetchImpl, exit, write }),
    ).rejects.toThrow(ExitSentinel);
    expect(exit).toHaveBeenCalledWith(DEFAULT_CLI_EXIT_CODES['missing-input']);
  });

  it('falls back to a plain write + exit(1) for an error code not in any table', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(500, { error: { code: 'totally-unmapped' } }));
    const exit = vi.fn((code: number): never => { throw new ExitSentinel(code); });
    const write = vi.fn();
    await expect(
      postJsonToDaemon('http://d.example', '/api/x', {}, { fetchImpl, exit, write }),
    ).rejects.toThrow(ExitSentinel);
    expect(exit).toHaveBeenCalledWith(1);
    expect(write).toHaveBeenCalledWith(expect.stringContaining('POST /api/x failed: 500'));
  });

  it('falls back to a plain write + exit(1) when the response has no error envelope at all', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(500, {}));
    const exit = vi.fn((code: number): never => { throw new ExitSentinel(code); });
    const write = vi.fn();
    await expect(
      postJsonToDaemon('http://d.example', '/api/x', {}, { fetchImpl, exit, write }),
    ).rejects.toThrow(ExitSentinel);
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('tolerates a non-JSON response body by treating it as {}', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => { throw new Error('not json'); },
    } as unknown as Response));
    const exit = vi.fn((code: number): never => { throw new ExitSentinel(code); });
    const write = vi.fn();
    await expect(
      postJsonToDaemon('http://d.example', '/api/x', {}, { fetchImpl, exit, write }),
    ).rejects.toThrow(ExitSentinel);
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('defaults write/exit to process.stderr/process.exit on a network failure', async () => {
    const fetchImpl = vi.fn(async () => { throw new Error('network down'); });
    const writeSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number): never => {
      throw new ExitSentinel(code ?? 0);
    }) as never);
    try {
      await expect(postJsonToDaemon('http://d.example', '/api/x', {}, { fetchImpl })).rejects.toThrow(ExitSentinel);
      expect(writeSpy).toHaveBeenCalled();
      expect(exitSpy).toHaveBeenCalledWith(DEFAULT_CLI_EXIT_CODES['daemon-not-running']);
    } finally {
      writeSpy.mockRestore();
      exitSpy.mockRestore();
    }
  });

  it('defaults write/exit to process.stderr/process.exit on the unrecognized-error-code fallback path', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(500, { error: { code: 'totally-unmapped' } }));
    const writeSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number): never => {
      throw new ExitSentinel(code ?? 0);
    }) as never);
    try {
      await expect(postJsonToDaemon('http://d.example', '/api/x', {}, { fetchImpl })).rejects.toThrow(ExitSentinel);
      expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('POST /api/x failed: 500'));
      expect(exitSpy).toHaveBeenCalledWith(1);
    } finally {
      writeSpy.mockRestore();
      exitSpy.mockRestore();
    }
  });

  it('defaults fetchImpl to the global fetch when not injected', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(200, { ok: true }) as Response);
    try {
      const data = await postJsonToDaemon('http://d.example', '/api/x', {});
      expect(data).toEqual({ ok: true });
    } finally {
      spy.mockRestore();
    }
  });
});
