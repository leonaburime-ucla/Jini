import { describe, expect, it, vi } from 'vitest';
import {
  syncWindowsUninstallDisplayVersion,
  windowsUninstallDisplayVersionRegistryArgs,
  windowsUninstallRegistryQueryArgs,
} from './windows-registry.js';

describe('syncWindowsUninstallDisplayVersion', () => {
  it('is a no-op on non-Windows platforms', async () => {
    const exec = vi.fn();
    const result = await syncWindowsUninstallDisplayVersion({
      resolveUninstallRegistryKey: (ns) => `Software\\Jini\\${ns}`,
      namespace: 'stable',
      version: '1.2.3',
      exec,
      platform: 'darwin',
    });
    expect(result).toBe(false);
    expect(exec).not.toHaveBeenCalled();
  });

  it('is a no-op with no version', async () => {
    const exec = vi.fn();
    const result = await syncWindowsUninstallDisplayVersion({
      resolveUninstallRegistryKey: (ns) => `Software\\Jini\\${ns}`,
      namespace: 'stable',
      version: null,
      exec,
      platform: 'win32',
    });
    expect(result).toBe(false);
    expect(exec).not.toHaveBeenCalled();
  });

  it('queries then writes the registry key when the uninstall entry exists', async () => {
    const exec = vi.fn().mockResolvedValue(undefined);
    const result = await syncWindowsUninstallDisplayVersion({
      resolveUninstallRegistryKey: (ns) => `Software\\Jini\\${ns}`,
      namespace: 'stable',
      version: '1.2.3',
      exec,
      platform: 'win32',
    });
    expect(result).toBe(true);
    expect(exec).toHaveBeenCalledTimes(2);
    expect(exec).toHaveBeenNthCalledWith(1, 'reg.exe', windowsUninstallRegistryQueryArgs('Software\\Jini\\stable'), { windowsHide: true });
    expect(exec).toHaveBeenNthCalledWith(
      2,
      'reg.exe',
      windowsUninstallDisplayVersionRegistryArgs('Software\\Jini\\stable', '1.2.3'),
      { windowsHide: true },
    );
  });

  it('returns false without writing when the uninstall entry does not exist', async () => {
    const exec = vi.fn().mockRejectedValue(new Error('not found'));
    const result = await syncWindowsUninstallDisplayVersion({
      resolveUninstallRegistryKey: (ns) => `Software\\Jini\\${ns}`,
      namespace: 'stable',
      version: '1.2.3',
      exec,
      platform: 'win32',
    });
    expect(result).toBe(false);
    expect(exec).toHaveBeenCalledTimes(1);
  });
});
