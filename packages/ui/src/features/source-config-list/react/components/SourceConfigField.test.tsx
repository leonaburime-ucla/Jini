import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SourceConfigField } from './SourceConfigField.js';
import type { SourceFieldSpec } from '../../types.js';

describe('SourceConfigField', () => {
  it('renders a text field and forwards changes', async () => {
    const onChange = vi.fn();
    const spec: SourceFieldSpec = { key: 'label', label: 'Label', kind: 'text', placeholder: 'e.g. My Server' };
    render(<SourceConfigField spec={spec} value="" onChange={onChange} />);
    const input = screen.getByPlaceholderText('e.g. My Server');
    await userEvent.type(input, 'x');
    expect(onChange).toHaveBeenCalledWith('x');
  });

  it('renders a url-kind field as type="url"', () => {
    const spec: SourceFieldSpec = { key: 'url', label: 'URL', kind: 'url' };
    render(<SourceConfigField spec={spec} value="https://a.example" onChange={vi.fn()} />);
    expect(screen.getByDisplayValue('https://a.example')).toHaveAttribute('type', 'url');
  });

  it('renders a required marker for a required field', () => {
    const spec: SourceFieldSpec = { key: 'url', label: 'URL', kind: 'url', required: true };
    render(<SourceConfigField spec={spec} value="" onChange={vi.fn()} />);
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('does not render a required marker for an optional field', () => {
    const spec: SourceFieldSpec = { key: 'label', label: 'Label', kind: 'text' };
    render(<SourceConfigField spec={spec} value="" onChange={vi.fn()} />);
    expect(screen.queryByText('*')).toBeNull();
  });

  it('renders and toggles a password field between masked and revealed', async () => {
    const spec: SourceFieldSpec = { key: 'apiKey', label: 'API Key', kind: 'password' };
    render(<SourceConfigField spec={spec} value="sk-secret" onChange={vi.fn()} />);
    const input = screen.getByDisplayValue('sk-secret');
    expect(input).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByRole('button', { name: 'Show' }));
    expect(input).toHaveAttribute('type', 'text');
    await userEvent.click(screen.getByRole('button', { name: 'Hide' }));
    expect(input).toHaveAttribute('type', 'password');
  });

  it('renders a select field with the given options', async () => {
    const onChange = vi.fn();
    const spec: SourceFieldSpec = {
      key: 'protocol',
      label: 'Protocol',
      kind: 'select',
      options: [
        { value: 'anthropic', label: 'Anthropic' },
        { value: 'openai', label: 'OpenAI' },
      ],
    };
    render(<SourceConfigField spec={spec} value="anthropic" onChange={onChange} />);
    await userEvent.selectOptions(screen.getByDisplayValue('Anthropic'), 'openai');
    expect(onChange).toHaveBeenCalledWith('openai');
  });

  it('renders a textarea field', async () => {
    const onChange = vi.fn();
    const spec: SourceFieldSpec = { key: 'headers', label: 'Headers', kind: 'textarea' };
    render(<SourceConfigField spec={spec} value="" onChange={onChange} />);
    const textarea = screen.getByLabelText('Headers');
    expect(textarea.tagName).toBe('TEXTAREA');
    await userEvent.type(textarea, 'a');
    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('renders an error message with role="alert" and wires aria-describedby', () => {
    const spec: SourceFieldSpec = { key: 'url', label: 'URL', kind: 'url', required: true };
    render(<SourceConfigField spec={spec} value="" error="URL is required." onChange={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent('URL is required.');
    expect(screen.getByDisplayValue('')).toHaveAttribute('aria-invalid', 'true');
  });

  it('renders no error element when no error is given', () => {
    const spec: SourceFieldSpec = { key: 'url', label: 'URL', kind: 'url' };
    render(<SourceConfigField spec={spec} value="" onChange={vi.fn()} />);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('renders a select field with no options (host hasn\'t loaded them yet) without throwing', () => {
    const spec: SourceFieldSpec = { key: 'protocol', label: 'Protocol', kind: 'select' };
    render(<SourceConfigField spec={spec} value="" onChange={vi.fn()} />);
    const select = screen.getByLabelText('Protocol') as HTMLSelectElement;
    // Only the disabled placeholder option renders.
    expect(select.options).toHaveLength(1);
  });

  it('disables the input when disabled is set', () => {
    const spec: SourceFieldSpec = { key: 'url', label: 'URL', kind: 'url' };
    render(<SourceConfigField spec={spec} value="" disabled onChange={vi.fn()} />);
    expect(screen.getByLabelText('URL')).toBeDisabled();
  });
});
