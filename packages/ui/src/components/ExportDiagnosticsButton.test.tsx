// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

  it('reports the JSON body message on a failed export request', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Server Error',
        json: () => Promise.resolve({ message: 'disk full' }),
      }),
    );
    render(<ExportDiagnosticsButton />);
    await user.click(screen.getByRole('button'));
    await waitFor(() => expect(screen.getByRole('status')).toBeTruthy());
    expect(screen.getByRole('status').textContent).toBe('Export failed: disk full');
  });

  it('parses an unquoted filename= content-disposition value', async () => {
    const user = userEvent.setup();
    const blob = new Blob(['zip-bytes']);
    const headers = new Headers({ 'content-disposition': 'attachment; filename=diag-plain.zip' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, headers, blob: () => Promise.resolve(blob) }));
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() });
    render(<ExportDiagnosticsButton />);
    await user.click(screen.getByRole('button'));
    await waitFor(() => expect(screen.getByRole('status')).toBeTruthy());
    expect(screen.getByRole('status').textContent).toBe('Exported to diag-plain.zip');
  });

  it('keeps the default status message when the error body has no string message field', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Server Error',
        json: () => Promise.resolve({ notMessage: 1 }),
      }),
    );
    render(<ExportDiagnosticsButton />);
    await user.click(screen.getByRole('button'));
    await waitFor(() => expect(screen.getByRole('status')).toBeTruthy());
    expect(screen.getByRole('status').textContent).toBe('Export failed: 500 Server Error');
  });

  it('stringifies a non-Error thrown value in the failure message', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue('boom'));
    render(<ExportDiagnosticsButton />);
    await user.click(screen.getByRole('button'));
    await waitFor(() => expect(screen.getByRole('status')).toBeTruthy());
    expect(screen.getByRole('status').textContent).toBe('Export failed: boom');
  });

  it('falls back to a generated filename when no content-disposition header is present', async () => {
    const user = userEvent.setup();
    const blob = new Blob(['zip-bytes']);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, headers: new Headers(), blob: () => Promise.resolve(blob) }),
    );
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() });
    render(<ExportDiagnosticsButton filenamePrefix="diag" />);
    await user.click(screen.getByRole('button'));
    await waitFor(() => expect(screen.getByRole('status')).toBeTruthy());
    expect(screen.getByRole('status').textContent).toMatch(/^Exported to diag-.*\.zip$/);
  });

  it('falls back to a generated filename when content-disposition has no filename', async () => {
    const user = userEvent.setup();
    const blob = new Blob(['zip-bytes']);
    const headers = new Headers({ 'content-disposition': 'inline' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, headers, blob: () => Promise.resolve(blob) }));
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() });
    render(<ExportDiagnosticsButton />);
    await user.click(screen.getByRole('button'));
    await waitFor(() => expect(screen.getByRole('status')).toBeTruthy());
    expect(screen.getByRole('status').textContent).toMatch(/^Exported to diagnostics-.*\.zip$/);
  });

  it('decodes an RFC 5987 filename*=UTF-8\'\' style content-disposition header', async () => {
    const user = userEvent.setup();
    const blob = new Blob(['zip-bytes']);
    const headers = new Headers({ 'content-disposition': "attachment; filename*=UTF-8''diag%20name.zip" });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, headers, blob: () => Promise.resolve(blob) }));
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() });
    render(<ExportDiagnosticsButton />);
    await user.click(screen.getByRole('button'));
    await waitFor(() => expect(screen.getByRole('status')).toBeTruthy());
    expect(screen.getByRole('status').textContent).toBe('Exported to diag name.zip');
  });

  it('falls back to the raw filename when it cannot be percent-decoded', async () => {
    const user = userEvent.setup();
    const blob = new Blob(['zip-bytes']);
    const headers = new Headers({ 'content-disposition': 'attachment; filename="diag%zz.zip"' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, headers, blob: () => Promise.resolve(blob) }));
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() });
    render(<ExportDiagnosticsButton />);
    await user.click(screen.getByRole('button'));
    await waitFor(() => expect(screen.getByRole('status')).toBeTruthy());
    expect(screen.getByRole('status').textContent).toBe('Exported to diag%zz.zip');
  });

  it('disables the button while an export is in flight, preventing a second export', async () => {
    let resolveExport: (v: { ok: true; path: string }) => void = () => {};
    const desktopBridge = {
      exportDiagnostics: vi.fn(
        () => new Promise<{ ok: true; path: string }>((resolve) => { resolveExport = resolve; }),
      ),
    };
    render(<ExportDiagnosticsButton desktopBridge={desktopBridge} />);
    const button = screen.getByRole('button') as HTMLButtonElement;
    fireEvent.click(button);
    expect(button.disabled).toBe(true);
    // A disabled button never dispatches click events, so this is a no-op.
    fireEvent.click(button);
    resolveExport({ ok: true, path: '/tmp/x.zip' });
    await waitFor(() => expect(screen.getByRole('status')).toBeTruthy());
    expect(desktopBridge.exportDiagnostics).toHaveBeenCalledTimes(1);
  });

  it('re-arms the status-clear timer when exporting again before the previous timer fires', async () => {
    vi.useFakeTimers();
    const desktopBridge = {
      exportDiagnostics: vi.fn().mockResolvedValue({ ok: true, path: '/tmp/diag.zip' }),
    };
    render(<ExportDiagnosticsButton desktopBridge={desktopBridge} />);
    const button = screen.getByRole('button');

    await act(async () => {
      fireEvent.click(button);
      // Flush the microtask queue so the already-resolved desktopBridge
      // promise settles and the resulting setState is applied.
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByRole('status').textContent).toBe('Exported to /tmp/diag.zip');

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    await act(async () => {
      fireEvent.click(button);
      await Promise.resolve();
      await Promise.resolve();
    });

    // Under the OLD (un-re-armed) timer this would already have cleared;
    // it should still be showing since the second export re-armed the timer.
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByRole('status')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.queryByRole('status')).toBeNull();
    vi.useRealTimers();
  });
});
