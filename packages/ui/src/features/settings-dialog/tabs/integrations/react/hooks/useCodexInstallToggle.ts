import { useCallback, useEffect, useState } from 'react';
import type { McpIntegrationsPort } from '../../ports.js';

export interface CodexInstallToggleController {
  /** `null` while the initial status fetch is in flight; `false` once
   *  resolved with no port support or the fetch failed. */
  available: boolean | null;
  installed: boolean;
  busy: boolean;
  error: string | null;
  toggle: () => void;
}

/**
 * One-click Codex MCP install/uninstall: queries whether the host's daemon
 * exposes Codex install support at all (`available`), and if so, whether
 * this server is currently registered (`installed`). Origin:
 * `CodexInstallToggle` in `SettingsDialog.tsx` — the daemon-transport calls
 * (`fetch('/api/mcp/install/codex...')`) are now routed through the
 * injected `McpIntegrationsPort`'s optional Codex methods.
 */
export function useCodexInstallToggle(
  port: Pick<McpIntegrationsPort, 'fetchCodexInstallStatus' | 'installCodexMcp' | 'uninstallCodexMcp'>,
): CodexInstallToggleController {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [installed, setInstalled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!port.fetchCodexInstallStatus) {
      setAvailable(false);
      setInstalled(false);
      return;
    }
    try {
      const status = await port.fetchCodexInstallStatus();
      setAvailable(status.available);
      setInstalled(status.installed);
    } catch {
      // Daemon unreachable or endpoint missing — hide the toggle entirely
      // rather than surface a permanent error for an optional feature.
      setAvailable(false);
      setInstalled(false);
    }
    // `port` is host-supplied once; re-creating this callback per render
    // would refetch on every parent re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const toggle = useCallback(() => {
    void (async () => {
      setBusy(true);
      setError(null);
      try {
        if (installed) {
          await port.uninstallCodexMcp?.();
        } else {
          await port.installCodexMcp?.();
        }
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [installed, refresh]);

  return { available, installed, busy, error, toggle };
}
