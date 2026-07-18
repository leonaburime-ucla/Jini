import { afterAll, describe, expect, it, vi } from 'vitest';

// This whole test file mocks node:os's homedir() to a fake, isolated temp
// location so `writeAntigravityModelSelection`'s default settingsPath
// parameter (derived from the real user's homedir) can be exercised safely,
// without ever touching this dev machine's real
// ~/.gemini/antigravity-cli/settings.json. Every other test in this file
// still passes an explicit settingsPath, so this mock only matters for the
// one "uses the default path" test below.
const mockState = vi.hoisted(() => ({
  fakeHome: `/tmp/agent-runtime-antigravity-test-home-${Date.now()}-${Math.random().toString(36).slice(2)}`,
}));

vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:os')>();
  return { ...actual, homedir: () => mockState.fakeHome };
});

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  _resetAntigravityModelLockForTests,
  acquireAntigravityModelLock,
  antigravityAgentDef,
  waitForAgyToReadModel,
  writeAntigravityModelSelection,
} from './antigravity.js';

afterAll(() => {
  rmSync(mockState.fakeHome, { recursive: true, force: true });
});

describe('antigravityAgentDef shape', () => {
  it('declares the expected identity and transport fields', () => {
    expect(antigravityAgentDef.id).toBe('antigravity');
    expect(antigravityAgentDef.bin).toBe('agy');
    expect(antigravityAgentDef.supportsCustomModel).toBe(false);
    expect(antigravityAgentDef.promptViaStdin).toBe(true);
    expect(antigravityAgentDef.streamFormat).toBe('plain');
    expect(antigravityAgentDef.fallbackModels[0]?.id).toBe('default');
  });
});

describe('writeAntigravityModelSelection', () => {
  function tempSettingsPath(): string {
    const dir = mkdtempSync(path.join(tmpdir(), 'agent-runtime-antigravity-write-test-'));
    return path.join(dir, 'nested', 'settings.json');
  }

  it('creates parent directories and writes {model} when no settings file exists yet', () => {
    const settingsPath = tempSettingsPath();
    writeAntigravityModelSelection('Gemini 3.1 Pro (High)', settingsPath);
    expect(existsSync(settingsPath)).toBe(true);
    expect(JSON.parse(readFileSync(settingsPath, 'utf8'))).toEqual({ model: 'Gemini 3.1 Pro (High)' });
  });

  it('merges the model key into existing valid JSON, preserving other keys', () => {
    const settingsPath = tempSettingsPath();
    mkdirSync(path.dirname(settingsPath), { recursive: true });
    writeFileSync(settingsPath, JSON.stringify({ otherSetting: 'keep-me', model: 'Old Model' }), 'utf8');

    writeAntigravityModelSelection('New Model', settingsPath);

    const written = JSON.parse(readFileSync(settingsPath, 'utf8'));
    expect(written).toEqual({ otherSetting: 'keep-me', model: 'New Model' });
  });

  it('falls back to a fresh object when the existing file is corrupt JSON', () => {
    const settingsPath = tempSettingsPath();
    mkdirSync(path.dirname(settingsPath), { recursive: true });
    writeFileSync(settingsPath, '{ not valid json', 'utf8');

    writeAntigravityModelSelection('Fresh Model', settingsPath);

    expect(JSON.parse(readFileSync(settingsPath, 'utf8'))).toEqual({ model: 'Fresh Model' });
  });

  it('falls back to a fresh object when the existing file parses to a JSON array', () => {
    const settingsPath = tempSettingsPath();
    mkdirSync(path.dirname(settingsPath), { recursive: true });
    writeFileSync(settingsPath, '[1,2,3]', 'utf8');

    writeAntigravityModelSelection('Array Case', settingsPath);

    expect(JSON.parse(readFileSync(settingsPath, 'utf8'))).toEqual({ model: 'Array Case' });
  });

  it('falls back to a fresh object when the existing file parses to a non-object primitive', () => {
    const settingsPath = tempSettingsPath();
    mkdirSync(path.dirname(settingsPath), { recursive: true });
    writeFileSync(settingsPath, '"just a string"', 'utf8');

    writeAntigravityModelSelection('Primitive Case', settingsPath);

    expect(JSON.parse(readFileSync(settingsPath, 'utf8'))).toEqual({ model: 'Primitive Case' });
  });

  it('uses the default (mocked homedir-derived) settingsPath when none is passed', () => {
    writeAntigravityModelSelection('Default Path Model');
    const expectedPath = path.join(mockState.fakeHome, '.gemini', 'antigravity-cli', 'settings.json');
    expect(existsSync(expectedPath)).toBe(true);
    expect(JSON.parse(readFileSync(expectedPath, 'utf8'))).toEqual({ model: 'Default Path Model' });
  });
});

describe('acquireAntigravityModelLock / _resetAntigravityModelLockForTests', () => {
  it('lets a fresh acquire proceed immediately when nothing is held', async () => {
    const release = await acquireAntigravityModelLock();
    expect(typeof release).toBe('function');
    release();
  });

  it('serializes a second acquire behind the first until it is released', async () => {
    const release1 = await acquireAntigravityModelLock();

    let acquired2 = false;
    const acquire2Promise = acquireAntigravityModelLock().then((release2) => {
      acquired2 = true;
      return release2;
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(acquired2).toBe(false);

    release1();
    const release2 = await acquire2Promise;
    expect(acquired2).toBe(true);
    release2();
  });

  it('_resetAntigravityModelLockForTests only affects the next fresh acquire, not one already in flight', async () => {
    const releaseA = await acquireAntigravityModelLock();

    let bAcquired = false;
    const acquireBPromise = acquireAntigravityModelLock().then((releaseB) => {
      bAcquired = true;
      return releaseB;
    });
    await Promise.resolve();
    expect(bAcquired).toBe(false);

    _resetAntigravityModelLockForTests();

    const releaseC = await acquireAntigravityModelLock();
    expect(bAcquired).toBe(false);
    releaseC();
    releaseA();
    const releaseB = await acquireBPromise;
    releaseB();
  });
});

describe('waitForAgyToReadModel', () => {
  it('returns false immediately without reading when the abort signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const readFile = vi.fn(async () => 'irrelevant');
    const result = await waitForAgyToReadModel('/fake/log', 'Model X', { abortSignal: controller.signal, readFile });
    expect(result).toBe(false);
    expect(readFile).not.toHaveBeenCalled();
  });

  it('returns true as soon as the log content matches the expected propagation line', async () => {
    const readFile = vi.fn(async () => 'Propagating selected model override to backend: label="Model X"');
    const result = await waitForAgyToReadModel('/fake/log', 'Model X', { readFile, pollIntervalMs: 5, timeoutMs: 1000 });
    expect(result).toBe(true);
    expect(readFile).toHaveBeenCalledWith('/fake/log');
  });

  it('escapes regex-special characters in the expected model label before matching', async () => {
    const readFile = vi.fn(async () => 'Propagating selected model override to backend: label="C++ (v1.2)"');
    const result = await waitForAgyToReadModel('/fake/log', 'C++ (v1.2)', {
      readFile,
      pollIntervalMs: 5,
      timeoutMs: 1000,
    });
    expect(result).toBe(true);
  });

  it('polls again when the log exists but does not yet match, then succeeds once it does', async () => {
    let call = 0;
    const readFile = vi.fn(async () => {
      call += 1;
      return call < 2 ? 'some unrelated log line' : 'Propagating selected model override to backend: label="Model X"';
    });
    const result = await waitForAgyToReadModel('/fake/log', 'Model X', { readFile, pollIntervalMs: 5, timeoutMs: 1000 });
    expect(result).toBe(true);
    expect(call).toBeGreaterThanOrEqual(2);
  });

  it('keeps polling without throwing when readFile rejects (e.g. log not yet created), and times out to false', async () => {
    const readFile = vi.fn(async () => {
      throw new Error('ENOENT: no such file');
    });
    const result = await waitForAgyToReadModel('/fake/log', 'Model X', { readFile, pollIntervalMs: 5, timeoutMs: 30 });
    expect(result).toBe(false);
  });

  it('breaks out of the loop immediately (skipping the sleep) once the deadline is reached right after a failed read', async () => {
    // Deterministic `now` sequence targeting the exact internal
    // `if (now() >= deadline) break;` guard (distinct from the outer
    // `while (now() < deadline)` loop condition): call 1 computes the
    // deadline, call 2 is the while-condition check that lets the loop
    // body run once, call 3 is the post-read deadline recheck that must
    // return >= deadline to hit the `break` line itself rather than
    // letting the outer while condition end the loop on the next pass.
    const nowValues = [0, 0, 10];
    let idx = 0;
    const now = () => (idx < nowValues.length ? nowValues[idx++]! : nowValues[nowValues.length - 1]!);
    const readFile = vi.fn(async () => {
      throw new Error('not there yet');
    });
    const result = await waitForAgyToReadModel('/fake/log', 'Model X', {
      readFile,
      pollIntervalMs: 1000,
      timeoutMs: 10,
      now,
    });
    expect(result).toBe(false);
    expect(readFile).toHaveBeenCalledTimes(1);
  });

  it('stops polling and returns false as soon as the abort signal fires mid-wait', async () => {
    const controller = new AbortController();
    const readFile = vi.fn(async () => {
      throw new Error('not yet');
    });
    const resultPromise = waitForAgyToReadModel('/fake/log', 'Model X', {
      readFile,
      pollIntervalMs: 50,
      timeoutMs: 5000,
      abortSignal: controller.signal,
    });
    setTimeout(() => controller.abort(), 10);
    const result = await resultPromise;
    expect(result).toBe(false);
  });

  it('uses the real fs readFile and Date.now by default when no readFile/now overrides are passed', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'agent-runtime-antigravity-waitlog-test-'));
    const logPath = path.join(dir, 'agy.log');
    writeFileSync(logPath, 'Propagating selected model override to backend: label="Model X"', 'utf8');
    try {
      const result = await waitForAgyToReadModel(logPath, 'Model X', { timeoutMs: 2000, pollIntervalMs: 20 });
      expect(result).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('uses fully-defaulted options (timeoutMs/pollIntervalMs omitted) when the file already matches on the first read', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'agent-runtime-antigravity-waitlog-defaults-test-'));
    const logPath = path.join(dir, 'agy.log');
    writeFileSync(logPath, 'Propagating selected model override to backend: label="Model X"', 'utf8');
    try {
      const result = await waitForAgyToReadModel(logPath, 'Model X');
      expect(result).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('antigravityAgentDef.buildArgs', () => {
  function tempSettingsPath(): string {
    const dir = mkdtempSync(path.join(tmpdir(), 'agent-runtime-antigravity-buildargs-test-'));
    return path.join(dir, 'settings.json');
  }

  it('writes the model selection and returns the base print-mode argv when a concrete model is chosen', () => {
    const settingsPath = tempSettingsPath();
    const args = antigravityAgentDef.buildArgs('hi', [], [], { model: 'Gemini 3.1 Pro (High)' }, {
      antigravitySettingsPath: settingsPath,
    });
    expect(args).toEqual(['-p', '-']);
    expect(JSON.parse(readFileSync(settingsPath, 'utf8'))).toEqual({ model: 'Gemini 3.1 Pro (High)' });
  });

  it('does not write a model selection when options.model is the "default" sentinel', () => {
    const settingsPath = tempSettingsPath();
    antigravityAgentDef.buildArgs('hi', [], [], { model: 'default' }, { antigravitySettingsPath: settingsPath });
    expect(existsSync(settingsPath)).toBe(false);
  });

  it('does not write a model selection when options.model is falsy/absent', () => {
    const settingsPath = tempSettingsPath();
    antigravityAgentDef.buildArgs('hi', [], [], {}, { antigravitySettingsPath: settingsPath });
    expect(existsSync(settingsPath)).toBe(false);
  });

  it('prepends --log-file <path> before -p - when agentLogFilePath is set', () => {
    const args = antigravityAgentDef.buildArgs('hi', [], [], {}, { agentLogFilePath: '/tmp/agy.log' });
    expect(args).toEqual(['--log-file', '/tmp/agy.log', '-p', '-']);
  });

  it('omits --log-file entirely when agentLogFilePath is absent', () => {
    const args = antigravityAgentDef.buildArgs('hi', [], [], {}, {});
    expect(args).toEqual(['-p', '-']);
  });

  it('defaults extraAllowedDirs/options/runtimeContext when omitted entirely', () => {
    expect(() => antigravityAgentDef.buildArgs('hi', [])).not.toThrow();
  });
});
