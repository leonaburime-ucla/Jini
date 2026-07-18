// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExportDiagnosticsButton } from './ExportDiagnosticsButton.js';

describe('ExportDiagnosticsButton', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('uses the desktopBridge when supplied, instead of fetch', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const desktopBridge = {
      exportDiagnostics: vi.fn().mockResolvedValue({ ok: true, path: '/tmp/diag.zip' }),
    };
    render(<ExportDiagnosticsButton desktopBridge={desktopBridge} />);
    await user.click(screen.getByRole('button'));
    await waitFor(() => expect(screen.getByRole('status')).toBeTruthy());
    expect(screen.getByRole('status').textContent).toBe('Exported to /tmp/diag.zip');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('shows an error message when the desktop bridge reports failure', async () => {
    const user = userEvent.setup();
    const desktopBridge = {
      exportDiagnostics: vi.fn().mockResolvedValue({ ok: false, cancelled: false, message: 'disk full' }),
    };
    render(<ExportDiagnosticsButton desktopBridge={desktopBridge} />);
    await user.click(screen.getByRole('button'));
    await waitFor(() => expect(screen.getByRole('status')).toBeTruthy());
    expect(screen.getByRole('status').textContent).toBe('Export failed: disk full');
  });

  it('does nothing (no status) when the desktop dialog is cancelled', async () => {
    const user = userEvent.setup();
    const desktopBridge = {
      exportDiagnostics: vi.fn().mockResolvedValue({ ok: false, cancelled: true }),
    };
    render(<ExportDiagnosticsButton desktopBridge={desktopBridge} />);
    await user.click(screen.getByRole('button'));
    await waitFor(() => expect(desktopBridge.exportDiagnostics).toHaveBeenCalled());
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('falls back to an HTTP export against exportPath when no bridge is supplied', async () => {
    const user = userEvent.setup();
    const blob = new Blob(['zip-bytes']);
    const headers = new Headers({ 'content-disposition': 'attachment; filename="diag-123.zip"' });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, headers, blob: () => Promise.resolve(blob) }),
    );
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() });
    render(<ExportDiagnosticsButton exportPath="/custom/export" />);
    await user.click(screen.getByRole('button'));
    await waitFor(() => expect(screen.getByRole('status')).toBeTruthy());
    expect(screen.getByRole('status').textContent).toBe('Exported to diag-123.zip');
    expect(globalThis.fetch).toHaveBeenCalledWith('/custom/export', { credentials: 'same-origin' });
  });

  it('reports the HTTP status text on a failed export request', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: 'Server Error', json: () => Promise.reject() }),
    );
    render(<ExportDiagnosticsButton />);
    await user.click(screen.getByRole('button'));
    await waitFor(() => expect(screen.getByRole('status')).toBeTruthy());
    expect(screen.getByRole('status').textContent).toBe('Export failed: 500 Server Error');
  });
});
