import { afterEach, describe, expect, it } from 'vitest';
import { codexAgentDef, codexNeedsDangerFullAccessSandbox, parseCodexDebugModels } from '../codex.js';

describe('codexAgentDef shape', () => {
  it('declares the expected identity and transport fields', () => {
    expect(codexAgentDef.id).toBe('codex');
    expect(codexAgentDef.bin).toBe('codex');
    expect(codexAgentDef.promptViaStdin).toBe(true);
    expect(codexAgentDef.resumesSessionViaCli).toBe(true);
    expect(codexAgentDef.capturesSessionIdFromStream).toBe(true);
    expect(codexAgentDef.streamFormat).toBe('json-event-stream');
    expect(codexAgentDef.eventParser).toBe('codex');
    expect(codexAgentDef.listModels).toEqual({ args: ['debug', 'models'], parse: parseCodexDebugModels, timeoutMs: 5000 });
    expect(codexAgentDef.authProbe).toEqual({ args: ['login', 'status'], timeoutMs: 5000 });
    expect(codexAgentDef.reasoningOptions?.map((r) => r.id)).toEqual([
      'default',
      'none',
      'minimal',
      'low',
      'medium',
      'high',
      'xhigh',
    ]);
  });
});

describe('parseCodexDebugModels', () => {
  it('returns null for unparseable JSON', () => {
    expect(parseCodexDebugModels('not json')).toBeNull();
  });

  it('returns null for empty stdout / falsy input', () => {
    expect(parseCodexDebugModels('')).toBeNull();
  });

  it('returns null when the parsed JSON is not an object', () => {
    expect(parseCodexDebugModels('42')).toBeNull();
    expect(parseCodexDebugModels('null')).toBeNull();
    expect(parseCodexDebugModels('"a string"')).toBeNull();
  });

  it('returns null when .models is missing or not an array', () => {
    expect(parseCodexDebugModels(JSON.stringify({}))).toBeNull();
    expect(parseCodexDebugModels(JSON.stringify({ models: 'nope' }))).toBeNull();
  });

  it('skips non-object entries in the models array', () => {
    const result = parseCodexDebugModels(JSON.stringify({ models: [null, 42, 'str', { slug: 'gpt-5' }] }));
    expect(result?.map((m) => m.id)).toEqual(['default', 'gpt-5']);
  });

  it('skips entries with visibility: "hidden"', () => {
    const result = parseCodexDebugModels(
      JSON.stringify({ models: [{ slug: 'gpt-5', visibility: 'hidden' }, { slug: 'gpt-5.1' }] }),
    );
    expect(result?.map((m) => m.id)).toEqual(['default', 'gpt-5.1']);
  });

  it('uses .id when .slug is absent, and skips an entry with neither', () => {
    const result = parseCodexDebugModels(JSON.stringify({ models: [{ id: 'o3' }, { display_name: 'no id here' }] }));
    expect(result?.map((m) => m.id)).toEqual(['default', 'o3']);
  });

  it('skips entries whose id/slug trims to empty', () => {
    const result = parseCodexDebugModels(JSON.stringify({ models: [{ slug: '   ' }, { slug: 'gpt-5' }] }));
    expect(result?.map((m) => m.id)).toEqual(['default', 'gpt-5']);
  });

  it('de-duplicates repeated ids, including against the synthetic default id', () => {
    const result = parseCodexDebugModels(
      JSON.stringify({ models: [{ slug: 'default' }, { slug: 'gpt-5' }, { slug: 'gpt-5' }] }),
    );
    expect(result?.map((m) => m.id)).toEqual(['default', 'gpt-5']);
  });

  it('prefers display_name for the label, then name, then falls back to the id', () => {
    const result = parseCodexDebugModels(
      JSON.stringify({
        models: [
          { slug: 'a', display_name: 'Display A' },
          { slug: 'b', name: 'Name B' },
          { slug: 'c' },
          { slug: 'd', display_name: '   ' },
          { slug: 'e', display_name: '   ', name: 'Name E' },
        ],
      }),
    );
    expect(result).toEqual([
      { id: 'default', label: 'Default (CLI config)' },
      { id: 'a', label: 'Display A' },
      { id: 'b', label: 'Name B' },
      { id: 'c', label: 'c' },
      { id: 'd', label: 'd' },
      { id: 'e', label: 'Name E' },
    ]);
  });

  it('returns null when every model entry is filtered out (only the synthetic default would remain)', () => {
    expect(parseCodexDebugModels(JSON.stringify({ models: [{ visibility: 'hidden', slug: 'x' }] }))).toBeNull();
    expect(parseCodexDebugModels(JSON.stringify({ models: [] }))).toBeNull();
  });
});

describe('codexNeedsDangerFullAccessSandbox', () => {
  it('returns true when CODEX_SANDBOX_MODE is "danger-full-access"', () => {
    expect(codexNeedsDangerFullAccessSandbox('darwin', { CODEX_SANDBOX_MODE: 'danger-full-access' })).toBe(true);
  });

  it('ignores CODEX_SANDBOX_MODE values other than the exact accepted string', () => {
    expect(codexNeedsDangerFullAccessSandbox('darwin', { CODEX_SANDBOX_MODE: 'workspace-write' })).toBe(false);
  });

  it('trims whitespace around CODEX_SANDBOX_MODE before comparing', () => {
    expect(codexNeedsDangerFullAccessSandbox('darwin', { CODEX_SANDBOX_MODE: '  danger-full-access  ' })).toBe(true);
  });

  it('returns true unconditionally on win32', () => {
    expect(codexNeedsDangerFullAccessSandbox('win32', {})).toBe(true);
  });

  it('returns true on linux when WSL_DISTRO_NAME is a non-empty env var (WSL detection)', () => {
    expect(codexNeedsDangerFullAccessSandbox('linux', { WSL_DISTRO_NAME: 'Ubuntu' })).toBe(true);
  });

  it('returns false on linux when WSL_DISTRO_NAME is absent', () => {
    expect(codexNeedsDangerFullAccessSandbox('linux', {})).toBe(false);
  });

  it('returns false on linux when WSL_DISTRO_NAME is present but blank/whitespace-only', () => {
    expect(codexNeedsDangerFullAccessSandbox('linux', { WSL_DISTRO_NAME: '   ' })).toBe(false);
  });

  it('returns false on darwin with no overrides and no WSL marker', () => {
    expect(codexNeedsDangerFullAccessSandbox('darwin', {})).toBe(false);
  });

  it('defaults platform/env to the real process.platform/process.env when omitted', () => {
    // Just prove it does not throw and returns a boolean using live process state.
    expect(typeof codexNeedsDangerFullAccessSandbox()).toBe('boolean');
  });
});

describe('codexAgentDef.buildArgs', () => {
  const originalPlatform = process.platform;
  const originalWsl = process.env.WSL_DISTRO_NAME;
  const originalSandboxMode = process.env.CODEX_SANDBOX_MODE;
  const originalDisablePlugins = process.env.CODEX_DISABLE_PLUGINS;

  function setPlatform(platform: NodeJS.Platform) {
    Object.defineProperty(process, 'platform', { value: platform });
  }

  afterEach(() => {
    setPlatform(originalPlatform);
    if (originalWsl === undefined) delete process.env.WSL_DISTRO_NAME;
    else process.env.WSL_DISTRO_NAME = originalWsl;
    if (originalSandboxMode === undefined) delete process.env.CODEX_SANDBOX_MODE;
    else process.env.CODEX_SANDBOX_MODE = originalSandboxMode;
    if (originalDisablePlugins === undefined) delete process.env.CODEX_DISABLE_PLUGINS;
    else process.env.CODEX_DISABLE_PLUGINS = originalDisablePlugins;
  });

  it('builds a fresh (non-resume) turn with workspace-write sandbox on a non-Windows/non-WSL host', () => {
    setPlatform('darwin');
    delete process.env.WSL_DISTRO_NAME;
    delete process.env.CODEX_SANDBOX_MODE;
    const args = codexAgentDef.buildArgs('hi', [], [], {}, { cwd: '/proj' });
    expect(args).toEqual([
      'exec',
      '--json',
      '--skip-git-repo-check',
      '--sandbox',
      'workspace-write',
      '-c',
      'sandbox_workspace_write.network_access=true',
      '-C',
      '/proj',
    ]);
  });

  it('uses danger-full-access sandbox on win32 for a fresh turn', () => {
    setPlatform('win32');
    const args = codexAgentDef.buildArgs('hi', [], []);
    expect(args).toContain('--sandbox');
    expect(args[args.indexOf('--sandbox') + 1]).toBe('danger-full-access');
  });

  it('uses -c sandbox_mode="danger-full-access" (not --sandbox) on a resume turn under WSL/win32', () => {
    setPlatform('win32');
    const args = codexAgentDef.buildArgs('hi', [], [], {}, { resumeSessionId: 'thread-1' });
    expect(args).not.toContain('--sandbox');
    expect(args).toContain('sandbox_mode="danger-full-access"');
  });

  it('uses -c sandbox_mode="workspace-write" plus network_access on a resume turn on a normal host', () => {
    setPlatform('darwin');
    delete process.env.WSL_DISTRO_NAME;
    const args = codexAgentDef.buildArgs('hi', [], [], {}, { resumeSessionId: 'thread-1' });
    expect(args).not.toContain('--sandbox');
    expect(args).toContain('sandbox_mode="workspace-write"');
    expect(args).toContain('sandbox_workspace_write.network_access=true');
  });

  it('uses "exec resume" with the thread id as the trailing positional when resumeSessionId is set', () => {
    setPlatform('darwin');
    const args = codexAgentDef.buildArgs('hi', [], [], {}, { resumeSessionId: 'thread-xyz' });
    expect(args.slice(0, 2)).toEqual(['exec', 'resume']);
    expect(args[args.length - 1]).toBe('thread-xyz');
  });

  it('uses plain "exec" (no resume) when resumeSessionId is an empty string', () => {
    setPlatform('darwin');
    const args = codexAgentDef.buildArgs('hi', [], [], {}, { resumeSessionId: '' });
    expect(args[0]).toBe('exec');
    expect(args[1]).not.toBe('resume');
  });

  it('does NOT append -C/--add-dir on a resume turn even if cwd/extraAllowedDirs are set', () => {
    setPlatform('darwin');
    const args = codexAgentDef.buildArgs('hi', [], ['/extra'], {}, { resumeSessionId: 'thread-1', cwd: '/proj' });
    expect(args).not.toContain('-C');
    expect(args).not.toContain('--add-dir');
  });

  it('omits -C when runtimeContext.cwd is absent on a fresh turn', () => {
    setPlatform('darwin');
    const args = codexAgentDef.buildArgs('hi', [], [], {}, {});
    expect(args).not.toContain('-C');
  });

  it('appends one --add-dir per non-empty string dir on a fresh turn, filtering blanks', () => {
    setPlatform('darwin');
    const args = codexAgentDef.buildArgs('hi', [], ['/a', '', '/b']);
    const dirFlags = args.reduce<string[]>((acc, v, i) => (v === '--add-dir' ? [...acc, args[i + 1]!] : acc), []);
    expect(dirFlags).toEqual(['/a', '/b']);
  });

  it('tolerates an explicit null extraAllowedDirs on a fresh turn (the `|| []` fallback, distinct from the default param)', () => {
    setPlatform('darwin');
    const args = codexAgentDef.buildArgs('hi', [], null as unknown as string[]);
    expect(args).not.toContain('--add-dir');
  });

  it('adds --model <id> for a concrete model selection', () => {
    setPlatform('darwin');
    const args = codexAgentDef.buildArgs('hi', [], [], { model: 'gpt-5' });
    expect(args).toContain('--model');
    expect(args[args.indexOf('--model') + 1]).toBe('gpt-5');
  });

  it('omits --model for the "default" sentinel and when falsy', () => {
    setPlatform('darwin');
    expect(codexAgentDef.buildArgs('hi', [], [], { model: 'default' })).not.toContain('--model');
    expect(codexAgentDef.buildArgs('hi', [], [], { model: '' })).not.toContain('--model');
  });

  it('adds a -c model_reasoning_effort override for a concrete reasoning selection (clamped via clampCodexReasoning)', () => {
    setPlatform('darwin');
    const args = codexAgentDef.buildArgs('hi', [], [], { model: 'gpt-5', reasoning: 'high' });
    expect(args).toContain('model_reasoning_effort="high"');
  });

  it('omits the reasoning-effort override for the "default" sentinel and when falsy', () => {
    setPlatform('darwin');
    expect(codexAgentDef.buildArgs('hi', [], [], { reasoning: 'default' }).join(' ')).not.toContain(
      'model_reasoning_effort',
    );
    expect(codexAgentDef.buildArgs('hi', [], [], { reasoning: '' }).join(' ')).not.toContain('model_reasoning_effort');
  });

  it('adds --disable plugins when CODEX_DISABLE_PLUGINS=1', () => {
    setPlatform('darwin');
    process.env.CODEX_DISABLE_PLUGINS = '1';
    const args = codexAgentDef.buildArgs('hi', [], []);
    expect(args).toContain('--disable');
    expect(args[args.indexOf('--disable') + 1]).toBe('plugins');
  });

  it('omits --disable plugins when CODEX_DISABLE_PLUGINS is unset or not "1"', () => {
    setPlatform('darwin');
    delete process.env.CODEX_DISABLE_PLUGINS;
    expect(codexAgentDef.buildArgs('hi', [], [])).not.toContain('--disable');
    process.env.CODEX_DISABLE_PLUGINS = '0';
    expect(codexAgentDef.buildArgs('hi', [], [])).not.toContain('--disable');
  });

  it('defaults extraAllowedDirs/options/runtimeContext when omitted entirely', () => {
    setPlatform('darwin');
    expect(() => codexAgentDef.buildArgs('hi', [])).not.toThrow();
  });
});
