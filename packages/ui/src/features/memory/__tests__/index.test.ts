// Smoke test for this feature's own public barrel — every other test in this
// suite imports the concrete modules directly (`./dependencies.js`,
// `./rules.js`, etc.), so nothing else ever actually loads `index.ts` itself.
// Mirrors the package-level `src/index.test.ts`'s completeness check, scoped
// to this one feature's barrel.
import { describe, expect, it } from 'vitest';
import * as barrel from '../index.js';

describe('features/memory barrel (index.ts)', () => {
  it('re-exports the ports, dependencies, rules, constants, and formatters', () => {
    expect(typeof barrel.memoryConfigPort).toBe('object');
    expect(typeof barrel.memoryEntriesPort).toBe('object');
    expect(typeof barrel.memoryExtractionsPort).toBe('object');
    expect(typeof barrel.memoryConnectorsPort).toBe('object');
    expect(typeof barrel.createFakeMemoryConnectorsPort).toBe('function');
    expect(typeof barrel.fetchMemoryList).toBe('function');
    expect(typeof barrel.enabledPatch).toBe('function');
    expect(typeof barrel.singleFlagPatch).toBe('function');
    expect(typeof barrel.visibleExtractionsFor).toBe('function');
    expect(typeof barrel.upsertMemoryConnector).toBe('function');
    expect(typeof barrel.applyMemoryConnectorStatus).toBe('function');
    expect(typeof barrel.connectorWithPendingAuthorization).toBe('function');
    expect(typeof barrel.memoryEntryIdForConnectorSuggestion).toBe('function');
    expect(Array.isArray(barrel.TYPES)).toBe(true);
    expect(Array.isArray(barrel.STARTERS)).toBe(true);
    expect(typeof barrel.describeRecord).toBe('function');
    expect(typeof barrel.memorySourceTabs).toBe('function');
    expect(typeof barrel.createAsyncCommitGuard).toBe('function');
  });

  it('re-exports every feature-local hook', () => {
    expect(typeof barrel.useMemoryFlash).toBe('function');
    expect(typeof barrel.useMemoryNavigation).toBe('function');
    expect(typeof barrel.useMemoryConfig).toBe('function');
    expect(typeof barrel.useWiredMemoryConfig).toBe('function');
    expect(typeof barrel.useMemoryEntries).toBe('function');
    expect(typeof barrel.useWiredMemoryEntries).toBe('function');
    expect(typeof barrel.useMemoryExtractions).toBe('function');
    expect(typeof barrel.useWiredMemoryExtractions).toBe('function');
    expect(typeof barrel.useMemoryConnectors).toBe('function');
    expect(typeof barrel.useWiredMemoryConnectors).toBe('function');
  });

  it('re-exports every dumb component', () => {
    expect(typeof barrel.MemoryHooksPanel).toBe('function');
    expect(typeof barrel.MemoryHowPanel).toBe('function');
    expect(typeof barrel.MemoryEntryCard).toBe('function');
    expect(typeof barrel.MemoryExtractionCard).toBe('function');
    expect(typeof barrel.MemoryList).toBe('function');
    expect(typeof barrel.MemoryAdvancedModal).toBe('function');
    expect(typeof barrel.MemoryManualEditor).toBe('function');
    expect(typeof barrel.MemoryConnectedPanel).toBe('function');
  });
});
