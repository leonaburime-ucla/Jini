// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AssetCard } from './AssetCard.js';
import { I18nProvider } from '../../../i18n/index.js';

interface TestAsset {
  id: string;
}

const asset: TestAsset = { id: 'a1' };

function baseProps(overrides: Partial<React.ComponentProps<typeof AssetCard<TestAsset>>> = {}) {
  return {
    asset,
    index: 0,
    selected: false,
    title: 'My Asset',
    renderThumbnail: () => <div data-testid="thumb">thumb</div>,
    onToggle: vi.fn(),
    onRange: vi.fn(),
    onPreview: vi.fn(),
    ...overrides,
  };
}

describe('AssetCard', () => {
  it('renders the title and lazily mounts the thumbnail once in view', () => {
    render(<AssetCard {...baseProps()} />);
    expect(screen.getByText('My Asset')).toBeInTheDocument();
  });

  it('clicking the preview button calls onPreview by default', async () => {
    const onPreview = vi.fn();
    render(<AssetCard {...baseProps({ onPreview })} />);
    await userEvent.click(screen.getByRole('button', { name: 'Preview My Asset' }));
    expect(onPreview).toHaveBeenCalledWith('a1');
  });

  it('meta/ctrl-click on the preview button toggles selection instead', () => {
    const onToggle = vi.fn();
    const onPreview = vi.fn();
    render(<AssetCard {...baseProps({ onToggle, onPreview })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Preview My Asset' }), { metaKey: true });
    expect(onToggle).toHaveBeenCalledWith('a1', 0);
    expect(onPreview).not.toHaveBeenCalled();
  });

  it('shift-click on the preview button range-selects instead', () => {
    const onRange = vi.fn();
    render(<AssetCard {...baseProps({ onRange })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Preview My Asset' }), { shiftKey: true });
    expect(onRange).toHaveBeenCalledWith(0);
  });

  it('the select checkbox toggles, and shift-click range-selects', async () => {
    const onToggle = vi.fn();
    const onRange = vi.fn();
    render(<AssetCard {...baseProps({ onToggle, onRange })} />);
    await userEvent.click(screen.getByRole('button', { name: 'Select asset' }));
    expect(onToggle).toHaveBeenCalledWith('a1', 0);
    fireEvent.click(screen.getByRole('button', { name: 'Select asset' }), { shiftKey: true });
    expect(onRange).toHaveBeenCalledWith(0);
  });

  it('shows "Deselect asset" label when selected', () => {
    render(<AssetCard {...baseProps({ selected: true })} />);
    expect(screen.getByRole('button', { name: 'Deselect asset' })).toBeInTheDocument();
  });

  it('renders kind/source badges when supplied', () => {
    render(<AssetCard {...baseProps({ kindLabel: 'Image', sourceLabel: 'Upload' })} />);
    expect(screen.getByText('Image')).toBeInTheDocument();
    expect(screen.getByText('Upload')).toBeInTheDocument();
  });

  it('renders a generic Remove button wired to onDeleteAsset when supplied', async () => {
    const onDeleteAsset = vi.fn();
    render(<AssetCard {...baseProps({ onDeleteAsset })} />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(onDeleteAsset).toHaveBeenCalledWith('a1');
  });

  it('omits the Remove button and the actions row entirely when neither onDeleteAsset nor renderCardExtra is supplied', () => {
    render(<AssetCard {...baseProps()} />);
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
  });

  it('renders host-supplied renderCardExtra content', () => {
    render(<AssetCard {...baseProps({ renderCardExtra: () => <a href="/x">Open project</a> })} />);
    expect(screen.getByRole('link', { name: 'Open project' })).toBeInTheDocument();
  });

  it('translates its strings under an I18nProvider dictionary', async () => {
    render(
      <I18nProvider dictionaries={{ fr: { Remove: 'Supprimer', 'Select asset': 'Sélectionner' } }} initialLocale="fr">
        <AssetCard {...baseProps({ onDeleteAsset: vi.fn() })} />
      </I18nProvider>,
    );
    expect(screen.getByRole('button', { name: 'Supprimer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sélectionner' })).toBeInTheDocument();
  });
});
