import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../../../i18n/index.js';
import { CommentSidePanel } from '../../../react/components/CommentSidePanel.js';

interface TestComment {
  id: string;
  label: string;
  body: string;
  ts: number;
}

const comments: TestComment[] = [
  { id: 'c1', label: 'Button', body: 'Looks off', ts: 1000 },
  { id: 'c2', label: 'Header', body: 'Too big', ts: 2000 },
];

function baseProps(overrides: Partial<Parameters<typeof CommentSidePanel<TestComment>>[0]> = {}) {
  return {
    comments,
    selectedIds: new Set<string>(),
    activeCommentId: null,
    collapsed: false,
    onCollapsedChange: vi.fn(),
    onToggleSelect: vi.fn(),
    onSelectAll: vi.fn(),
    onClearSelection: vi.fn(),
    onReply: vi.fn(),
    onSendSelected: vi.fn(),
    sending: false,
    getCommentLabel: (c: TestComment) => c.label,
    getCommentTimestamp: (c: TestComment) => c.ts,
    getCommentBody: (c: TestComment) => c.body,
    ...overrides,
  };
}

describe('CommentSidePanel', () => {
  it('renders a collapsed rail with the comment count', () => {
    render(<CommentSidePanel {...baseProps({ collapsed: true })} />);
    expect(screen.getByTestId('comment-side-collapsed-rail')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders a collapsed rail with no count badge when there are no comments', () => {
    render(<CommentSidePanel {...baseProps({ collapsed: true, comments: [] })} />);
    const rail = screen.getByTestId('comment-side-collapsed-rail');
    expect(rail.querySelector('strong')).toBeNull();
  });

  it('expands from the collapsed rail', async () => {
    const onCollapsedChange = vi.fn();
    render(<CommentSidePanel {...baseProps({ collapsed: true, onCollapsedChange })} />);
    await userEvent.click(screen.getByTestId('comment-side-collapsed-rail'));
    expect(onCollapsedChange).toHaveBeenCalledWith(false);
  });

  it('collapses from the expanded header', async () => {
    const onCollapsedChange = vi.fn();
    render(<CommentSidePanel {...baseProps({ onCollapsedChange })} />);
    await userEvent.click(screen.getByLabelText('Hide Comments'));
    expect(onCollapsedChange).toHaveBeenCalledWith(true);
  });

  it('marks the active comment row with the active class and aria-current', () => {
    render(<CommentSidePanel {...baseProps({ activeCommentId: 'c1' })} />);
    const activeRow = screen.getByText('1. Button').closest('[data-testid="comment-side-item"]')!;
    expect(activeRow).toHaveClass('active');
    expect(activeRow).toHaveAttribute('aria-current', 'true');
    const inactiveRow = screen.getByText('2. Header').closest('[data-testid="comment-side-item"]')!;
    expect(inactiveRow).not.toHaveClass('active');
    expect(inactiveRow).not.toHaveAttribute('aria-current');
  });

  it('renders every comment with its label, index, and body', () => {
    render(<CommentSidePanel {...baseProps()} />);
    expect(screen.getByText('1. Button')).toBeInTheDocument();
    expect(screen.getByText('2. Header')).toBeInTheDocument();
    expect(screen.getByText('Looks off')).toBeInTheDocument();
    expect(screen.getByText('Too big')).toBeInTheDocument();
  });

  it('shows an empty state with no comments', () => {
    render(<CommentSidePanel {...baseProps({ comments: [] })} />);
    expect(screen.getByText('No comments yet')).toBeInTheDocument();
  });

  it('calls onReply when a comment row is clicked', async () => {
    const onReply = vi.fn();
    render(<CommentSidePanel {...baseProps({ onReply })} />);
    await userEvent.click(screen.getByText('1. Button'));
    expect(onReply).toHaveBeenCalledWith(comments[0]);
  });

  it('calls onToggleSelect from the row checkbox without triggering onReply', async () => {
    const onToggleSelect = vi.fn();
    const onReply = vi.fn();
    render(<CommentSidePanel {...baseProps({ onToggleSelect, onReply })} />);
    const [firstCheck] = screen.getAllByLabelText('Select');
    await userEvent.click(firstCheck!);
    expect(onToggleSelect).toHaveBeenCalledWith('c1');
    expect(onReply).not.toHaveBeenCalled();
  });

  it('disables select-all once everything is already selected', () => {
    render(<CommentSidePanel {...baseProps({ selectedIds: new Set(['c1', 'c2']) })} />);
    expect(screen.getByText('Select all')).toBeDisabled();
  });

  it('shows the select-bar with a count once something is selected', () => {
    render(<CommentSidePanel {...baseProps({ selectedIds: new Set(['c1']) })} />);
    expect(screen.getByTestId('comment-side-selectbar')).toBeInTheDocument();
    expect(screen.getByText('1 selected')).toBeInTheDocument();
  });

  it('calls onClearSelection and onSendSelected from the select-bar', async () => {
    const onClearSelection = vi.fn();
    const onSendSelected = vi.fn();
    render(<CommentSidePanel {...baseProps({ selectedIds: new Set(['c1']), onClearSelection, onSendSelected })} />);
    await userEvent.click(screen.getByText('Clear'));
    expect(onClearSelection).toHaveBeenCalled();
    await userEvent.click(screen.getByTestId('comment-side-send-claude'));
    expect(onSendSelected).toHaveBeenCalled();
  });

  it('shows "Queue" instead of "Send to chat" when queueOnSend is set', () => {
    render(<CommentSidePanel {...baseProps({ selectedIds: new Set(['c1']), queueOnSend: true })} />);
    expect(screen.getByText('Queue')).toBeInTheDocument();
  });

  it('shows "Sending…" on the select-bar send button while sending', () => {
    render(<CommentSidePanel {...baseProps({ selectedIds: new Set(['c1']), sending: true })} />);
    expect(screen.getByTestId('comment-side-send-claude')).toHaveTextContent('Sending…');
  });

  it('shows a sending state on the new-comment submit button while sending', () => {
    render(<CommentSidePanel {...baseProps({ onCreateComment: vi.fn(), sending: true })} />);
    const submitButton = screen.getByRole('button', { name: /Sending…/ });
    expect(submitButton).toHaveClass('is-sending');
  });

  it('submits a new comment through the create form', async () => {
    const onCreateComment = vi.fn().mockResolvedValue(true);
    render(<CommentSidePanel {...baseProps({ onCreateComment })} />);
    const textarea = screen.getByPlaceholderText('Add a comment…');
    await userEvent.type(textarea, 'A new note');
    await userEvent.click(screen.getByRole('button', { name: /^Send$/ }));
    expect(onCreateComment).toHaveBeenCalledWith('A new note');
  });

  it('submits the new comment on Cmd/Ctrl+Enter from the textarea', async () => {
    const onCreateComment = vi.fn().mockResolvedValue(true);
    render(<CommentSidePanel {...baseProps({ onCreateComment })} />);
    const textarea = screen.getByPlaceholderText('Add a comment…');
    await userEvent.type(textarea, 'Quick note');
    fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true });
    expect(onCreateComment).toHaveBeenCalledWith('Quick note');
  });

  it('Cmd+Enter on an empty/whitespace-only draft does not submit', () => {
    const onCreateComment = vi.fn().mockResolvedValue(true);
    render(<CommentSidePanel {...baseProps({ onCreateComment })} />);
    const textarea = screen.getByPlaceholderText('Add a comment…');
    fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true });
    expect(onCreateComment).not.toHaveBeenCalled();
  });

  it('does not submit on a plain Enter in the textarea (allows multi-line drafts)', async () => {
    const onCreateComment = vi.fn().mockResolvedValue(true);
    render(<CommentSidePanel {...baseProps({ onCreateComment })} />);
    const textarea = screen.getByPlaceholderText('Add a comment…');
    await userEvent.type(textarea, 'Quick note');
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(onCreateComment).not.toHaveBeenCalled();
  });

  it('keeps the submit button disabled with an empty draft', () => {
    render(<CommentSidePanel {...baseProps({ onCreateComment: vi.fn() })} />);
    expect(screen.getByRole('button', { name: /^Send$/ })).toBeDisabled();
  });

  it('does not render the create form when renderCreateForm is false', () => {
    render(<CommentSidePanel {...baseProps({ onCreateComment: vi.fn(), renderCreateForm: false })} />);
    expect(screen.queryByPlaceholderText('Add a comment…')).toBeNull();
  });

  it('renders a composer slot when given', () => {
    render(<CommentSidePanel {...baseProps({ composer: <div>custom composer</div> })} />);
    expect(screen.getByText('custom composer')).toBeInTheDocument();
  });

  it('renders attachments only when a resolver is supplied', () => {
    const withAttachments = baseProps({
      getCommentAttachments: () => [{ path: 'a.png', name: 'a.png' }],
      resolveAttachmentUrl: (a) => `/raw/${a.path}`,
    });
    render(<CommentSidePanel {...withAttachments} />);
    const attachment = screen.getAllByTestId('comment-side-attachment')[0];
    expect(attachment).toHaveAttribute('href', '/raw/a.png');
  });

  it('clicking an attachment link does not also trigger the row onReply', () => {
    const onReply = vi.fn();
    render(
      <CommentSidePanel
        {...baseProps({
          onReply,
          getCommentAttachments: () => [{ path: 'a.png', name: 'a.png' }],
          resolveAttachmentUrl: (a) => `/raw/${a.path}`,
        })}
      />,
    );
    fireEvent.click(screen.getAllByTestId('comment-side-attachment')[0]!);
    expect(onReply).not.toHaveBeenCalled();
  });

  it('shows the drop-edge indicator class while a comment is being dragged over another', () => {
    render(<CommentSidePanel {...baseProps({ onReorder: vi.fn() })} />);
    const dragHandle = screen.getAllByLabelText('Drag to reorder')[0]!;
    const dataTransfer = { setData: vi.fn(), getData: vi.fn(() => ''), dropEffect: '' };
    fireEvent.dragStart(dragHandle, { dataTransfer });

    const firstRow = screen.getByText('1. Button').closest('[data-testid="comment-side-item"]')!;
    expect(firstRow).toHaveClass('dragging');

    const secondRow = screen.getByText('2. Header').closest('[data-testid="comment-side-item"]')!;
    fireEvent.dragOver(secondRow, { dataTransfer, clientY: 1000 });
    expect(secondRow.className).toMatch(/comment-side-item-drop-/);

    fireEvent.dragEnd(dragHandle);
  });

  it('formats the timestamp using the default relative-time translation', () => {
    const now = 1_700_000;
    const recentComments: TestComment[] = [{ id: 'c1', label: 'Recent', body: 'x', ts: now - 5 * 60_000 }];
    const originalNow = Date.now;
    Date.now = () => now;
    render(<CommentSidePanel {...baseProps({ comments: recentComments })} />);
    expect(screen.getByText('5 minutes ago')).toBeInTheDocument();
    Date.now = originalNow;
  });

  it('honors a custom formatTimestamp override', () => {
    render(<CommentSidePanel {...baseProps({ formatTimestamp: () => 'custom time' })} />);
    expect(screen.getAllByText('custom time')).toHaveLength(2);
  });

  it('moves focus to the collapsed rail after collapsing, and back to the toggle after re-expanding', async () => {
    function Wrapper() {
      const [collapsed, setCollapsed] = useState(false);
      return <CommentSidePanel {...baseProps({ collapsed, onCollapsedChange: setCollapsed })} />;
    }
    render(<Wrapper />);
    await userEvent.click(screen.getByLabelText('Hide Comments'));
    expect(screen.getByTestId('comment-side-collapsed-rail')).toHaveFocus();
    await userEvent.click(screen.getByTestId('comment-side-collapsed-rail'));
    expect(screen.getByLabelText('Hide Comments')).toHaveFocus();
  });

  it('triggers onReply on Enter/Space and ignores other keys', () => {
    const onReply = vi.fn();
    render(<CommentSidePanel {...baseProps({ onReply })} />);
    const row = screen.getByText('1. Button').closest('[data-testid="comment-side-item"]')!;
    fireEvent.keyDown(row, { key: 'a' });
    expect(onReply).not.toHaveBeenCalled();
    fireEvent.keyDown(row, { key: 'Enter' });
    expect(onReply).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(row, { key: ' ' });
    expect(onReply).toHaveBeenCalledTimes(2);
  });

  it('reorders comments via drag/dragover/drop on the row, and the drag handle click does not trigger onReply', () => {
    const onReorder = vi.fn();
    const onReply = vi.fn();
    render(<CommentSidePanel {...baseProps({ onReorder, onReply })} />);

    const dragHandle = screen.getAllByLabelText('Drag to reorder')[0]!;
    fireEvent.click(dragHandle);
    expect(onReply).not.toHaveBeenCalled();

    const dataTransfer = { setData: vi.fn(), getData: vi.fn(() => ''), dropEffect: '' };
    fireEvent.dragStart(dragHandle, { dataTransfer });

    const secondRow = screen.getByText('2. Header').closest('[data-testid="comment-side-item"]')!;
    fireEvent.dragOver(secondRow, { dataTransfer, clientY: 1000 });
    fireEvent.drop(secondRow, { dataTransfer, clientY: 1000 });
    expect(onReorder).toHaveBeenCalledWith(['c2', 'c1']);

    fireEvent.dragEnd(dragHandle);
  });

  it('translates its chrome strings through I18nProvider end-to-end', () => {
    render(
      <I18nProvider
        dictionaries={{
          fr: {
            Comments: 'Commentaires',
            'Select all': 'Tout sélectionner',
            'No comments yet': 'Aucun commentaire',
          },
        }}
        initialLocale="fr"
      >
        <CommentSidePanel {...baseProps()} />
      </I18nProvider>,
    );
    expect(screen.getByText('Commentaires')).toBeInTheDocument();
    expect(screen.getByText('Tout sélectionner')).toBeInTheDocument();
  });
});
