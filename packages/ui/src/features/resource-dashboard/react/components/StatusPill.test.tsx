import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusPill } from './StatusPill.js';

describe('StatusPill', () => {
  it('renders the given label', () => {
    render(<StatusPill status="running" label="Running" />);
    expect(screen.getByTestId('resource-status-pill')).toHaveTextContent('Running');
  });

  it('applies a status-keyed class', () => {
    render(<StatusPill status="running" label="Running" />);
    expect(screen.getByTestId('resource-status-pill')).toHaveClass('is-running');
  });

  it('applies the mapped tone class', () => {
    render(<StatusPill status="failed" label="Failed" toneMap={{ failed: 'error' }} />);
    expect(screen.getByTestId('resource-status-pill')).toHaveClass('tone-error');
  });

  it('defaults to the neutral tone for an unmapped status', () => {
    render(<StatusPill status="mystery" label="Mystery" />);
    expect(screen.getByTestId('resource-status-pill')).toHaveClass('tone-neutral');
  });

  it('defaults to the neutral tone when no toneMap is given at all', () => {
    render(<StatusPill status="running" label="Running" />);
    expect(screen.getByTestId('resource-status-pill')).toHaveClass('tone-neutral');
  });
});
