import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OnboardingPanelHeader } from '../../components/OnboardingPanelHeader.js';

describe('OnboardingPanelHeader', () => {
  it('renders the title as a heading and the body as text', () => {
    render(<OnboardingPanelHeader title="Choose your setup" body="Pick how you want to get started." />);
    expect(screen.getByRole('heading', { name: 'Choose your setup' })).toBeInTheDocument();
    expect(screen.getByText('Pick how you want to get started.')).toBeInTheDocument();
  });

  it('appends a caller-supplied className', () => {
    const { container } = render(<OnboardingPanelHeader title="T" body="B" className="extra" />);
    expect(container.firstChild).toHaveClass('onboarding-view__panel-head');
    expect(container.firstChild).toHaveClass('extra');
  });
});
