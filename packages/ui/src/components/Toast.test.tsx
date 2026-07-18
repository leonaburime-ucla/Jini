// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
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
});
