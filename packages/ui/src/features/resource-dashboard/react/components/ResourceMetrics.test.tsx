import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ResourceMetrics } from './ResourceMetrics.js';

describe('ResourceMetrics', () => {
  it('renders nothing for an empty metrics list', () => {
    const { container } = render(<ResourceMetrics metrics={[]} ariaLabel="Summary" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders one tile per metric', () => {
    render(
      <ResourceMetrics
        metrics={[
          { key: 'active', label: 'Active', value: 3 },
          { key: 'paused', label: 'Paused', value: 1 },
        ]}
        ariaLabel="Summary"
      />,
    );
    const group = screen.getByLabelText('Summary');
    expect(group).toHaveTextContent('3');
    expect(group).toHaveTextContent('Active');
    expect(group).toHaveTextContent('1');
    expect(group).toHaveTextContent('Paused');
  });
});
