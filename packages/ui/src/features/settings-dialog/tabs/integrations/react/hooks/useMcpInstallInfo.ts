import { useEffect, useState } from 'react';
import type { McpIntegrationsPort } from '../../ports.js';
import type { McpInstallInfo } from '../../types.js';

export interface McpInstallInfoController {
  info: McpInstallInfo | null;
  error: string | null;
  loading: boolean;
}

/**
 * Fetches `McpInstallInfo` once on mount via the injected port. Errors
 * surface as a plain message string (not thrown) so the tab can render a
 * clear inline error instead of a half-built snippet that would silently
 * fail when pasted.
 */
export function useMcpInstallInfo(port: Pick<McpIntegrationsPort, 'fetchInstallInfo'>): McpInstallInfoController {
  const [info, setInfo] = useState<McpInstallInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    port
      .fetchInstallInfo()
      .then((data) => {
        if (cancelled) return;
        setInfo(data);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // `port` is expected to be a stable dependency (host-supplied once);
    // re-running on every render would refetch on every parent re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { info, error, loading };
}
