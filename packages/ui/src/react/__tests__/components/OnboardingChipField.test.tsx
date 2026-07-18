import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { OnboardingChipField } from '../../components/OnboardingChipField.js';

const OPTIONS = [
  { value: 'design', label: 'Design' },
  { value: 'engineering', label: 'Engineering' },
  { value: 'product', label: 'Product' },
];

describe('OnboardingChipField', () => {
  it('renders the label and every chip', () => {
    render(<OnboardingChipField label="Role" options={OPTIONS} value="" onChange={() => {}} />);
    expect(screen.getByText('Role')).toBeInTheDocument();
    for (const option of OPTIONS) {
      expect(screen.getByRole('button', { name: option.label })).toBeInTheDocument();
    }
  });

  describe('single-select mode', () => {
    it('marks the matching chip as selected', () => {
      render(<OnboardingChipField label="Role" options={OPTIONS} value="engineering" onChange={() => {}} />);
      expect(screen.getByRole('button', { name: 'Engineering' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: 'Design' })).toHaveAttribute('aria-pressed', 'false');
    });

    it('selects an unselected chip on click', async () => {
      const onChange = vi.fn();
      render(<OnboardingChipField label="Role" options={OPTIONS} value="" onChange={onChange} />);
      await userEvent.click(screen.getByRole('button', { name: 'Product' }));
      expect(onChange).toHaveBeenCalledWith('product');
    });

    it('clears the selection when clicking the already-selected chip', async () => {
      const onChange = vi.fn();
      render(<OnboardingChipField label="Role" options={OPTIONS} value="product" onChange={onChange} />);
      await userEvent.click(screen.getByRole('button', { name: 'Product' }));
      expect(onChange).toHaveBeenCalledWith('');
    });
  });

  describe('multi-select mode', () => {
    it('marks every selected value as pressed', () => {
      render(
        <OnboardingChipField
          label="Roles"
          options={OPTIONS}
          value={['design', 'product']}
          onChange={() => {}}
          multiple
        />,
      );
      expect(screen.getByRole('button', { name: 'Design' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: 'Product' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: 'Engineering' })).toHaveAttribute('aria-pressed', 'false');
    });

    it('adds a chip to the selection on click', async () => {
      const onChange = vi.fn();
      render(
        <OnboardingChipField label="Roles" options={OPTIONS} value={['design']} onChange={onChange} multiple />,
      );
      await userEvent.click(screen.getByRole('button', { name: 'Product' }));
      expect(onChange).toHaveBeenCalledWith(['design', 'product']);
    });

    it('removes a chip from the selection on click', async () => {
      const onChange = vi.fn();
      render(
        <OnboardingChipField
          label="Roles"
          options={OPTIONS}
          value={['design', 'product']}
          onChange={onChange}
          multiple
        />,
      );
      await userEvent.click(screen.getByRole('button', { name: 'Design' }));
      expect(onChange).toHaveBeenCalledWith(['product']);
    });
  });

  it('appends a caller-supplied className', () => {
    const { container } = render(
      <OnboardingChipField label="Role" options={OPTIONS} value="" onChange={() => {}} className="extra" />,
    );
    expect(container.firstChild).toHaveClass('onboarding-chip-field');
    expect(container.firstChild).toHaveClass('extra');
  });
});
