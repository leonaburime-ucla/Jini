import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConnectorSearchBar } from './ConnectorSearchBar.js';

describe('ConnectorSearchBar', () => {
  it('calls onChange as the user types', async () => {
    const onChange = vi.fn();
    render(<ConnectorSearchBar value="" onChange={onChange} />);
    await userEvent.type(screen.getByTestId('connectors-search-input'), 'sl');
    expect(onChange).toHaveBeenCalledWith('s');
    expect(onChange).toHaveBeenCalledWith('l');
  });

  it('shows a clear button only when there is a query, and clears on click', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<ConnectorSearchBar value="" onChange={onChange} />);
    expect(screen.queryByTestId('connectors-search-clear')).toBeNull();

    rerender(<ConnectorSearchBar value="slack" onChange={onChange} />);
    await userEvent.click(screen.getByTestId('connectors-search-clear'));
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('clears on Escape when there is a query', () => {
    const onChange = vi.fn();
    render(<ConnectorSearchBar value="slack" onChange={onChange} />);
    const input = screen.getByTestId('connectors-search-input');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('disables the input when disabled=true', () => {
    render(<ConnectorSearchBar value="" onChange={() => {}} disabled />);
    expect((screen.getByTestId('connectors-search-input') as HTMLInputElement).disabled).toBe(true);
  });

  it('fires onFocus when the input receives focus', async () => {
    const onFocus = vi.fn();
    render(<ConnectorSearchBar value="" onChange={() => {}} onFocus={onFocus} />);
    await userEvent.click(screen.getByTestId('connectors-search-input'));
    expect(onFocus).toHaveBeenCalledTimes(1);
  });
});
