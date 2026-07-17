import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFileLogger, installFatalExceptionHandlers, isHarmlessSocketOptionError } from './logging.js';

describe('isHarmlessSocketOptionError', () => {
  it('matches the setTypeOfService EINVAL shape with an authoritative code', () => {
    const error = Object.assign(new Error('setTypeOfService EINVAL'), { code: 'EINVAL' });
    expect(isHarmlessSocketOptionError(error)).toBe(true);
  });

  it('rejects a contradicting structured code even if the message contains EINVAL', () => {
    const error = Object.assign(new Error('setTypeOfService EINVAL'), { code: 'EACCES' });
    expect(isHarmlessSocketOptionError(error)).toBe(false);
  });

  it('falls back to message matching when no structured code is present', () => {
    expect(isHarmlessSocketOptionError(new Error('setTypeOfService EINVAL'))).toBe(true);
    expect(isHarmlessSocketOptionError(new Error('some other error'))).toBe(false);
  });

  it('returns false for non-Error values', () => {
    expect(isHarmlessSocketOptionError('boom')).toBe(false);
  });
});

describe('createFileLogger', () => {
  let dir: string | null = null;

  afterEach(async () => {
    if (dir != null) await rm(dir, { recursive: true, force: true });
    dir = null;
  });

  it('appends JSON lines to the log file', async () => {
    dir = await mkdtemp(join(tmpdir(), 'jini-desktop-host-log-'));
    const logPath = join(dir, 'host.log');
    const logger = createFileLogger(logPath, { echoToConsole: false });
    logger.info('starting up', { pid: 123 });
    logger.error('boom', { error: new Error('bad') });
    const contents = await readFile(logPath, 'utf8');
    const lines = contents.trim().split('\n').map((line) => JSON.parse(line));
    expect(lines[0]).toMatchObject({ level: 'info', message: 'starting up', meta: { pid: 123 } });
    expect(lines[1]).toMatchObject({ level: 'error', message: 'boom' });
    expect(lines[1].meta.error).toMatchObject({ message: 'bad' });
  });
});

describe('installFatalExceptionHandlers', () => {
  it('swallows a harmless uncaughtException and does not remove itself', () => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const uninstall = installFatalExceptionHandlers(logger);
    const listenersBefore = process.listenerCount('uncaughtException');
    const harmless = Object.assign(new Error('setTypeOfService EINVAL'), { code: 'EINVAL' });
    process.emit('uncaughtException', harmless);
    expect(logger.warn).toHaveBeenCalledWith('swallowed harmless uncaught exception', { error: harmless });
    expect(process.listenerCount('uncaughtException')).toBe(listenersBefore);
    uninstall();
  });

  it('uninstall removes both handlers', () => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const before = { unc: process.listenerCount('uncaughtException'), rej: process.listenerCount('unhandledRejection') };
    const uninstall = installFatalExceptionHandlers(logger);
    expect(process.listenerCount('uncaughtException')).toBe(before.unc + 1);
    expect(process.listenerCount('unhandledRejection')).toBe(before.rej + 1);
    uninstall();
    expect(process.listenerCount('uncaughtException')).toBe(before.unc);
    expect(process.listenerCount('unhandledRejection')).toBe(before.rej);
  });
});
