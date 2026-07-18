import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CommentSideDock } from './CommentSideDock.js';

interface TestComment {
  id: string;
}

function baseProps(overrides: Partial<Parameters<typeof CommentSideDock<TestComment>>[0]> = {}) {
  return {
    comments: [{ id: 'c1' }],
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
    getCommentLabel: () => 'Label',
    getCommentTimestamp: () => 0,
    getCommentBody: () => 'body',
    ...overrides,
  };
}

describe('CommentSideDock', () => {
  it('wraps CommentSidePanel with a dock container', () => {
    render(<CommentSideDock {...baseProps()} />);
    expect(screen.getByTestId('comment-side-dock')).toBeInTheDocument();
    expect(screen.getByTestId('comment-side-panel')).toBeInTheDocument();
  });

  it('adds the collapsed modifier class when collapsed', () => {
    render(<CommentSideDock {...baseProps({ collapsed: true })} />);
    expect(screen.getByTestId('comment-side-dock')).toHaveClass('collapsed');
  });

  it('omits the collapsed modifier class when expanded', () => {
    render(<CommentSideDock {...baseProps({ collapsed: false })} />);
    expect(screen.getByTestId('comment-side-dock')).not.toHaveClass('collapsed');
  });
});
