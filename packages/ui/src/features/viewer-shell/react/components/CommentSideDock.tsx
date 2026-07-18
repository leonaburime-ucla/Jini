import { CommentSidePanel, type CommentSidePanelProps } from './CommentSidePanel.js';
import type { ViewerCommentBase } from '../../types.js';

export type CommentSideDockProps<TComment extends ViewerCommentBase> = CommentSidePanelProps<TComment>;

/**
 * A thin docked wrapper around `CommentSidePanel` — the source component's
 * `CommentSideDock` was a one-line pass-through adding a `.collapsed`
 * modifier class around the same panel, ported as-is.
 */
export function CommentSideDock<TComment extends ViewerCommentBase>(props: CommentSideDockProps<TComment>) {
  return (
    <div className={`comment-side-dock${props.collapsed ? ' collapsed' : ''}`} data-testid="comment-side-dock">
      <CommentSidePanel {...props} />
    </div>
  );
}
