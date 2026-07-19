/**
 * @module prompt
 *
 * Long-form text intake shared across CLI domains: two sibling conventions
 * for reading a large piece of text from an inline flag, a `--*-file <path>`
 * flag, or stdin (`-`).
 *
 * `readPromptFromFlags` is the `--prompt <text>` / `--prompt-file <path>` /
 * `--prompt-file -` convention, ported from OD's `apps/daemon/src/cli.ts`
 * `readPromptFromFlags` (see `source-map.md`). This exact pattern recurred
 * verbatim across many of OD's product commands (`brand create`, `run
 * start`, `files version-create`, `automation source ingest`, …) with zero
 * product nouns in the reading logic itself, which is what makes it a
 * genuine reusable primitive rather than a one-off helper worth leaving in
 * each caller.
 *
 * `readBodyFromFlags` is the sibling `--body`/`--body-file` convention,
 * ported from the `cli-capability-barrels` branch's `cli/core/io.ts`
 * `readMemoryBodyFromFlags` (see `source-map.md`'s "Barrel branch
 * reconciliation" section). Despite the origin name, it has no memory-domain
 * coupling — that module's own docblock confirms it is reused verbatim by
 * both the memory and automation domains — so it is ported here under a
 * de-branded name alongside its prompt sibling.
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

export interface BodyFlags {
  body?: string;
  'body-file'?: string;
}

export interface ReadBodyFromFlagsOptions {
  /** Defaults to `node:fs/promises` `readFile(path, 'utf8')`; inject for tests. */
  readFile?: (path: string) => Promise<string>;
  /** Defaults to draining `process.stdin`'s async iterator as utf8; inject for tests. */
  readStdin?: () => Promise<string>;
}

/**
 * Resolve long-form body text from `--body` (inline — an empty string counts
 * as provided) or `--body-file <path>` / `--body-file -` (stdin). Returns
 * `undefined` when neither flag is present, so callers can distinguish "not
 * provided" from an intentionally empty body — unlike {@link
 * readPromptFromFlags}, which treats an empty `--prompt` as unset, this
 * primitive's origin caller (`od memory tree edit`) needs to allow clearing
 * a body to an empty string.
 */
export async function readBodyFromFlags(
  flags: BodyFlags,
  options: ReadBodyFromFlagsOptions = {},
): Promise<string | undefined> {
  if (typeof flags.body === 'string') return flags.body;
  const bodyFile = flags['body-file'];
  if (typeof bodyFile !== 'string') return undefined;
  if (bodyFile === '-') {
    const readStdin = options.readStdin ?? defaultReadBodyStdin;
    return await readStdin();
  }
  const readFile = options.readFile ?? defaultReadFile;
  return await readFile(bodyFile);
}

async function defaultReadBodyStdin(): Promise<string> {
  let body = '';
  for await (const chunk of process.stdin) {
    body += chunk;
  }
  return body;
}
