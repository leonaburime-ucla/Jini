import { describe, expect, it } from 'vitest';
import { buildAuthDiagnostic, buildExecutableDiagnostic, buildNotInvocableDiagnostic } from '../diagnostics.js';

describe('diagnostics', () => {
  it('buildExecutableDiagnostic reports not-on-path with fix actions when nothing is configured', () => {
    const diagnostic = buildExecutableDiagnostic({ id: 'claude', name: 'Claude Code', bin: 'claude' }, {});
    expect(diagnostic.reason).toBe('not-on-path');
    expect(diagnostic.severity).toBe('error');
    expect(diagnostic.fixActions).toEqual([
      { kind: 'openInstall' },
      { kind: 'setEnv', envKey: 'CLAUDE_BIN' },
      { kind: 'rescan' },
    ]);
  });

  it('buildExecutableDiagnostic reports configured-bin-invalid when a *_BIN override is set but bad', () => {
    const diagnostic = buildExecutableDiagnostic(
      { id: 'cursor-agent', name: 'Cursor Agent', bin: 'cursor-agent' },
      { CURSOR_AGENT_BIN: '/nonexistent/cursor-agent' },
    );
    expect(diagnostic.reason).toBe('configured-bin-invalid');
    expect(diagnostic.detail).toBe('/nonexistent/cursor-agent');
    expect(diagnostic.fixActions?.map((a) => a.kind)).toEqual(['setEnv', 'clearEnv', 'rescan']);
  });

  it('buildExecutableDiagnostic falls back to not-on-path for an agent id with no AGENT_BIN_ENV_KEYS entry, even with configuredEnv set', () => {
    const diagnostic = buildExecutableDiagnostic(
      { id: 'not-a-registered-agent-id', name: 'Mystery Agent', bin: 'mystery' },
      { SOME_OTHER_VAR: 'x' },
    );
    expect(diagnostic.reason).toBe('not-on-path');
    // No envKey for this id, so setEnvIntent() contributes nothing.
    expect(diagnostic.fixActions).toEqual([{ kind: 'openInstall' }, { kind: 'rescan' }]);
  });

  it('buildExecutableDiagnostic falls back to not-on-path when the configured override is blank', () => {
    const diagnostic = buildExecutableDiagnostic(
      { id: 'cursor-agent', name: 'Cursor Agent', bin: 'cursor-agent' },
      { CURSOR_AGENT_BIN: '   ' },
    );
    expect(diagnostic.reason).toBe('not-on-path');
  });

  it('buildExecutableDiagnostic caps searchedDirs at MAX_SEARCHED_DIRS', () => {
    const diagnostic = buildExecutableDiagnostic({ id: 'claude', name: 'Claude Code', bin: 'claude' }, {});
    expect(diagnostic.searchedDirs!.length).toBeLessThanOrEqual(24);
  });

  it('buildNotInvocableDiagnostic distinguishes not-executable from a broken shim', () => {
    const notExecutable = buildNotInvocableDiagnostic(
      { id: 'claude', name: 'Claude Code' },
      { selectedPath: '/usr/local/bin/claude', launchPath: '/usr/local/bin/claude' },
      'not-executable',
    );
    expect(notExecutable.reason).toBe('not-executable');

    const brokenShim = buildNotInvocableDiagnostic(
      { id: 'claude', name: 'Claude Code' },
      { selectedPath: '/usr/local/bin/claude', launchPath: '/usr/local/bin/claude' },
      'missing-target',
    );
    expect(brokenShim.reason).toBe('shim-broken');
    expect(brokenShim.fixActions?.some((a) => a.kind === 'openDocs')).toBe(true);
  });

  it('buildNotInvocableDiagnostic omits detail when launchPath is falsy', () => {
    const notExecutable = buildNotInvocableDiagnostic(
      { id: 'claude', name: 'Claude Code' },
      { selectedPath: null, launchPath: null },
      'not-executable',
    );
    expect(notExecutable.detail).toBeUndefined();

    const brokenShim = buildNotInvocableDiagnostic(
      { id: 'claude', name: 'Claude Code' },
      { selectedPath: null, launchPath: null },
      'missing-target',
    );
    expect(brokenShim.detail).toBeUndefined();
  });

  it('buildNotInvocableDiagnostic still includes setEnvIntent for an agent with a registered *_BIN key', () => {
    const notExecutable = buildNotInvocableDiagnostic(
      { id: 'claude', name: 'Claude Code' },
      { selectedPath: '/bin/claude', launchPath: '/bin/claude' },
      'not-executable',
    );
    expect(notExecutable.fixActions?.some((a) => a.kind === 'setEnv')).toBe(true);
  });

  it('buildNotInvocableDiagnostic omits setEnvIntent for an agent with no registered *_BIN key', () => {
    const notExecutable = buildNotInvocableDiagnostic(
      { id: 'not-a-registered-agent-id', name: 'Mystery Agent' },
      { selectedPath: '/bin/mystery', launchPath: '/bin/mystery' },
      'not-executable',
    );
    expect(notExecutable.fixActions?.map((a) => a.kind)).toEqual(['rescan']);
  });

  it('buildAuthDiagnostic returns null for an ok auth status', () => {
    expect(buildAuthDiagnostic({ id: 'claude', name: 'Claude Code' }, { status: 'ok' })).toBeNull();
  });

  it('buildAuthDiagnostic surfaces a missing-auth error with the probe message', () => {
    const diagnostic = buildAuthDiagnostic(
      { id: 'claude', name: 'Claude Code' },
      { status: 'missing', message: 'Please sign in.', stderrTail: 'not authenticated' },
    );
    expect(diagnostic?.reason).toBe('auth-missing');
    expect(diagnostic?.severity).toBe('error');
    expect(diagnostic?.message).toBe('Please sign in.');
    expect(diagnostic?.detail).toBe('not authenticated');
  });

  it('buildAuthDiagnostic surfaces an unknown auth status as a warning', () => {
    const diagnostic = buildAuthDiagnostic({ id: 'claude', name: 'Claude Code' }, { status: 'unknown' });
    expect(diagnostic?.reason).toBe('auth-unknown');
    expect(diagnostic?.severity).toBe('warning');
  });

  it('buildAuthDiagnostic falls back to a default message when auth.message is absent (missing)', () => {
    const diagnostic = buildAuthDiagnostic({ id: 'claude', name: 'Claude Code' }, { status: 'missing' });
    expect(diagnostic?.message).toBe('Claude Code is installed but not authenticated.');
  });

  it('buildAuthDiagnostic falls back to a default message when auth.message is absent (unknown)', () => {
    const diagnostic = buildAuthDiagnostic({ id: 'claude', name: 'Claude Code' }, { status: 'unknown' });
    expect(diagnostic?.message).toBe('Claude Code authentication status could not be verified.');
  });

  it('buildAuthDiagnostic omits detail when stderrTail is absent', () => {
    const diagnostic = buildAuthDiagnostic({ id: 'claude', name: 'Claude Code' }, { status: 'missing', message: 'x' });
    expect(diagnostic?.detail).toBeUndefined();
  });

  it('buildAuthDiagnostic includes detail for an unknown status with a stderrTail', () => {
    const diagnostic = buildAuthDiagnostic(
      { id: 'claude', name: 'Claude Code' },
      { status: 'unknown', stderrTail: 'some probe stderr' },
    );
    expect(diagnostic?.detail).toBe('some probe stderr');
  });

  it('buildAuthDiagnostic always includes an openDocs + rescan fix action pair', () => {
    const diagnostic = buildAuthDiagnostic({ id: 'claude', name: 'Claude Code' }, { status: 'missing', message: 'x' });
    expect(diagnostic?.fixActions).toEqual([{ kind: 'openDocs' }, { kind: 'rescan' }]);
  });
});
