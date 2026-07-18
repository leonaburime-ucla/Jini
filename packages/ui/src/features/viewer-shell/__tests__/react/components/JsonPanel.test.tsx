import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { JsonPanel } from '../../../react/components/JsonPanel.js';

describe('JsonPanel', () => {
  it('shows the empty label when value is null', () => {
    render(<JsonPanel value={null} emptyLabel="Nothing here" />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('shows the empty label when value is undefined', () => {
    render(<JsonPanel value={undefined} emptyLabel="Nothing here" />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('pretty-prints a JSON value', () => {
    const { container } = render(<JsonPanel value={{ a: 1, b: [2, 3] }} emptyLabel="—" />);
    expect(container.querySelector('pre')?.textContent).toBe(JSON.stringify({ a: 1, b: [2, 3] }, null, 2));
  });
});
