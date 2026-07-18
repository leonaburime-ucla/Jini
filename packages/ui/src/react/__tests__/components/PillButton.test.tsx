import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PillButton } from '../../components/PillButton.js';

describe('PillButton', () => {
  it('renders the label and calls onClick when clicked', async () => {
    const onClick = vi.fn();
    render(<PillButton label="Schedule" onClick={onClick} />);
    await userEvent.click(screen.getByRole('button', { name: 'Schedule' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is not active by default and has no aria-expanded when there are no children', () => {
    render(<PillButton label="Schedule" onClick={() => {}} />);
    const button = screen.getByRole('button');
    expect(button.className).not.toContain('is-active');
    expect(button).not.toHaveAttribute('aria-expanded');
  });

  it('reflects active state in class and aria-expanded when children are present', () => {
    render(
      <PillButton label="Schedule" onClick={() => {}} active>
        <div>panel</div>
      </PillButton>,
    );
    const button = screen.getByRole('button');
    expect(button.className).toContain('is-active');
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });

  it('renders icon, trailingIcon, and children', () => {
    render(
      <PillButton
        label="Schedule"
        onClick={() => {}}
        icon={<span data-testid="lead-icon" />}
        trailingIcon={<span data-testid="trail-icon" />}
      >
        <div data-testid="panel">panel content</div>
      </PillButton>,
    );
    expect(screen.getByTestId('lead-icon')).toBeInTheDocument();
    expect(screen.getByTestId('trail-icon')).toBeInTheDocument();
    expect(screen.getByTestId('panel')).toBeInTheDocument();
  });

  it('supports a custom aria-label and disabled state', () => {
    render(<PillButton label="Schedule" onClick={() => {}} aria-label="Daily at 9am" disabled />);
    const button = screen.getByRole('button', { name: 'Daily at 9am' });
    expect(button).toBeDisabled();
  });

  it('appends a custom className to the wrapper', () => {
    const { container } = render(<PillButton label="Schedule" onClick={() => {}} className="extra" />);
    expect(container.querySelector('.jini-pill-wrap.extra')).not.toBeNull();
  });
});
