import { useRef, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { useT } from '../../../i18n/index.js';
import { SegmentedToggle } from './SegmentedToggle.js';
import { ViewerShell } from './ViewerShell.js';
import { useMarkdownScrollSync } from '../hooks/useMarkdownScrollSync.js';
import type { MarkdownSplitPaneMode } from '../../types.js';

export interface MarkdownSplitPaneProps {
  mode: MarkdownSplitPaneMode;
  onModeChange: (mode: MarkdownSplitPaneMode) => void;
  sourceText: string;
  onSourceChange: (text: string) => void;
  /** Host-rendered markdown HTML (`renderMarkdownToSafeHtml`-shaped — the
   *  actual renderer, shiki highlighting, and image-src-rewriting are all
   *  genuinely OD/product-specific and were not ported; see
   *  `packages/ui/source-map.md`). `null` while loading. */
  previewHtml: string | null;
  /** CSS selector for the rendered preview's root element, forwarded to the
   *  scroll-sync measurement (default `.markdown-rendered`). */
  previewSelector?: string;
  loading?: boolean;
  loadingLabel?: string;
  sourceLabel?: string;
  splitLabel?: string;
  previewLabel?: string;
  editorAriaLabel?: string;
  previewAriaLabel?: string;
  modeAriaLabel?: string;
  /** Extra left-of-tabs toolbar content (e.g. a host's streaming/error
   *  status label). */
  toolbarLeftExtra?: ReactNode;
  /** Right-aligned toolbar content — a host's save-status indicator,
   *  copy/download buttons, etc. (all genuinely host-specific). */
  toolbarActions?: ReactNode;
  /** Extra props spread onto the editor `<textarea>` (e.g. `onPaste`/
   *  `onDrop` handlers a host wires for image upload — not implemented
   *  here, since that's a product-specific upload pipeline). */
  editorTextareaProps?: Record<string, unknown>;
  /** Click handler on the rendered preview `<article>` — a host uses this
   *  to delegate code-block "copy" button clicks, etc. */
  onPreviewClick?: (event: ReactMouseEvent<HTMLElement>) => void;
}

/**
 * The generic core of the source component's `MarkdownViewer`: a
 * source/split/preview mode toggle plus a two-pane layout whose scroll
 * positions stay aligned via block-anchored scroll-sync
 * (`useMarkdownScrollSync`). Ported without the artifact-status gate that
 * the extraction plan called out — and, per a closer read than the plan's
 * one-line description, also without the autosave/debounce-write pipeline,
 * image paste/drop upload, and shiki-based code-block syntax highlighting,
 * all of which are genuinely product/daemon-specific (see
 * `packages/ui/source-map.md` for the full disclosure). A host renders its
 * own markdown-to-HTML pipeline and passes the result as `previewHtml`.
 */
export function MarkdownSplitPane({
  mode,
  onModeChange,
  sourceText,
  onSourceChange,
  previewHtml,
  previewSelector,
  loading = false,
  loadingLabel,
  sourceLabel,
  splitLabel,
  previewLabel,
  editorAriaLabel,
  previewAriaLabel,
  modeAriaLabel,
  toolbarLeftExtra,
  toolbarActions,
  editorTextareaProps,
  onPreviewClick,
}: MarkdownSplitPaneProps) {
  const t = useT();
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const previewRef = useRef<HTMLElement | null>(null);

  const { handleEditorScroll, handlePreviewScroll, activatePane } = useMarkdownScrollSync({
    mode,
    sourceText,
    editorRef,
    previewRef,
    previewSelector,
    resyncKey: previewHtml,
  });

  const showEditor = mode === 'source' || mode === 'split';
  const showPreview = mode === 'preview' || mode === 'split';
  const isLoading = loading || previewHtml === null;

  return (
    <ViewerShell
      kindClassName="markdown-split-viewer"
      bodyClassName={`markdown-workbench markdown-workbench-${mode}`}
      toolbarLeft={
        <>
          {toolbarLeftExtra}
          <SegmentedToggle
            className="markdown-mode-tabs"
            ariaLabel={modeAriaLabel ?? t('Markdown view mode')}
            value={mode}
            onChange={onModeChange}
            options={[
              { value: 'source', label: sourceLabel ?? t('Source') },
              { value: 'split', label: splitLabel ?? t('Split') },
              { value: 'preview', label: previewLabel ?? t('Preview') },
            ]}
          />
        </>
      }
      toolbarActions={toolbarActions}
    >
      {isLoading ? (
        <div className="viewer-empty">{loadingLabel ?? t('Loading…')}</div>
      ) : (
        <>
          {showEditor ? (
            <section className="markdown-editor-pane" aria-label={editorAriaLabel ?? t('Markdown editor')}>
              <textarea
                ref={editorRef}
                className="markdown-editor"
                value={sourceText}
                aria-label={editorAriaLabel ?? t('Markdown editor')}
                spellCheck
                onFocus={() => activatePane('editor')}
                onChange={(event) => {
                  activatePane('editor');
                  onSourceChange(event.currentTarget.value);
                }}
                onScroll={handleEditorScroll}
                {...editorTextareaProps}
              />
            </section>
          ) : null}
          {showPreview ? (
            <div className="markdown-preview-pane-wrap">
              <section
                ref={previewRef}
                className="markdown-preview-pane"
                aria-label={previewAriaLabel ?? t('Markdown preview')}
                onPointerDown={() => activatePane('preview')}
                onWheel={() => activatePane('preview')}
                onTouchStart={() => activatePane('preview')}
                onKeyDown={() => activatePane('preview')}
                onFocus={() => activatePane('preview')}
                onScroll={handlePreviewScroll}
              >
                {/* Trusting `previewHtml` is the host's responsibility — this
                    component renders whatever HTML string it's given. */}
                <article className="markdown-rendered" onClick={onPreviewClick} dangerouslySetInnerHTML={{ __html: previewHtml ?? '' }} />
              </section>
            </div>
          ) : null}
        </>
      )}
    </ViewerShell>
  );
}
