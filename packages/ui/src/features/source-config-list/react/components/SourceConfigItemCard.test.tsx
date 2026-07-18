import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SourceConfigItemCard } from './SourceConfigItemCard.js';
import type { ComponentProps } from 'react';
import type { SourceConfigListCapabilities } from '../hooks/useSourceConfigList.js';
import type { SourceConfigItem, SourceFieldSpec, SourceTrustOption } from '../../types.js';

const URL_FIELD: SourceFieldSpec = { key: 'url', label: 'URL', kind: 'url' };
const KEY_FIELD: SourceFieldSpec = { key: 'apiKey', label: 'API Key', kind: 'password' };
const TRUST_OPTIONS: SourceTrustOption[] = [
  { value: 'restricted', label: 'Restricted' },
  { value: 'trusted', label: 'Trusted' },
];
const FULL_CAPS: SourceConfigListCapabilities = { canRefresh: true, canSetTrust: true, canTest: true };
const NO_CAPS: SourceConfigListCapabilities = { canRefresh: false, canSetTrust: false, canTest: false };

function baseProps(overrides: Partial<ComponentProps<typeof SourceConfigItemCard>> = {}) {
  const source: SourceConfigItem = { id: 's1', fields: { url: 'https://a.example' } };
  return {
    source,
    fieldSpecs: [URL_FIELD],
    capabilities: FULL_CAPS,
    removing: false,
    refreshing: false,
    settingTrust: false,
    testing: false,
    onRefresh: vi.fn(),
    onRemove: vi.fn(),
    onTrustChange: vi.fn(),
    onTest: vi.fn(),
    ...overrides,
  };
}

describe('SourceConfigItemCard', () => {
  it('renders the display label from the source fields when no explicit label is set', () => {
    render(<SourceConfigItemCard {...baseProps()} />);
    expect(screen.getByText('https://a.example')).toBeInTheDocument();
  });

  it('starts collapsed: field details are not shown until expanded', () => {
    render(<SourceConfigItemCard {...baseProps()} />);
    expect(screen.queryByText('URL')).toBeNull();
  });

  it('expands to show masked field values on click', async () => {
    const source: SourceConfigItem = { id: 's1', fields: { apiKey: 'sk-ant-1234567890wxyz' } };
    const { container } = render(<SourceConfigItemCard {...baseProps({ source, fieldSpecs: [KEY_FIELD] })} />);
    // The summary label itself is also masked (no explicit `label`, and the
    // one field is password-kind — see rules.ts's `sourceDisplayLabel`).
    await userEvent.click(screen.getByRole('button', { name: /wxyz$/ }));
    expect(screen.getByText('API Key')).toBeInTheDocument();
    const maskedValue = container.querySelector('.source-config-item-card-fields dd');
    expect(maskedValue?.textContent).toMatch(/^•+wxyz$/);
    expect(screen.queryByText('sk-ant-1234567890wxyz')).toBeNull();
  });

  it('collapses again on a second click', async () => {
    render(<SourceConfigItemCard {...baseProps()} />);
    const toggle = screen.getByRole('button', { name: 'https://a.example' });
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('renders a trust badge when the source has a trust value, using the option label when known', () => {
    const source: SourceConfigItem = { id: 's1', fields: {}, trust: 'trusted' };
    const { container } = render(<SourceConfigItemCard {...baseProps({ source, trustOptions: TRUST_OPTIONS })} />);
    expect(container.querySelector('.source-config-item-card-trust-badge')?.textContent).toBe('Trusted');
  });

  it('falls back to the raw trust value in the badge when no matching option exists', () => {
    const source: SourceConfigItem = { id: 's1', fields: {}, trust: 'mystery' };
    render(<SourceConfigItemCard {...baseProps({ source })} />);
    expect(screen.getByText('mystery')).toBeInTheDocument();
  });

  it('renders no trust badge when the source has no trust value', () => {
    render(<SourceConfigItemCard {...baseProps()} />);
    expect(screen.queryByText('Restricted')).toBeNull();
  });

  it('renders a trust select and reports changes when canSetTrust and trustOptions are both present', async () => {
    const source: SourceConfigItem = { id: 's1', fields: {}, trust: 'restricted' };
    const onTrustChange = vi.fn();
    render(<SourceConfigItemCard {...baseProps({ source, trustOptions: TRUST_OPTIONS, onTrustChange })} />);
    const select = screen.getByDisplayValue('Restricted');
    await userEvent.selectOptions(select, 'trusted');
    expect(onTrustChange).toHaveBeenCalledWith('trusted');
  });

  it('does not render a trust select when capabilities.canSetTrust is false, even with trustOptions given', () => {
    render(<SourceConfigItemCard {...baseProps({ capabilities: NO_CAPS, trustOptions: TRUST_OPTIONS })} />);
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('does not render a trust select when trustOptions is omitted, even with canSetTrust true', () => {
    render(<SourceConfigItemCard {...baseProps({ capabilities: FULL_CAPS })} />);
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('renders the trust select defaulted to empty when the source has no trust value yet', () => {
    const source: SourceConfigItem = { id: 's1', fields: {} };
    render(<SourceConfigItemCard {...baseProps({ source, trustOptions: TRUST_OPTIONS })} />);
    expect(screen.getByRole('combobox')).toHaveValue('');
  });

  it('renders a Refresh button only when capabilities.canRefresh is true, and calls onRefresh', async () => {
    const onRefresh = vi.fn();
    render(<SourceConfigItemCard {...baseProps({ onRefresh })} />);
    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('omits the Refresh button when capabilities.canRefresh is false', () => {
    render(<SourceConfigItemCard {...baseProps({ capabilities: NO_CAPS })} />);
    expect(screen.queryByRole('button', { name: /Refresh/ })).toBeNull();
  });

  it('shows a Refreshing… label while refreshing and disables other actions', () => {
    render(<SourceConfigItemCard {...baseProps({ refreshing: true })} />);
    expect(screen.getByRole('button', { name: 'Refreshing…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Remove' })).toBeDisabled();
  });

  it('calls onRemove and shows a Removing… label while removing', () => {
    render(<SourceConfigItemCard {...baseProps({ removing: true })} />);
    expect(screen.getByRole('button', { name: 'Removing…' })).toBeDisabled();
  });

  it('calls onRemove when the remove button is clicked', async () => {
    const onRemove = vi.fn();
    render(<SourceConfigItemCard {...baseProps({ onRemove })} />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('renders the test control only when expanded and capabilities.canTest is true', async () => {
    render(<SourceConfigItemCard {...baseProps()} />);
    expect(screen.queryByRole('button', { name: 'Test' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'https://a.example' }));
    expect(screen.getByRole('button', { name: 'Test' })).toBeInTheDocument();
  });

  it('omits the test control entirely when capabilities.canTest is false, even when expanded', async () => {
    render(<SourceConfigItemCard {...baseProps({ capabilities: NO_CAPS })} />);
    await userEvent.click(screen.getByRole('button', { name: 'https://a.example' }));
    expect(screen.queryByRole('button', { name: 'Test' })).toBeNull();
  });

  it('calls onTest from the expanded test control', async () => {
    const onTest = vi.fn();
    render(<SourceConfigItemCard {...baseProps({ onTest })} />);
    await userEvent.click(screen.getByRole('button', { name: 'https://a.example' }));
    await userEvent.click(screen.getByRole('button', { name: 'Test' }));
    expect(onTest).toHaveBeenCalledTimes(1);
  });

  it('renders an empty masked value when the source is missing a field spec\'s key entirely', async () => {
    const source: SourceConfigItem = { id: 's1', fields: {} };
    const { container } = render(<SourceConfigItemCard {...baseProps({ source, fieldSpecs: [URL_FIELD] })} />);
    await userEvent.click(screen.getByRole('button', { name: 's1' }));
    const value = container.querySelector('.source-config-item-card-fields dd');
    expect(value?.textContent).toBe('');
  });

  it('passes the testResult through to the test control once expanded', async () => {
    render(<SourceConfigItemCard {...baseProps({ testResult: { ok: true, message: 'All good.' } })} />);
    await userEvent.click(screen.getByRole('button', { name: 'https://a.example' }));
    expect(screen.getByRole('status')).toHaveTextContent('All good.');
  });
});
