import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../../i18n/index.js';
import { ListDetailPanel } from './ListDetailPanel.js';

interface Item {
  id: string;
  title: string;
}

const items: Item[] = [
  { id: 'a', title: 'Alpha' },
  { id: 'b', title: 'Bravo' },
];

describe('ListDetailPanel', () => {
  it('renders every row via renderItem and marks the selected one active', () => {
    render(
      <ListDetailPanel
        items={items}
        selectedId="b"
        onSelect={() => {}}
        renderItem={(item) => item.title}
        renderDetail={(item) => <div>{item.title} detail</div>}
      />,
    );
    const rowA = screen.getByTestId('list-detail-panel-item-a');
    const rowB = screen.getByTestId('list-detail-panel-item-b');
    expect(rowA).toHaveAttribute('aria-pressed', 'false');
    expect(rowB).toHaveAttribute('aria-pressed', 'true');
    expect(rowB).toHaveAttribute('data-active', 'true');
  });

  it('renders the detail pane for the selected item', () => {
    render(
      <ListDetailPanel
        items={items}
        selectedId="a"
        onSelect={() => {}}
        renderItem={(item) => item.title}
        renderDetail={(item) => <div>{item.title} detail</div>}
      />,
    );
    expect(screen.getByText('Alpha detail')).toBeInTheDocument();
  });

  it('calls onSelect with the clicked row id', () => {
    const onSelect = vi.fn();
    render(
      <ListDetailPanel
        items={items}
        selectedId="a"
        onSelect={onSelect}
        renderItem={(item) => item.title}
        renderDetail={(item) => <div>{item.title} detail</div>}
      />,
    );
    fireEvent.click(screen.getByTestId('list-detail-panel-item-b'));
    expect(onSelect).toHaveBeenCalledWith('b');
  });

  it('shows emptyListContent when items is empty', () => {
    render(
      <ListDetailPanel<Item>
        items={[]}
        selectedId={null}
        onSelect={() => {}}
        renderItem={(item) => item.title}
        renderDetail={(item) => <div>{item.title} detail</div>}
        emptyListContent={<div>No items</div>}
      />,
    );
    expect(screen.getByText('No items')).toBeInTheDocument();
  });

  it('shows emptyDetailContent when nothing is selected', () => {
    render(
      <ListDetailPanel
        items={items}
        selectedId={null}
        onSelect={() => {}}
        renderItem={(item) => item.title}
        renderDetail={(item) => <div>{item.title} detail</div>}
        emptyDetailContent={<div>Pick something</div>}
      />,
    );
    expect(screen.getByText('Pick something')).toBeInTheDocument();
  });

  it('shows emptyDetailContent when selectedId points at a missing item', () => {
    render(
      <ListDetailPanel
        items={items}
        selectedId="missing"
        onSelect={() => {}}
        renderItem={(item) => item.title}
        renderDetail={(item) => <div>{item.title} detail</div>}
        emptyDetailContent={<div>Pick something</div>}
      />,
    );
    expect(screen.getByText('Pick something')).toBeInTheDocument();
  });

  it('replaces the sidebar list and detail with loading content when loading', () => {
    render(
      <ListDetailPanel
        items={items}
        selectedId="a"
        onSelect={() => {}}
        renderItem={(item) => item.title}
        renderDetail={(item) => <div>{item.title} detail</div>}
        loading
        loadingSidebarContent={<div>Sidebar skeleton</div>}
        loadingDetailContent={<div>Detail skeleton</div>}
      />,
    );
    expect(screen.getByText('Sidebar skeleton')).toBeInTheDocument();
    expect(screen.getByText('Detail skeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('list-detail-panel-item-a')).toBeNull();
    expect(screen.queryByText('Alpha detail')).toBeNull();
    expect(screen.getAllByRole('status')).toHaveLength(2);
  });

  it('renders the header slot above the list', () => {
    render(
      <ListDetailPanel
        items={items}
        selectedId="a"
        onSelect={() => {}}
        renderItem={(item) => item.title}
        renderDetail={(item) => <div>{item.title} detail</div>}
        header={<div>Search box</div>}
      />,
    );
    expect(screen.getByText('Search box')).toBeInTheDocument();
  });

  it('applies a static itemClassName', () => {
    render(
      <ListDetailPanel
        items={items}
        selectedId="a"
        onSelect={() => {}}
        renderItem={(item) => item.title}
        renderDetail={(item) => <div>{item.title} detail</div>}
        itemClassName="my-row"
      />,
    );
    expect(screen.getByTestId('list-detail-panel-item-a')).toHaveClass('my-row');
  });

  it('applies a function itemClassName driven by active state', () => {
    render(
      <ListDetailPanel
        items={items}
        selectedId="a"
        onSelect={() => {}}
        renderItem={(item) => item.title}
        renderDetail={(item) => <div>{item.title} detail</div>}
        itemClassName={(item, state) => (state.active ? `${item.id}-active` : `${item.id}-inactive`)}
      />,
    );
    expect(screen.getByTestId('list-detail-panel-item-a')).toHaveClass('a-active');
    expect(screen.getByTestId('list-detail-panel-item-b')).toHaveClass('b-inactive');
  });

  it('sets a custom aria-label via getItemAriaLabel', () => {
    render(
      <ListDetailPanel
        items={items}
        selectedId="a"
        onSelect={() => {}}
        renderItem={(item) => item.title}
        renderDetail={(item) => <div>{item.title} detail</div>}
        getItemAriaLabel={(item) => `Open ${item.title}`}
      />,
    );
    expect(screen.getByTestId('list-detail-panel-item-a')).toHaveAttribute('aria-label', 'Open Alpha');
  });

  it('honors a custom data-testid prefix', () => {
    render(
      <ListDetailPanel
        items={items}
        selectedId="a"
        onSelect={() => {}}
        renderItem={(item) => item.title}
        renderDetail={(item) => <div>{item.title} detail</div>}
        data-testid="my-panel"
      />,
    );
    expect(screen.getByTestId('my-panel')).toBeInTheDocument();
    expect(screen.getByTestId('my-panel-sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('my-panel-list')).toBeInTheDocument();
    expect(screen.getByTestId('my-panel-detail')).toBeInTheDocument();
    expect(screen.getByTestId('my-panel-item-a')).toBeInTheDocument();
  });

  it('translates the loading aria-label through I18nProvider', () => {
    render(
      <I18nProvider dictionaries={{ fr: { Loading: 'Chargement' } }} initialLocale="fr">
        <ListDetailPanel
          items={items}
          selectedId="a"
          onSelect={() => {}}
          renderItem={(item) => item.title}
          renderDetail={(item) => <div>{item.title} detail</div>}
          loading
        />
      </I18nProvider>,
    );
    expect(screen.getAllByLabelText('Chargement')).toHaveLength(2);
  });
});
