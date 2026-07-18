// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TabLauncherActionRow } from './TabLauncherActionRow.js';
import type { TabLauncherAction } from '../../types.js';

const action: TabLauncherAction<{ scope: string }> = {
  id: 'new-terminal',
  label: 'New Terminal',
  description: 'Open a shell in this project',
  run: vi.fn(),
};

describe('TabLauncherActionRow', () => {
  it('renders the label and description', () => {
    render(<TabLauncherActionRow action={action} onSelect={vi.fn()} />);
    expect(screen.getByText('New Terminal')).toBeInTheDocument();
    expect(screen.getByText('Open a shell in this project')).toBeInTheDocument();
  });

  it('omits the description span when absent', () => {
    render(<TabLauncherActionRow action={{ id: 'x', label: 'X', run: vi.fn() }} onSelect={vi.fn()} />);
    expect(screen.queryByText('Open a shell in this project')).not.toBeInTheDocument();
  });

  it('renders a host-supplied icon via renderIcon', () => {
    render(<TabLauncherActionRow action={{ ...action, iconName: 'terminal' }} onSelect={vi.fn()} renderIcon={(name) => <span data-testid="icon">{name}</span>} />);
    expect(screen.getByTestId('icon')).toHaveTextContent('terminal');
  });

  it('calls onSelect with the action on click', async () => {
    const onSelect = vi.fn();
    render(<TabLauncherActionRow action={action} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('button'));
    expect(onSelect).toHaveBeenCalledWith(action);
  });
});
