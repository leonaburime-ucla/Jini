// @vitest-environment jsdom
import { useRef } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFileDropzone, type UseFileDropzoneParams } from './useFileDropzone.js';
import {
  FILE_DIALOG_WARMUP_MS,
  FILE_DROPZONE_PROCESSING_BYTES_THRESHOLD,
  FILE_DROPZONE_PROCESSING_FILE_COUNT_THRESHOLD,
  FILE_DROPZONE_PROCESSING_MIN_VISIBLE_MS,
} from '../../constants.js';

function file(name = 'a.txt', size = 10): File {
  return new File([new Uint8Array(size)], name);
}

function Harness(props: Partial<UseFileDropzoneParams> & { onFiles: (files: File[]) => void }) {
  const dropzone = useFileDropzone(props);
  const openPickerCalls = useRef(0);
  return (
    <div>
      <div
        data-testid="zone"
        onDragEnter={dropzone.onZoneDragEnter}
        onDragOver={dropzone.onZoneDragOver}
        onDragLeave={dropzone.onZoneDragLeave}
        onDrop={dropzone.onZoneDrop}
      >
        drop here
      </div>
      <input
        type="file"
        data-testid="input"
        ref={dropzone.inputRef}
        onChange={dropzone.onInputChange}
        onClick={dropzone.onInputClick}
      />
      <textarea data-testid="textarea" />
      <span data-testid="dragOver">{String(dropzone.dragOver)}</span>
      <span data-testid="dropReadError">{dropzone.dropReadError ?? ''}</span>
      <button
        type="button"
        data-testid="openPicker"
        onClick={() => {
          openPickerCalls.current += 1;
          dropzone.openPicker();
        }}
      />
    </div>
  );
}

function dataTransfer(files: File[]): DataTransfer {
  return { items: [], files } as unknown as DataTransfer;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useFileDropzone', () => {
  it('openPicker clicks the underlying file input', () => {
    const onFiles = vi.fn();
    render(<Harness onFiles={onFiles} />);
    const input = screen.getByTestId('input') as HTMLInputElement;
    const clickSpy = vi.spyOn(input, 'click');
    fireEvent.click(screen.getByTestId('openPicker'));
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('stages a small selection synchronously on input change and clears any prior error', () => {
    const onFiles = vi.fn();
    const onError = vi.fn();
    render(<Harness onFiles={onFiles} onError={onError} />);
    const input = screen.getByTestId('input') as HTMLInputElement;
    const f = file();
    Object.defineProperty(input, 'files', { value: [f], configurable: true });
    fireEvent.change(input);
    expect(onFiles).toHaveBeenCalledWith([f]);
    expect(onError).toHaveBeenCalledWith(null);
    expect(input.value).toBe('');
  });

  it('an input change with a null `files` (defensive fallback) stages nothing', () => {
    const onFiles = vi.fn();
    render(<Harness onFiles={onFiles} />);
    const input = screen.getByTestId('input') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: null, configurable: true });
    fireEvent.change(input);
    expect(onFiles).not.toHaveBeenCalled();
  });

  it('a zero-file input change stages nothing', () => {
    const onFiles = vi.fn();
    render(<Harness onFiles={onFiles} />);
    const input = screen.getByTestId('input') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [], configurable: true });
    fireEvent.change(input);
    expect(onFiles).not.toHaveBeenCalled();
  });

  it('onInputClick fires onZoneClick and arms the file-dialog tracking heuristic', () => {
    const onZoneClick = vi.fn();
    const finish = vi.fn();
    const onProcessingStart = vi.fn(() => finish);
    render(<Harness onFiles={vi.fn()} onZoneClick={onZoneClick} onProcessingStart={onProcessingStart} />);
    fireEvent.click(screen.getByTestId('input'));
    expect(onZoneClick).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(FILE_DIALOG_WARMUP_MS));
    expect(onProcessingStart).toHaveBeenCalledTimes(1);
  });

  it('a large selection is wrapped in the processing affordance and staged after the next paint', async () => {
    const onFiles = vi.fn();
    const finish = vi.fn();
    const onProcessingStart = vi.fn(() => finish);
    render(<Harness onFiles={onFiles} onProcessingStart={onProcessingStart} />);
    const input = screen.getByTestId('input') as HTMLInputElement;
    const bigSelection = Array.from({ length: FILE_DROPZONE_PROCESSING_FILE_COUNT_THRESHOLD }, (_, i) => file(`f${i}.bin`));
    Object.defineProperty(input, 'files', { value: bigSelection, configurable: true });
    fireEvent.change(input);
    expect(onFiles).not.toHaveBeenCalled();
    expect(onProcessingStart).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(onFiles).toHaveBeenCalledWith(bigSelection);
    expect(finish).toHaveBeenCalledTimes(1);
  });

  it('falls back to a plain setTimeout when requestAnimationFrame is unavailable', async () => {
    const originalRaf = window.requestAnimationFrame;
    // @ts-expect-error -- simulating an environment without rAF
    delete window.requestAnimationFrame;
    try {
      const onFiles = vi.fn();
      const onProcessingStart = vi.fn(() => vi.fn());
      render(<Harness onFiles={onFiles} onProcessingStart={onProcessingStart} />);
      const input = screen.getByTestId('input') as HTMLInputElement;
      const bigSelection = Array.from({ length: FILE_DROPZONE_PROCESSING_FILE_COUNT_THRESHOLD }, (_, i) => file(`f${i}.bin`));
      Object.defineProperty(input, 'files', { value: bigSelection, configurable: true });
      fireEvent.change(input);
      await act(async () => {
        await vi.runAllTimersAsync();
      });
      expect(onFiles).toHaveBeenCalledWith(bigSelection);
    } finally {
      window.requestAnimationFrame = originalRaf;
    }
  });

  it('a large selection with no onProcessingStart still stages synchronously (no affordance to wrap it in)', () => {
    const onFiles = vi.fn();
    render(<Harness onFiles={onFiles} />);
    const input = screen.getByTestId('input') as HTMLInputElement;
    const bigSelection = Array.from({ length: FILE_DROPZONE_PROCESSING_FILE_COUNT_THRESHOLD }, (_, i) => file(`f${i}.bin`));
    Object.defineProperty(input, 'files', { value: bigSelection, configurable: true });
    fireEvent.change(input);
    expect(onFiles).toHaveBeenCalledWith(bigSelection);
  });

  it('a large-by-bytes (not by count) selection also triggers the processing affordance', async () => {
    const onFiles = vi.fn();
    const onProcessingStart = vi.fn(() => vi.fn());
    render(<Harness onFiles={onFiles} onProcessingStart={onProcessingStart} />);
    const input = screen.getByTestId('input') as HTMLInputElement;
    const huge = [file('huge.bin', FILE_DROPZONE_PROCESSING_BYTES_THRESHOLD)];
    Object.defineProperty(input, 'files', { value: huge, configurable: true });
    fireEvent.change(input);
    expect(onProcessingStart).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(onFiles).toHaveBeenCalledWith(huge);
  });

  it('the input cancel event completes tracking and schedules the finish after the min-visible delay', () => {
    const finish = vi.fn();
    const onProcessingStart = vi.fn(() => finish);
    render(<Harness onFiles={vi.fn()} onProcessingStart={onProcessingStart} />);
    const input = screen.getByTestId('input') as HTMLInputElement;
    fireEvent.click(input);
    act(() => vi.advanceTimersByTime(FILE_DIALOG_WARMUP_MS));
    expect(onProcessingStart).toHaveBeenCalledTimes(1);
    act(() => {
      input.dispatchEvent(new Event('cancel'));
    });
    expect(finish).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(FILE_DROPZONE_PROCESSING_MIN_VISIBLE_MS));
    expect(finish).toHaveBeenCalledTimes(1);
  });

  it('the cancel listener is not attached at all when no onProcessingStart is supplied', () => {
    render(<Harness onFiles={vi.fn()} />);
    const input = screen.getByTestId('input') as HTMLInputElement;
    // No assertion crashes if this fires with nothing listening — a
    // regression that re-attached the listener unconditionally would still
    // pass this, but the point is the absence of a processing affordance
    // means there is nothing to complete/schedule either way.
    expect(() => input.dispatchEvent(new Event('cancel'))).not.toThrow();
  });

  it('a native drop stages the dropped files', async () => {
    const onFiles = vi.fn();
    render(<Harness onFiles={onFiles} />);
    const zone = screen.getByTestId('zone');
    const f = file('dropped.txt');
    await act(async () => {
      fireEvent.drop(zone, { dataTransfer: dataTransfer([f]) });
      await vi.runAllTimersAsync();
    });
    expect(onFiles).toHaveBeenCalledWith([f]);
  });

  it('drag enter/leave toggles the exposed dragOver state', () => {
    render(<Harness onFiles={vi.fn()} />);
    const zone = screen.getByTestId('zone');
    expect(screen.getByTestId('dragOver').textContent).toBe('false');
    fireEvent.dragEnter(zone, { dataTransfer: dataTransfer([]) });
    expect(screen.getByTestId('dragOver').textContent).toBe('true');
    fireEvent.dragLeave(zone, { dataTransfer: dataTransfer([]) });
    expect(screen.getByTestId('dragOver').textContent).toBe('false');
  });

  it('a drop-read error is exposed via dropReadError and mirrored into onError', async () => {
    const onError = vi.fn();
    render(<Harness onFiles={vi.fn()} onError={onError} />);
    const zone = screen.getByTestId('zone');
    const failingEntry = {
      isFile: false,
      isDirectory: true,
      createReader: () => ({
        readEntries: (_ok: unknown, err: (e: DOMException) => void) => err(new DOMException('boom')),
      }),
    };
    const item = { kind: 'file', webkitGetAsEntry: () => failingEntry };
    await act(async () => {
      fireEvent.drop(zone, { dataTransfer: { items: [item], files: [] } as unknown as DataTransfer });
      await vi.runAllTimersAsync();
    });
    expect(screen.getByTestId('dropReadError').textContent).toMatch(/Could not read/);
    expect(onError).toHaveBeenCalledWith(expect.stringMatching(/Could not read/));
  });

  it('paste is ignored entirely by default (enablePaste not set)', () => {
    const onFiles = vi.fn();
    render(<Harness onFiles={onFiles} />);
    const pasted = file('pasted.png');
    const event = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent;
    Object.defineProperty(event, 'clipboardData', { value: { files: [pasted], items: [] } });
    act(() => {
      window.dispatchEvent(event);
    });
    expect(onFiles).not.toHaveBeenCalled();
  });

  it('a page-wide paste stages pasted files directly when enablePaste is true', () => {
    const onFiles = vi.fn();
    const onError = vi.fn();
    render(<Harness onFiles={onFiles} onError={onError} enablePaste />);
    const pasted = file('pasted.png');
    const event = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent;
    Object.defineProperty(event, 'clipboardData', { value: { files: [pasted], items: [] } });
    act(() => {
      window.dispatchEvent(event);
    });
    expect(onFiles).toHaveBeenCalledWith([pasted]);
    expect(onError).toHaveBeenCalledWith(null);
  });

  it('a paste with zero files is ignored', () => {
    const onFiles = vi.fn();
    render(<Harness onFiles={onFiles} enablePaste />);
    const event = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent;
    Object.defineProperty(event, 'clipboardData', { value: { files: [], items: [] } });
    act(() => {
      window.dispatchEvent(event);
    });
    expect(onFiles).not.toHaveBeenCalled();
  });

  it('a paste landing on a text-entry target is ignored even with enablePaste true', () => {
    const onFiles = vi.fn();
    render(<Harness onFiles={onFiles} enablePaste />);
    const textarea = screen.getByTestId('textarea');
    const pasted = file('pasted.png');
    const event = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent;
    Object.defineProperty(event, 'clipboardData', { value: { files: [pasted], items: [] } });
    Object.defineProperty(event, 'target', { value: textarea });
    act(() => {
      window.dispatchEvent(event);
    });
    expect(onFiles).not.toHaveBeenCalled();
  });

  it('removes the paste listener on unmount', () => {
    const onFiles = vi.fn();
    const { unmount } = render(<Harness onFiles={onFiles} enablePaste />);
    unmount();
    const pasted = file('pasted.png');
    const event = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent;
    Object.defineProperty(event, 'clipboardData', { value: { files: [pasted], items: [] } });
    act(() => {
      window.dispatchEvent(event);
    });
    expect(onFiles).not.toHaveBeenCalled();
  });
});
