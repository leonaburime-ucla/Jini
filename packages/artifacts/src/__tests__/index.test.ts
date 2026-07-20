import { describe, expect, it } from 'vitest';
import * as artifacts from '../index.js';

describe('artifacts barrel', () => {
  it('re-exports the public surface of every artifacts module', () => {
    expect(typeof artifacts.validateArtifactManifestInput).toBe('function');
    expect(typeof artifacts.createInMemoryArtifactStore).toBe('function');
    expect(typeof artifacts.assertArtifactPublicationAllowed).toBe('function');
    expect(typeof artifacts.noopRuntimeCompatNormalizer).toBe('function');
    expect(typeof artifacts.evaluateArtifactStubGuard).toBe('function');
    expect(typeof artifacts.createXmlTagTextSuppressor).toBe('function');
  });
});
