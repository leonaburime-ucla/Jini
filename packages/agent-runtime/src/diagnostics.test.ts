import { describe, expect, it } from 'vitest';
import { buildAuthDiagnostic, buildExecutableDiagnostic, buildNotInvocableDiagnostic } from './diagnostics.js';

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
});
