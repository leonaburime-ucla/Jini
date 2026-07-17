import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TodoCard } from './TodoCard.js';

describe('TodoCard', () => {
  it('shows progress counts and expands to reveal every item', async () => {
    const todos = [
      { content: 'step one', status: 'completed' as const },
      { content: 'step two', status: 'in_progress' as const },
      { content: 'step three', status: 'pending' as const },
    ];
    render(<TodoCard todos={todos} />);
    expect(screen.getByText('2/3')).toBeInTheDocument();
    expect(screen.getByText('step one')).toBeInTheDocument();
    expect(screen.getByText('step three')).toBeInTheDocument();
  });

  it('collapses/expands via the header toggle', async () => {
    const todos = [{ content: 'done thing', status: 'completed' as const }];
    render(<TodoCard todos={todos} />);
    const toggle = screen.getByRole('button', { name: /todos/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('shows the dismiss button only once every todo is complete, and calls onDismiss', async () => {
    const onDismiss = vi.fn();
    const { rerender } = render(<TodoCard todos={[{ content: 'a', status: 'in_progress' }]} onDismiss={onDismiss} />);
    expect(screen.queryByText('Done')).not.toBeInTheDocument();

    rerender(<TodoCard todos={[{ content: 'a', status: 'completed' }]} onDismiss={onDismiss} />);
    await userEvent.click(screen.getByText('Done'));
    expect(onDismiss).toHaveBeenCalled();
  });
});
