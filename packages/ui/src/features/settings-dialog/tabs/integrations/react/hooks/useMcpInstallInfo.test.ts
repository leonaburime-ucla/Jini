import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createFakeMcpIntegrationsPort } from '../../dependencies.js';
import { useMcpInstallInfo } from './useMcpInstallInfo.js';

describe('useMcpInstallInfo', () => {
  it('starts loading and resolves info from the port', async () => {
    const port = createFakeMcpIntegrationsPort();
    const { result } = renderHook(() => useMcpInstallInfo(port));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.info?.command).toBeTruthy();
    expect(result.current.error).toBeNull();
  });

  it('surfaces a fetch rejection as a plain error message, not a throw', async () => {
    const port = { fetchInstallInfo: () => Promise.reject(new Error('daemon 500')) };
    const { result } = renderHook(() => useMcpInstallInfo(port));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('daemon 500');
    expect(result.current.info).toBeNull();
  });
});
