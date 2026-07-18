import { useState, type DragEvent as ReactDragEvent } from 'react';
import { COMMENT_SIDE_DRAG_MIME } from '../../constants.js';
import { dropEdgeForClientY, reorderCommentIds } from '../../rules.js';
import type { CommentSideDragState } from '../../types.js';

export interface UseCommentReorderResult {
  dragState: CommentSideDragState | null;
  canReorder: boolean;
  onDragStart: (event: ReactDragEvent<HTMLElement>, id: string) => void;
  onDragOver: (event: ReactDragEvent<HTMLElement>, targetId: string) => void;
  onDrop: (event: ReactDragEvent<HTMLElement>, targetId: string) => void;
  onDragLeaveContainer: (event: ReactDragEvent<HTMLElement>) => void;
  clear: () => void;
}

/**
 * Drag-and-drop reorder state machine for `CommentSidePanel`'s comment
 * list — extracted out of the presentational component so the (fiddly,
 * worth-testing-in-isolation) drag/dragover/drop bookkeeping isn't tangled
 * with JSX.
 */
export function useCommentReorder(
  orderedIds: string[],
  onReorder: ((orderedIds: string[]) => void) | undefined,
): UseCommentReorderResult {
  const [dragState, setDragState] = useState<CommentSideDragState | null>(null);
  const canReorder = Boolean(onReorder && orderedIds.length > 1);

  function onDragStart(event: ReactDragEvent<HTMLElement>, id: string) {
    if (!canReorder) return;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData(COMMENT_SIDE_DRAG_MIME, id);
    event.dataTransfer.setData('text/plain', id);
    setDragState({ draggingId: id, overId: id, edge: null });
  }

  function onDragOver(event: ReactDragEvent<HTMLElement>, targetId: string) {
    if (!canReorder) return;
    const draggingId = dragState?.draggingId || event.dataTransfer.getData(COMMENT_SIDE_DRAG_MIME);
    if (!draggingId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (draggingId === targetId) {
      if (dragState?.overId !== targetId || dragState.edge !== null) {
        setDragState({ draggingId, overId: targetId, edge: null });
      }
      return;
    }
    const edge = dropEdgeForClientY(event.clientY, event.currentTarget.getBoundingClientRect());
    if (dragState?.draggingId !== draggingId || dragState.overId !== targetId || dragState.edge !== edge) {
      setDragState({ draggingId, overId: targetId, edge });
    }
  }

  function onDrop(event: ReactDragEvent<HTMLElement>, targetId: string) {
    if (!canReorder) return;
    event.preventDefault();
    const draggingId =
      dragState?.draggingId ||
      event.dataTransfer.getData(COMMENT_SIDE_DRAG_MIME) ||
      event.dataTransfer.getData('text/plain');
    if (!draggingId || draggingId === targetId) {
      setDragState(null);
      return;
    }
    const edge =
      dragState?.overId === targetId && dragState.edge
        ? dragState.edge
        : dropEdgeForClientY(event.clientY, event.currentTarget.getBoundingClientRect());
    const nextIds = reorderCommentIds(orderedIds, draggingId, targetId, edge);
    if (nextIds.join('\0') !== orderedIds.join('\0')) {
      onReorder?.(nextIds);
    }
    setDragState(null);
  }

  function onDragLeaveContainer(event: ReactDragEvent<HTMLElement>) {
    const related = event.relatedTarget;
    if (related instanceof Node && event.currentTarget.contains(related)) return;
    setDragState(null);
  }

  function clear() {
    setDragState(null);
  }

  return { dragState, canReorder, onDragStart, onDragOver, onDrop, onDragLeaveContainer, clear };
}
