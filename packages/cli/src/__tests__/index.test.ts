import { describe, expect, it } from 'vitest';
import * as jiniCli from '../index.js';

describe('@jini/cli barrel', () => {
  it('re-exports every module surface', () => {
    expect(typeof jiniCli.parseFlags).toBe('function');
    expect(typeof jiniCli.positionalArgs).toBe('function');
    expect(typeof jiniCli.resolveDaemonUrl).toBe('function');
    expect(typeof jiniCli.exitWithStructuredError).toBe('function');
    expect(typeof jiniCli.structuredHttpFailure).toBe('function');
    expect(typeof jiniCli.structuredErrorData).toBe('function');
    expect(jiniCli.DEFAULT_CLI_EXIT_CODES).toBeDefined();
    expect(typeof jiniCli.postJsonToDaemon).toBe('function');
    expect(typeof jiniCli.surfaceFetchError).toBe('function');
    expect(typeof jiniCli.readPromptFromFlags).toBe('function');
    expect(typeof jiniCli.sanitizeUntrustedText).toBe('function');
    expect(typeof jiniCli.renderUsage).toBe('function');
    expect(typeof jiniCli.CommandRegistry).toBe('function');
    expect(jiniCli.CommandRegistryToken).toBeDefined();
  });
});
