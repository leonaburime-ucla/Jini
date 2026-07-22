import { describe, expect, it } from 'vitest';
import { PayloadTooLargeError, readBodyFromFlags, readPromptFromFlags } from '../prompt.js';

describe('readPromptFromFlags', () => {
  it('returns --prompt verbatim when set', async () => {
    const result = await readPromptFromFlags({ prompt: 'hello' });
    expect(result).toBe('hello');
  });

  it('returns null when neither --prompt nor --prompt-file is set', async () => {
    const result = await readPromptFromFlags({});
    expect(result).toBeNull();
  });

  it('returns null for an empty --prompt-file value', async () => {
    const result = await readPromptFromFlags({ 'prompt-file': '' });
    expect(result).toBeNull();
  });

  it('reads from the injected readFile for a real path', async () => {
    const readFile = async (path: string) => `contents of ${path}`;
    const result = await readPromptFromFlags({ 'prompt-file': '/tmp/x.md' }, { readFile });
    expect(result).toBe('contents of /tmp/x.md');
  });

  it('reads from the injected readStdin for "-"', async () => {
    const readStdin = async () => 'stdin contents';
    const result = await readPromptFromFlags({ 'prompt-file': '-' }, { readStdin });
    expect(result).toBe('stdin contents');
  });

  it('prefers --prompt over --prompt-file', async () => {
    const readFile = async () => 'should not be read';
    const result = await readPromptFromFlags({ prompt: 'p', 'prompt-file': '/tmp/x.md' }, { readFile });
    expect(result).toBe('p');
  });

  it('treats an empty --prompt as unset and falls back to --prompt-file', async () => {
    const readFile = async () => 'from file';
    const result = await readPromptFromFlags({ prompt: '', 'prompt-file': '/tmp/x.md' }, { readFile });
    expect(result).toBe('from file');
  });

  it('uses the real node:fs/promises readFile by default', async () => {
    const { writeFile, mkdtemp, rm } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const dir = await mkdtemp(join(tmpdir(), 'jini-cli-prompt-'));
    const file = join(dir, 'prompt.txt');
    await writeFile(file, 'from real disk', 'utf8');
    try {
      const result = await readPromptFromFlags({ 'prompt-file': file });
      expect(result).toBe('from real disk');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('uses the real stdin reader by default when prompt-file is "-"', async () => {
    // Exercise the default readStdin factory without actually blocking on
    // stdin: stub process.stdin's event emitter to synchronously end.
    const { EventEmitter } = await import('node:events');
    const fakeStdin = new EventEmitter() as unknown as NodeJS.ReadStream;
    (fakeStdin as unknown as { setEncoding: (enc: string) => void }).setEncoding = () => {};
    const original = process.stdin;
    Object.defineProperty(process, 'stdin', { value: fakeStdin, configurable: true });
    try {
      const pending = readPromptFromFlags({ 'prompt-file': '-' });
      fakeStdin.emit('data', 'piped ');
      fakeStdin.emit('data', 'in');
      fakeStdin.emit('end');
      await expect(pending).resolves.toBe('piped in');
    } finally {
      Object.defineProperty(process, 'stdin', { value: original, configurable: true });
    }
  });

  it('rejects with PayloadTooLargeError when a --prompt-file exceeds maxBytes', async () => {
    const { writeFile, mkdtemp, rm } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const dir = await mkdtemp(join(tmpdir(), 'jini-cli-prompt-cap-'));
    const file = join(dir, 'prompt.txt');
    await writeFile(file, 'this is way more than five bytes', 'utf8');
    try {
      await expect(readPromptFromFlags({ 'prompt-file': file }, { maxBytes: 5 })).rejects.toThrow(
        PayloadTooLargeError,
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('rejects a --prompt-file read that is already aborted', async () => {
    const { writeFile, mkdtemp, rm } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const dir = await mkdtemp(join(tmpdir(), 'jini-cli-prompt-abort-'));
    const file = join(dir, 'prompt.txt');
    await writeFile(file, 'some content', 'utf8');
    try {
      const controller = new AbortController();
      controller.abort();
      await expect(readPromptFromFlags({ 'prompt-file': file }, { signal: controller.signal })).rejects.toThrow();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('rejects the default stdin reader once the byte cap is exceeded, mid-stream', async () => {
    const { EventEmitter } = await import('node:events');
    const fakeStdin = new EventEmitter() as unknown as NodeJS.ReadStream;
    (fakeStdin as unknown as { setEncoding: (enc: string) => void }).setEncoding = () => {};
    (fakeStdin as unknown as { pause: () => void }).pause = () => {};
    const original = process.stdin;
    Object.defineProperty(process, 'stdin', { value: fakeStdin, configurable: true });
    try {
      const pending = readPromptFromFlags({ 'prompt-file': '-' }, { maxBytes: 5 });
      fakeStdin.emit('data', 'way more than five bytes');
      await expect(pending).rejects.toThrow(PayloadTooLargeError);
    } finally {
      Object.defineProperty(process, 'stdin', { value: original, configurable: true });
    }
  });

  it('cancels the default stdin reader when the signal aborts mid-read', async () => {
    const { EventEmitter } = await import('node:events');
    const fakeStdin = new EventEmitter() as unknown as NodeJS.ReadStream;
    (fakeStdin as unknown as { setEncoding: (enc: string) => void }).setEncoding = () => {};
    (fakeStdin as unknown as { pause: () => void }).pause = () => {};
    const original = process.stdin;
    Object.defineProperty(process, 'stdin', { value: fakeStdin, configurable: true });
    try {
      const controller = new AbortController();
      const pending = readPromptFromFlags({ 'prompt-file': '-' }, { signal: controller.signal });
      fakeStdin.emit('data', 'partial ');
      controller.abort();
      await expect(pending).rejects.toThrow();
    } finally {
      Object.defineProperty(process, 'stdin', { value: original, configurable: true });
    }
  });
});

describe('readBodyFromFlags', () => {
  it('returns --body verbatim when set', async () => {
    const result = await readBodyFromFlags({ body: 'hello' });
    expect(result).toBe('hello');
  });

  it('treats an empty --body as provided (unlike readPromptFromFlags), short-circuiting before --body-file', async () => {
    const readFile = async () => 'should not be read';
    const result = await readBodyFromFlags({ body: '', 'body-file': '/tmp/x.md' }, { readFile });
    expect(result).toBe('');
  });

  it('returns undefined when neither --body nor --body-file is set', async () => {
    const result = await readBodyFromFlags({});
    expect(result).toBeUndefined();
  });

  it('reads from the injected readFile for a real path', async () => {
    const readFile = async (path: string) => `contents of ${path}`;
    const result = await readBodyFromFlags({ 'body-file': '/tmp/x.md' }, { readFile });
    expect(result).toBe('contents of /tmp/x.md');
  });

  it('reads an empty --body-file path via the injected readFile (no early return, unlike prompt)', async () => {
    const readFile = async (path: string) => `contents of "${path}"`;
    const result = await readBodyFromFlags({ 'body-file': '' }, { readFile });
    expect(result).toBe('contents of ""');
  });

  it('reads from the injected readStdin for "-"', async () => {
    const readStdin = async () => 'stdin contents';
    const result = await readBodyFromFlags({ 'body-file': '-' }, { readStdin });
    expect(result).toBe('stdin contents');
  });

  it('prefers --body over --body-file', async () => {
    const readFile = async () => 'should not be read';
    const result = await readBodyFromFlags({ body: 'b', 'body-file': '/tmp/x.md' }, { readFile });
    expect(result).toBe('b');
  });

  it('uses the real node:fs/promises readFile by default', async () => {
    const { writeFile, mkdtemp, rm } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const dir = await mkdtemp(join(tmpdir(), 'jini-cli-body-'));
    const file = join(dir, 'body.txt');
    await writeFile(file, 'from real disk', 'utf8');
    try {
      const result = await readBodyFromFlags({ 'body-file': file });
      expect(result).toBe('from real disk');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('uses the real async-iterator stdin reader by default when body-file is "-"', async () => {
    // Exercise the default readStdin factory without touching real stdin: stub
    // process.stdin as a minimal async-iterable yielding two chunks.
    const fakeStdin = {
      [Symbol.asyncIterator]: async function* () {
        yield 'piped ';
        yield 'in';
      },
    } as unknown as NodeJS.ReadStream;
    const original = process.stdin;
    Object.defineProperty(process, 'stdin', { value: fakeStdin, configurable: true });
    try {
      const result = await readBodyFromFlags({ 'body-file': '-' });
      expect(result).toBe('piped in');
    } finally {
      Object.defineProperty(process, 'stdin', { value: original, configurable: true });
    }
  });

  it('rejects with PayloadTooLargeError when a --body-file exceeds maxBytes', async () => {
    const { writeFile, mkdtemp, rm } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const dir = await mkdtemp(join(tmpdir(), 'jini-cli-body-cap-'));
    const file = join(dir, 'body.txt');
    await writeFile(file, 'this is way more than five bytes', 'utf8');
    try {
      await expect(readBodyFromFlags({ 'body-file': file }, { maxBytes: 5 })).rejects.toThrow(PayloadTooLargeError);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('rejects the default async-iterator stdin reader once the byte cap is exceeded', async () => {
    const fakeStdin = {
      [Symbol.asyncIterator]: async function* () {
        yield 'way ';
        yield 'more than five bytes';
      },
      destroy: () => {},
    } as unknown as NodeJS.ReadStream;
    const original = process.stdin;
    Object.defineProperty(process, 'stdin', { value: fakeStdin, configurable: true });
    try {
      await expect(readBodyFromFlags({ 'body-file': '-' }, { maxBytes: 5 })).rejects.toThrow(PayloadTooLargeError);
    } finally {
      Object.defineProperty(process, 'stdin', { value: original, configurable: true });
    }
  });

  it('cancels the default async-iterator stdin reader via an already-aborted signal', async () => {
    const fakeStdin = {
      [Symbol.asyncIterator]: async function* () {
        yield 'piped ';
        yield 'in';
      },
      destroy: () => {},
    } as unknown as NodeJS.ReadStream;
    const original = process.stdin;
    Object.defineProperty(process, 'stdin', { value: fakeStdin, configurable: true });
    try {
      const controller = new AbortController();
      controller.abort();
      await expect(readBodyFromFlags({ 'body-file': '-' }, { signal: controller.signal })).rejects.toThrow();
    } finally {
      Object.defineProperty(process, 'stdin', { value: original, configurable: true });
    }
  });
});
