// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Toast } from './Toast.js';

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('auto-dismisses after ttlMs', () => {
    const onDismiss = vi.fn();
    render(<Toast message="Saved" ttlMs={1000} onDismiss={onDismiss} />);
    expect(onDismiss).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('never auto-dismisses when code is present', () => {
    const onDismiss = vi.fn();
    render(<Toast message="Copy failed" code="npm install foo" ttlMs={1000} onDismiss={onDismiss} />);
    vi.advanceTimersByTime(60_000);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('renders details and an action button', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(
      <Toast
        message="Upload failed"
        details="Network error"
        actionLabel="Retry"
        onAction={onAction}
        ttlMs={0}
      />,
    );
    expect(screen.getByText('Network error')).toBeTruthy();
    await user.click(screen.getByText('Retry'));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('does not re-arm the timer on parent re-renders with a fresh onDismiss closure', () => {
    const onDismiss = vi.fn();
    const { rerender } = render(<Toast message="Running 1s" ttlMs={1000} onDismiss={onDismiss} />);
    vi.advanceTimersByTime(500);
    // Simulate a parent re-render passing a brand new closure identity.
    rerender(<Toast message="Running 1s" ttlMs={1000} onDismiss={() => onDismiss()} />);
    vi.advanceTimersByTime(500);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('renders a tone icon for success/error/loading tones', () => {
    vi.useRealTimers();
    const { container, rerender } = render(<Toast message="Saved" tone="success" ttlMs={0} />);
    expect(container.querySelector('.jini-toast-icon')).toBeTruthy();
    rerender(<Toast message="Saved" tone="error" ttlMs={0} />);
    expect(container.querySelector('.jini-toast-icon')).toBeTruthy();
    rerender(<Toast message="Saved" tone="loading" ttlMs={0} />);
    expect(container.querySelector('.jini-toast-icon')).toBeTruthy();
  });

  it('uses assertive aria-live for the "alert" role', () => {
    vi.useRealTimers();
    render(<Toast message="Failed" role="alert" ttlMs={0} />);
    expect(screen.getByRole('alert').getAttribute('aria-live')).toBe('assertive');
  });

  it('appends a custom className', () => {
    vi.useRealTimers();
    const { container } = render(<Toast message="Saved" className="extra" ttlMs={0} />);
    expect((container.firstChild as HTMLElement).className).toContain('extra');
  });

  it('adds the "leaving" class shortly before the TTL deadline', () => {
    const onDismiss = vi.fn();
    const { container } = render(<Toast message="Saved" ttlMs={1000} onDismiss={onDismiss} />);
    act(() => {
      vi.advanceTimersByTime(1000 - 160);
    });
    expect((container.firstChild as HTMLElement).className).toContain('leaving');
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
