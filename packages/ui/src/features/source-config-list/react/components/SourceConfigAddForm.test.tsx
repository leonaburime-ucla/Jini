import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { validateSourceDraft } from '../../rules.js';
import { SourceConfigAddForm } from './SourceConfigAddForm.js';
import type { ComponentProps } from 'react';
import type { SourceFieldSpec, SourceTrustOption } from '../../types.js';

const URL_FIELD: SourceFieldSpec = { key: 'url', label: 'URL', kind: 'url', required: true };
const TRUST_OPTIONS: SourceTrustOption[] = [
  { value: 'restricted', label: 'Restricted' },
  { value: 'trusted', label: 'Trusted' },
];

function baseProps(overrides: Partial<ComponentProps<typeof SourceConfigAddForm>> = {}) {
  const values = { url: '' };
  return {
    fieldSpecs: [URL_FIELD],
    values,
    validation: validateSourceDraft([URL_FIELD], values),
    submitAttempted: false,
    submitting: false,
    onFieldChange: vi.fn(),
    onTrustChange: vi.fn(),
    onSubmit: vi.fn(),
    ...overrides,
  };
}

describe('SourceConfigAddForm', () => {
  it('renders one SourceConfigField per field spec', () => {
    render(<SourceConfigAddForm {...baseProps()} />);
    expect(screen.getByLabelText('URL', { exact: false })).toBeInTheDocument();
  });

  it('does not render a trust select when trustOptions is omitted', () => {
    render(<SourceConfigAddForm {...baseProps()} />);
    expect(screen.queryByLabelText('Trust level')).toBeNull();
  });

  it('renders a trust select when trustOptions is given, and reports changes', async () => {
    const onTrustChange = vi.fn();
    render(<SourceConfigAddForm {...baseProps({ trustOptions: TRUST_OPTIONS, onTrustChange })} />);
    const select = screen.getByLabelText('Trust level');
    await userEvent.selectOptions(select, 'trusted');
    expect(onTrustChange).toHaveBeenCalledWith('trusted');
  });

  it('does not show field errors before a submit attempt', () => {
    render(<SourceConfigAddForm {...baseProps()} />);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows field errors once submitAttempted is true', () => {
    render(<SourceConfigAddForm {...baseProps({ submitAttempted: true })} />);
    expect(screen.getByRole('alert')).toHaveTextContent('URL is required.');
  });

  it('calls onFieldChange when a field value changes', async () => {
    const onFieldChange = vi.fn();
    render(<SourceConfigAddForm {...baseProps({ onFieldChange })} />);
    await userEvent.type(screen.getByLabelText('URL', { exact: false }), 'x');
    expect(onFieldChange).toHaveBeenCalledWith('url', 'x');
  });

  it('calls onSubmit when the form is submitted', async () => {
    const onSubmit = vi.fn();
    const values = { url: 'https://a.example' };
    render(
      <SourceConfigAddForm
        {...baseProps({ values, validation: validateSourceDraft([URL_FIELD], values), onSubmit })}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Add source' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('renders a custom addLabel when given', () => {
    render(<SourceConfigAddForm {...baseProps({ addLabel: 'Add MCP server' })} />);
    expect(screen.getByRole('button', { name: 'Add MCP server' })).toBeInTheDocument();
  });

  it('shows an "Adding…" submit label and disables fields while submitting', () => {
    render(<SourceConfigAddForm {...baseProps({ submitting: true })} />);
    expect(screen.getByRole('button', { name: 'Adding…' })).toBeDisabled();
    expect(screen.getByLabelText('URL', { exact: false })).toBeDisabled();
  });

  it('renders a submitError banner with role="alert"', () => {
    render(<SourceConfigAddForm {...baseProps({ submitError: 'Marketplace unreachable.' })} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Marketplace unreachable.');
  });

  it('defaults a field with no matching key in `values` to an empty string rather than throwing', () => {
    // Defensive fallback for a host rendering this form directly with a values
    // map that doesn't cover every field spec (the wired hook always seeds a
    // complete draft, but this component doesn't assume its caller does).
    render(<SourceConfigAddForm {...baseProps({ values: {} })} />);
    expect(screen.getByLabelText('URL', { exact: false })).toHaveValue('');
  });
});
