import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';

/**
 * Injectable bridge for a native (e.g. Electron) shell that can save the
 * exported archive via a native save dialog. When not supplied, the button
 * falls back to a browser download via `exportPath`.
 */
export interface DesktopExportBridge {
  exportDiagnostics(): Promise<
    | { ok: true; path: string }
    | { ok: false; cancelled: true }
    | { ok: false; cancelled: false; message: string }
  >;
}

const STATUS_CLEAR_MS = 6000;

type Status =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string };

function fileNameFromHeader(header: string | null): string | null {
  if (header == null) return null;
  const match = /filename\*=UTF-8''([^;\n]+)|filename="([^"]+)"|filename=([^;\n]+)/i.exec(header);
  if (match == null) return null;
  // Non-null: the regex's three alternatives are mutually exclusive and each
  // requires >=1 captured char, so a successful match always populates
  // exactly one of these three groups.
  const raw = (match[1] ?? match[2] ?? match[3])!;
  try {
    return decodeURIComponent(raw.trim());
  } catch {
    return raw.trim();
  }
}

function fallbackFilename(prefix: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${prefix}-${stamp}.zip`;
}

async function exportViaHttp(exportPath: string, filenamePrefix: string): Promise<{ filename: string }> {
  const res = await fetch(exportPath, { credentials: 'same-origin' });
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body && typeof body.message === 'string') message = body.message;
    } catch {
      // ignore body parse errors
    }
    throw new Error(message);
  }
  const blob = await res.blob();
  const filename = fileNameFromHeader(res.headers.get('content-disposition')) ?? fallbackFilename(filenamePrefix);
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
  return { filename };
}

export interface ExportDiagnosticsButtonProps {
  /** HTTP endpoint used when no `desktopBridge` is supplied. */
  exportPath?: string;
  /** Filename prefix for the browser-download fallback. */
  filenamePrefix?: string;
  /** Native-shell export bridge (e.g. Electron's contextBridge API). When
   *  present, used instead of the HTTP fallback. */
  desktopBridge?: DesktopExportBridge;
  labels?: Partial<{
    button: string;
    exporting: string;
    success: (path: string) => string;
    failed: (message: string) => string;
  }>;
}

const DEFAULT_LABELS = {
  button: 'Export diagnostics',
  exporting: 'Exporting…',
  success: (path: string) => `Exported to ${path}`,
  failed: (message: string) => `Export failed: ${message}`,
};

/**
 * Renders a labeled button with a short status line below it. Works with
 * either a native shell (via `desktopBridge`) or a browser download
 * (via `exportPath`, a same-origin HTTP endpoint that returns the archive).
 */
export function ExportDiagnosticsButton({
  exportPath = '/api/diagnostics/export',
  filenamePrefix = 'diagnostics',
  desktopBridge,
  labels,
}: ExportDiagnosticsButtonProps) {
  const t = { ...DEFAULT_LABELS, ...labels };
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (clearTimer.current != null) clearTimeout(clearTimer.current);
  }, []);

  const scheduleClear = () => {
    if (clearTimer.current != null) clearTimeout(clearTimer.current);
    clearTimer.current = setTimeout(() => setStatus({ kind: 'idle' }), STATUS_CLEAR_MS);
  };

  const handleClick = async () => {
    // No busy re-entry guard needed here: the only caller is the button
    // below, which is `disabled={busy}` — and a disabled button never
    // dispatches click events (to real or synthetic listeners alike), so
    // this can never run while an export is already in flight.
    setStatus({ kind: 'busy' });
    try {
      if (desktopBridge != null) {
        const result = await desktopBridge.exportDiagnostics();
        if (result.ok) {
          setStatus({ kind: 'success', message: t.success(result.path) });
          scheduleClear();
          return;
        }
        if (result.cancelled) {
          setStatus({ kind: 'idle' });
          return;
        }
        setStatus({ kind: 'error', message: t.failed(result.message) });
        scheduleClear();
        return;
      }
      const { filename } = await exportViaHttp(exportPath, filenamePrefix);
      setStatus({ kind: 'success', message: t.success(filename) });
      scheduleClear();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus({ kind: 'error', message: t.failed(message) });
      scheduleClear();
    }
  };

  const busy = status.kind === 'busy';
  return (
    <div className="diagnostics-export-row">
      <button
        type="button"
        className="ghost diagnostics-export-button"
        onClick={() => void handleClick()}
        disabled={busy}
        data-status={status.kind}
      >
        <Icon name="download" size={14} />
        <span>{busy ? t.exporting : t.button}</span>
      </button>
      {status.kind === 'success' || status.kind === 'error' ? (
        <p className={`diagnostics-export-status ${status.kind}`} role="status">
          {status.message}
        </p>
      ) : null}
    </div>
  );
}
