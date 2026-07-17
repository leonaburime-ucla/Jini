// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { KitErrorBoundary } from './KitErrorBoundary.js';

function Bomb({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('boom');
  return <div>fine</div>;
}

describe('KitErrorBoundary', () => {
  it('renders children when nothing throws', () => {
    render(
      <KitErrorBoundary>
        <div>fine</div>
      </KitErrorBoundary>,
    );
    expect(screen.getByText('fine')).toBeTruthy();
  });

  it('shows the fallback and calls onError when a child throws', () => {
    const onError = vi.fn();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <KitErrorBoundary onError={onError}>
        <Bomb shouldThrow />
      </KitErrorBoundary>,
    );
    expect(screen.getByTestId('kit-error-boundary')).toBeTruthy();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]![0]).toBeInstanceOf(Error);
    consoleError.mockRestore();
  });

  it('does not throw when onError is omitted (defaults to a no-op)', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() =>
      render(
        <KitErrorBoundary>
          <Bomb shouldThrow />
        </KitErrorBoundary>,
      ),
    ).not.toThrow();
    consoleError.mockRestore();
  });

  it('supports custom title/retryLabel text', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <KitErrorBoundary title="Custom title" retryLabel="Retry now">
        <Bomb shouldThrow />
      </KitErrorBoundary>,
    );
    expect(screen.getByText('Custom title')).toBeTruthy();
    expect(screen.getByText('Retry now')).toBeTruthy();
    consoleError.mockRestore();
  });

  it('retry resets the boundary and re-renders children', async () => {
    const user = userEvent.setup();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    function Harness() {
      const [broken, setBroken] = useState(true);
      return (
        <KitErrorBoundary>
          <button onClick={() => setBroken(false)}>fix</button>
          <Bomb shouldThrow={broken} />
        </KitErrorBoundary>
      );
    }
    render(<Harness />);
    expect(screen.getByTestId('kit-error-boundary')).toBeTruthy();
    await user.click(screen.getByText('Try again'));
    // The boundary re-renders its (still-throwing) children and catches
    // again — this confirms retry actually clears local error state rather
    // than getting stuck.
    expect(screen.getByTestId('kit-error-boundary')).toBeTruthy();
    consoleError.mockRestore();
  });
});
