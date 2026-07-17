/**
 * Generalized from OD `apps/packaged/src/logging.ts`. The file-append
 * logger, the console-shim (so `console.log`/`warn`/`error` also land in
 * the log file), and the fatal-`uncaughtException`/`unhandledRejection`
 * handler-that-removes-itself-then-rethrows pattern are all genuinely
 * generic Electron/Node main-process concerns. Dropped: everything tied to
 * OD's `PackagedNamespacePaths`/`SidecarStamp` (the log path and any
 * startup metadata are now plain caller-supplied strings), and the
 * `OD_DESKTOP_LOG_ECHO` env var name (now a plain boolean option). The
 * "harmless setTypeOfService EINVAL" filter is kept as the *default*
 * predicate (it's a real, still-relevant undici/macOS quirk any Electron
 * app embedding fetch can hit) but is now overridable — a generic host
 * package should not hardcode that a caller's error taxonomy matches OD's.
 */
import { appendFileSync } from 'node:fs';

export interface HostLogger {
  error(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
}

type LogLevel = 'error' | 'info' | 'warn';

function normalizeError(error: unknown): unknown {
  if (error instanceof Error) return { message: error.message, name: error.name, stack: error.stack };
  return error;
}

function normalizeMeta(meta: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (meta == null) return undefined;
  return Object.fromEntries(
    Object.entries(meta).map(([key, value]) => [key, key === 'error' || key === 'reason' ? normalizeError(value) : value]),
  );
}

function serializeMessage(level: LogLevel, message: string, meta?: Record<string, unknown>): string {
  const timestamp = new Date().toISOString();
  try {
    return `${JSON.stringify({ level, message, timestamp, ...(meta == null ? {} : { meta: normalizeMeta(meta) }) })}\n`;
  } catch (error) {
    return `${JSON.stringify({
      level,
      message,
      timestamp,
      meta: { serializationError: error instanceof Error ? error.message : String(error) },
    })}\n`;
  }
}

export type LogAppend = (path: string, data: string, encoding: BufferEncoding) => void;

export function appendLogLine(logPath: string, line: string, append: LogAppend = appendFileSync): boolean {
  try {
    append(logPath, line, 'utf8');
    return true;
  } catch {
    return false;
  }
}

export function createFileLogger(logPath: string, options: { echoToConsole?: boolean } = {}): HostLogger {
  const echo = options.echoToConsole ?? true;
  const write = (level: LogLevel, message: string, meta?: Record<string, unknown>) => {
    appendLogLine(logPath, serializeMessage(level, message, meta));
  };
  const logger: HostLogger = {
    error(message, meta) {
      write('error', message, meta);
      if (echo) console.error(message, meta ?? '');
    },
    info(message, meta) {
      write('info', message, meta);
      if (echo) console.info(message, meta ?? '');
    },
    warn(message, meta) {
      write('warn', message, meta);
      if (echo) console.warn(message, meta ?? '');
    },
  };
  return logger;
}

/**
 * Matches the known-harmless undici `setTypeOfService EINVAL` shape (see
 * OD issue #895): certain macOS/VPN configurations refuse to let the
 * kernel set the outbound socket's IP_TOS byte, which has no functional
 * effect on the request. `code` is authoritative when present.
 */
export function isHarmlessSocketOptionError(value: unknown): boolean {
  if (!(value instanceof Error)) return false;
  const message = typeof value.message === 'string' ? value.message : '';
  if (!message || !message.includes('setTypeOfService')) return false;
  const code = (value as NodeJS.ErrnoException).code;
  if (typeof code === 'string' && code.length > 0) return code === 'EINVAL';
  return message.includes('EINVAL');
}

export interface InstallFatalExceptionHandlersOptions {
  isHarmless?: (error: unknown) => boolean;
}

/**
 * Installs `uncaughtException`/`unhandledRejection` handlers that log and
 * swallow harmless errors, and for anything else remove themselves before
 * re-throwing via `setImmediate` — without detaching first, the re-throw
 * would re-enter the same handler and loop forever instead of letting
 * Node's default crash path (and Electron's native error dialog) take
 * over. Returns a function that uninstalls both handlers.
 */
export function installFatalExceptionHandlers(
  logger: HostLogger,
  options: InstallFatalExceptionHandlersOptions = {},
): () => void {
  const isHarmless = options.isHarmless ?? isHarmlessSocketOptionError;

  const onUncaughtException = (error: unknown): void => {
    if (isHarmless(error)) {
      logger.warn('swallowed harmless uncaught exception', { error });
      return;
    }
    logger.error('fatal uncaught exception', { error });
    process.removeListener('uncaughtException', onUncaughtException);
    setImmediate(() => {
      throw error;
    });
  };

  const onUnhandledRejection = (reason: unknown): void => {
    if (isHarmless(reason)) {
      logger.warn('swallowed harmless unhandled rejection', { reason });
      return;
    }
    logger.error('fatal unhandled rejection', { reason });
    process.removeListener('unhandledRejection', onUnhandledRejection);
    setImmediate(() => {
      throw reason;
    });
  };

  process.on('uncaughtException', onUncaughtException);
  process.on('unhandledRejection', onUnhandledRejection);

  return () => {
    process.removeListener('uncaughtException', onUncaughtException);
    process.removeListener('unhandledRejection', onUnhandledRejection);
  };
}
