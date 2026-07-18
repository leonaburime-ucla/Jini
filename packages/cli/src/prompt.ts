/**
 * @module prompt
 *
 * The `--prompt <text>` / `--prompt-file <path>` / `--prompt-file -` (stdin)
 * convention, ported from OD's `apps/daemon/src/cli.ts` `readPromptFromFlags`
 * (see `source-map.md`). This exact pattern recurred verbatim across many of
 * OD's product commands (`brand create`, `run start`, `files version-create`,
 * `automation source ingest`, …) with zero product nouns in the reading
 * logic itself, which is what makes it a genuine reusable primitive rather
 * than a one-off helper worth leaving in each caller.
 */

export interface PromptFlags {
  prompt?: string;
  'prompt-file'?: string;
}

export interface ReadPromptFromFlagsOptions {
  /** Defaults to `node:fs/promises` `readFile(path, 'utf8')`; inject for tests. */
  readFile?: (path: string) => Promise<string>;
  /** Defaults to reading `process.stdin` to EOF as utf8; inject for tests. */
  readStdin?: () => Promise<string>;
}

/**
 * Resolve prompt text from `--prompt`, or `--prompt-file <path>` /
 * `--prompt-file -` (stdin). Returns `null` when neither flag is set so the
 * caller can fall back to its own default.
 */
export async function readPromptFromFlags(
  flags: PromptFlags,
  options: ReadPromptFromFlagsOptions = {},
): Promise<string | null> {
  if (typeof flags.prompt === 'string' && flags.prompt.length > 0) {
    return flags.prompt;
  }
  const promptFile = flags['prompt-file'];
  if (typeof promptFile !== 'string' || promptFile.length === 0) {
    return null;
  }
  if (promptFile === '-') {
    const readStdin = options.readStdin ?? defaultReadStdin;
    return await readStdin();
  }
  const readFile = options.readFile ?? defaultReadFile;
  return await readFile(promptFile);
}

async function defaultReadFile(path: string): Promise<string> {
  const { readFile } = await import('node:fs/promises');
  return await readFile(path, 'utf8');
}

async function defaultReadStdin(): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    let buffer = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk: string) => { buffer += chunk; });
    process.stdin.on('end', () => resolve(buffer));
    process.stdin.on('error', reject);
  });
}
