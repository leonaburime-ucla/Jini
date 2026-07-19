import { describe, expect, it } from 'vitest';
import * as barrel from '../index.js';

describe('@jini/capability-providers barrel completeness', () => {
  it('re-exports every reference provider factory', () => {
    expect(barrel.createInMemoryAuthProvider).toBeTypeOf('function');
    expect(barrel.createInMemoryStorageProvider).toBeTypeOf('function');
    expect(barrel.createInMemoryPaymentsProvider).toBeTypeOf('function');
    expect(barrel.createInMemoryDbProvider).toBeTypeOf('function');
    expect(barrel.createInMemoryRealtimeProvider).toBeTypeOf('function');
  });

  it('re-exports every token', () => {
    expect(barrel.AuthProviderToken.id).toBe('jini.capabilityProviders.auth');
    expect(barrel.StorageProviderToken.id).toBe('jini.capabilityProviders.storage');
    expect(barrel.PaymentsProviderToken.id).toBe('jini.capabilityProviders.payments');
    expect(barrel.DbProviderToken.id).toBe('jini.capabilityProviders.db');
    expect(barrel.RealtimeProviderToken.id).toBe('jini.capabilityProviders.realtime');
  });
});
