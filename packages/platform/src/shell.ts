/**
 * @module shell
 *
 * Buffered command execution that re-enters the user's login shell. A daemon
 * process's own `PATH` frequently lacks entries a shell profile adds (a
 * version manager's shims, a package-manager-installed CLI, a Homebrew
 * prefix), so a plain `execFile` against a bare command name can fail even
 * though the same command works fine in the user's terminal. Routing through
 * `$SHELL -c "..."` re-sources that PATH before running the command.
 *
 * Depends on nothing else in this package; owns no process lifecycle beyond
 * the single buffered child it spawns per call.
 */
import { execFile, type ExecFileOptions } from "node:child_process";

export type BufferedCommandResult = {
  code: string | number | null | undefined;
  error: Error | null;
  ok: boolean;
  stderr: string;
  stdout: string;
};

/**
 * Run a command directly via `execFile`, buffering stdout/stderr and never
 * rejecting — failures are reported through the returned `ok`/`error` fields.
 *
 * @param command - The executable to run.
 * @param args - Arguments to pass to the executable.
 * @param opts - `child_process.execFile` options (a 120s timeout and 1MiB
 *   buffer apply unless overridden).
 * @returns The buffered result.
 */
export function execFileBuffered(
  command: string,
  args: readonly string[],
  opts: ExecFileOptions = {},
): Promise<BufferedCommandResult> {
  return new Promise((resolve) => {
    execFile(command, [...args], { timeout: 120_000, maxBuffer: 1024 * 1024, ...opts }, (error, stdout, stderr) => {
      resolve({
        code: error && "code" in error ? error.code : undefined,
        error,
        ok: !error,
        stderr: String(stderr).trim(),
        stdout: String(stdout).trim(),
      });
    });
  });
}

/** @internal Single-quote a POSIX shell argument, escaping embedded single quotes. */
function quotePosixShellArg(value: string | null | undefined): string {
  const text = String(value ?? "");
  return `'${text.replace(/'/g, `'\\''`)}'`;
}

/** @internal Join a command and its arguments into one quoted POSIX shell command line. */
function buildShellCommandLine(command: string, args: readonly string[]): string {
  return [command, ...args].map(quotePosixShellArg).join(" ");
}

/** @internal Wrap a shell command line so a non-login shell still sees the current `PATH`. */
function buildLoginShellCommand(innerCommand: string): string {
  // Use a non-login shell and re-export PATH so test fakes and wrapped
  // command shims remain visible; login shells often reset PATH from
  // profile scripts.
  return `export PATH=${quotePosixShellArg(process.env.PATH)}; ${innerCommand}`;
}

/**
 * Run an arbitrary command re-entering the user's login shell (via
 * `$SHELL -c`) so shell-profile-only `PATH` entries are visible, then buffer
 * its output. Falls back to a direct `execFile` on Windows, where there is no
 * equivalent login-shell PATH gap.
 *
 * @param command - The executable to run.
 * @param args - Arguments to pass to the executable.
 * @param opts - `child_process.execFile` options; `env` defaults to
 *   `process.env` so the re-exported `PATH` above has a base to restore from.
 * @returns The buffered result.
 */
export function execCommandViaLoginShell(
  command: string,
  args: readonly string[],
  opts: ExecFileOptions = {},
): Promise<BufferedCommandResult> {
  if (process.platform === "win32") return execFileBuffered(command, args, opts);
  // `/bin/sh` is POSIX-guaranteed to exist; unlike a specific shell (zsh,
  // bash), it is never absent on a POSIX host, so it is the only safe
  // default for a product-neutral engine that can't assume its host's shell.
  const shell = process.env.SHELL?.trim() || "/bin/sh";
  return execFileBuffered(shell, ["-c", buildLoginShellCommand(buildShellCommandLine(command, args))], {
    env: process.env,
    ...opts,
  });
}
