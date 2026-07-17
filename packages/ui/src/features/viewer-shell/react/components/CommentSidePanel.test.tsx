import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../../i18n/index.js';
import { CommentSidePanel } from './CommentSidePanel.js';

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

  it('submits a new comment through the create form', async () => {
    const onCreateComment = vi.fn().mockResolvedValue(true);
    render(<CommentSidePanel {...baseProps({ onCreateComment })} />);
    const textarea = screen.getByPlaceholderText('Add a comment…');
    await userEvent.type(textarea, 'A new note');
    await userEvent.click(screen.getByRole('button', { name: /^Send$/ }));
    expect(onCreateComment).toHaveBeenCalledWith('A new note');
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
