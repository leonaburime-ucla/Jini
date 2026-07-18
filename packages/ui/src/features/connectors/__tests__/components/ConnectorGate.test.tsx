import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConnectorGate } from '../../components/ConnectorGate.js';

describe('ConnectorGate', () => {
  it('renders the provided copy and href, and fires onClick', async () => {
    const onClick = vi.fn();
    render(<ConnectorGate title="Add an API key" body="You need a key" ctaLabel="Get key" ctaHref="https://example.com/keys" onClick={onClick} />);
    const link = screen.getByRole('link', { name: /Get key/ });
    expect(link.getAttribute('href')).toBe('https://example.com/keys');
    await userEvent.click(link);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
