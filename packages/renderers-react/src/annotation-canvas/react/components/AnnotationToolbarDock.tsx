import { Icon, useT } from '@jini/ui';
import { closeButtonStyle, dockBaseStyle, noteActionsStyle, toolClusterStyle, toolbarStyle } from '../styles.js';
import type { AnnotationDockPlacement } from '../../types.js';
import { AttachImageButton } from './AttachImageButton.js';
import { CaptureWarningBanner } from './CaptureWarningBanner.js';
import { HistoryButtons } from './HistoryButtons.js';
import { ImageAttachmentStrip } from './ImageAttachmentStrip.js';
import { ImagePreviewModal } from './ImagePreviewModal.js';
import { MarkToolControl } from './MarkToolControl.js';
import { NoteInput } from './NoteInput.js';
import { SubmitControl } from './SubmitControl.js';
import type { AnnotationToolController } from '../hooks/useAnnotationTool.js';
import type { AnnotationDrawingController } from '../hooks/useAnnotationDrawing.js';
import type { AnnotationSubmitController } from '../hooks/useAnnotationSubmit.js';

export interface AnnotationToolbarDockProps {
  dockRef: React.RefObject<HTMLDivElement | null>;
  placement: AnnotationDockPlacement;
  tool: AnnotationToolController;
  drawing: AnnotationDrawingController;
  submit: AnnotationSubmitController;
  sending: boolean;
  chromeHidden: boolean;
  sendDisabled: boolean;
  sendDisabledReason?: string | undefined;
  onExit: () => void;
}

export function AnnotationToolbarDock({
  dockRef,
  placement,
  tool,
  drawing,
  submit,
  sending,
  chromeHidden,
  sendDisabled,
  sendDisabledReason,
  onExit,
}: AnnotationToolbarDockProps) {
  const t = useT();
  return (
    <div
      ref={dockRef}
      className="jini-annotation-dock"
      data-annotation-layout={placement.layout}
      data-annotation-side={placement.side ?? undefined}
      style={{ ...dockBaseStyle, ...placement.style }}
    >
      {submit.captureWarning ? <CaptureWarningBanner message={submit.captureWarning.message} chromeHidden={chromeHidden} /> : null}
      <ImageAttachmentStrip
        previews={submit.imagePreviews}
        sending={sending}
        chromeHidden={chromeHidden}
        onPreview={submit.setPreviewIndex}
        onRemove={submit.removeExtraFile}
      />
      <div className="jini-annotation-toolbar" style={{ ...toolbarStyle, visibility: chromeHidden ? 'hidden' : undefined }}>
        <div className="jini-annotation-tool-cluster" style={toolClusterStyle}>
          <MarkToolControl
            tool={tool.tool}
            onSelect={tool.selectTool}
            menuOpen={tool.menuOpen}
            onToggleMenu={tool.toggleMenu}
            menuRef={tool.menuRef}
            disabled={sending}
          />
          <HistoryButtons canUndo={drawing.canUndo} canRedo={drawing.canRedo} onUndo={drawing.undo} onRedo={drawing.redo} />
          <AttachImageButton disabled={sending} onFilesSelected={submit.addExtraFiles} />
        </div>
        <div className="jini-annotation-note-actions" style={noteActionsStyle}>
          <NoteInput
            value={submit.note}
            onChange={submit.setNote}
            onPaste={submit.onNotePaste}
            disabled={sending}
            onEnterQueue={() => void submit.send('queue')}
          />
          <SubmitControl
            menuRef={submit.submitMenuRef}
            submitAction={submit.submitAction}
            onSubmit={(action) => void submit.send(action)}
            onPick={submit.pickSubmitAction}
            menuOpen={submit.submitMenuOpen}
            onToggleMenu={submit.toggleSubmitMenu}
            sending={submit.sending}
            pendingAction={submit.pendingAction}
            canSend={submit.canSend}
            canAddToInput={submit.canAddToInput}
            canSubmit={submit.canSubmit}
            sendDisabled={sendDisabled}
            sendDisabledReason={sendDisabledReason}
          />
        </div>
        <button type="button" onClick={onExit} disabled={sending} aria-label={t('Close')} title={t('Close')} style={closeButtonStyle}>
          <Icon name="close" size={13} />
        </button>
      </div>
      {submit.previewIndex !== null && submit.imagePreviews[submit.previewIndex] ? (
        <ImagePreviewModal preview={submit.imagePreviews[submit.previewIndex]!} onClose={() => submit.setPreviewIndex(null)} />
      ) : null}
    </div>
  );
}
