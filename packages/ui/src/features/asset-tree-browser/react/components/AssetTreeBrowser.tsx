import { useEffect, useMemo, type ReactNode } from 'react';
import { useT } from '../../../i18n/index.js';
import { DEFAULT_KIND_CONFIG_MAP, DEFAULT_SECTION_ORDER, EMPTY_TOOLBAR_ACTIONS } from '../../constants.js';
import { createBrowserAssetTreeDependencies } from '../../dependencies.js';
import { basenameForRename, canCopyLocalPath, countFilesUnderDir, resolveKindConfig } from '../../rules.js';
import type { AssetTreeDependencies } from '../../ports.js';
import type {
  AssetTreeFileItem,
  AssetTreeFolderItem,
  AssetTreeKindConfigMap,
  AssetTreeNavState,
  AssetTreeSelectors,
  AssetTreeToolbarAction,
} from '../../types.js';
import { useAssetTreeBatchActions } from '../hooks/useAssetTreeBatchActions.js';
import { useAssetTreeClipboardPasteUpload } from '../hooks/useAssetTreeClipboardPasteUpload.js';
import { useAssetTreeCopyLocalPath } from '../hooks/useAssetTreeCopyLocalPath.js';
import { useAssetTreeDragUpload } from '../hooks/useAssetTreeDragUpload.js';
import { useAssetTreeNavigation } from '../hooks/useAssetTreeNavigation.js';
import { useAssetTreePreview } from '../hooks/useAssetTreePreview.js';
import { useAssetTreeRename } from '../hooks/useAssetTreeRename.js';
import { useAssetTreeRowMenu } from '../hooks/useAssetTreeRowMenu.js';
import { useAssetTreeSelection } from '../hooks/useAssetTreeSelection.js';
import { AssetTreeBreadcrumbs } from './AssetTreeBreadcrumbs.js';
import { AssetTreeEmptyState } from './AssetTreeEmptyState.js';
import { AssetTreeFileRow } from './AssetTreeFileRow.js';
import { AssetTreeFolderRow } from './AssetTreeFolderRow.js';
import { AssetTreeRowMenu } from './AssetTreeRowMenu.js';
import { AssetTreeSelectionBar } from './AssetTreeSelectionBar.js';
import { AssetTreeToolbar } from './AssetTreeToolbar.js';
import { AssetTreeUploadErrorBanner } from './AssetTreeUploadErrorBanner.js';
import { FilePreviewPane } from './FilePreviewPane.js';

export interface AssetTreeBrowserProps<TFile extends AssetTreeFileItem> {
  files: TFile[];
  /** Persisted folders, including empty ones — see `AssetTreeFolderItem`'s doc comment. */
  folders?: AssetTreeFolderItem[];
  selectors: AssetTreeSelectors<TFile>;
  kindConfig?: AssetTreeKindConfigMap;
  /** Kind render order; kinds absent from it append in first-seen order. */
  sectionOrder?: readonly string[];
  /** Defaults to `createBrowserAssetTreeDependencies()` — a host never needs to supply this. */
  dependencies?: AssetTreeDependencies;
  /** The breadcrumb root's label (e.g. a project name). Defaults to `t('Files')`. */
  rootLabel?: string;
  /** True while the host is reindexing/reloading the tree — drives a loading overlay. */
  reloading?: boolean;
  navState?: AssetTreeNavState;
  onNavStateChange?: (state: AssetTreeNavState) => void;
  onSelectionChange?: (paths: Set<string>) => void;
  onOpenFile: (file: TFile) => void;
  onRenameFile: (path: string, nextPath: string) => Promise<TFile | null> | TFile | null;
  onDeleteFile: (path: string) => void;
  onDeleteFiles: (paths: string[]) => Promise<void> | void;
  onUploadFiles: (files: File[]) => void;
  /** Omit to hide every download affordance (row menu + preview pane) entirely. */
  getFileUrl?: (file: TFile) => string;
  /** Omit to hide the batch-download action. The host owns the actual archive endpoint — this package only triggers the browser-side save once it resolves. */
  downloadFiles?: (paths: string[]) => Promise<{ blob: Blob; filename: string }>;
  selectInitialPreviewFile?: (files: TFile[]) => TFile | null;
  renderPreviewThumbnail?: (file: TFile) => ReactNode;
  /** Threaded through to `FilePreviewPane` — see its doc comment. */
  thumbnailIsInteractive?: boolean;
  toolbarActions?: readonly AssetTreeToolbarAction[];
  emptyStateActions?: readonly AssetTreeToolbarAction[];
  /** Host-owned footer slot, rendered below the listing. This package ships no default footer — see `packages/ui/source-map.md` for why. */
  footer?: ReactNode;
  /** Custom hook overrides for dependency injection / testing. */
  useAssetTreeNavigation?: typeof useAssetTreeNavigation;
  useAssetTreePreview?: typeof useAssetTreePreview;
  useAssetTreeRename?: typeof useAssetTreeRename;
  useAssetTreeSelection?: typeof useAssetTreeSelection;
}

/**
 * A directory-navigable file tree: breadcrumbs, a host-supplied toolbar,
 * kind-grouped sections with a pinned Folders section, row selection with
 * batch delete/download, inline rename, a row context menu, drag-and-drop +
 * clipboard-paste upload, and a companion `FilePreviewPane`. Ported from a
 * design-tool origin project's file-manager panel — see
 * `packages/ui/source-map.md` for the full retained-behavior manifest and
 * everything dropped (the origin's live-artifacts section, plugin-folders
 * section, project menu, rotating-tip footer, and file-kind-specific
 * preview rendering).
 */
export function AssetTreeBrowser<TFile extends AssetTreeFileItem>({
  files,
  folders,
  selectors,
  kindConfig = DEFAULT_KIND_CONFIG_MAP,
  sectionOrder = DEFAULT_SECTION_ORDER,
  dependencies,
  rootLabel,
  reloading = false,
  navState,
  onNavStateChange,
  onSelectionChange,
  onOpenFile,
  onRenameFile,
  onDeleteFile,
  onDeleteFiles,
  onUploadFiles,
  getFileUrl,
  downloadFiles,
  selectInitialPreviewFile,
  renderPreviewThumbnail,
  thumbnailIsInteractive = false,
  toolbarActions = EMPTY_TOOLBAR_ACTIONS,
  emptyStateActions = EMPTY_TOOLBAR_ACTIONS,
  footer,
  useAssetTreeNavigation: useAssetTreeNavigationHook = useAssetTreeNavigation,
  useAssetTreePreview: useAssetTreePreviewHook = useAssetTreePreview,
  useAssetTreeRename: useAssetTreeRenameHook = useAssetTreeRename,
  useAssetTreeSelection: useAssetTreeSelectionHook = useAssetTreeSelection,
}: AssetTreeBrowserProps<TFile>) {
  const t = useT();
  // KNOWN FOLLOW-UP (flagged by the 2026-07-22 verification pass, not yet
  // fixed): this has the same useWiredX gap ConnectorsBrowser had — `deps`
  // resolution is still inline instead of behind a `useWiredAssetTreeBrowser`
  // wrapper. Deliberately not fixed here: unlike ConnectorsBrowser's `deps`
  // (fed to exactly the 3 already-overridable sub-hooks), this `deps` also
  // feeds `useAssetTreeRowMenu`, `useAssetTreeClipboardPasteUpload`, and
  // `useAssetTreeCopyLocalPath` below — none of which currently have their
  // own override props — so collapsing it into one wired hook is a real
  // design decision (what belongs in the wired hook vs. stays overridable)
  // rather than a mechanical port of the ConnectorsBrowser pattern. Lower
  // severity than that one too: these are DOM/clipboard adapters, not
  // remote data fetching.
  const deps = useMemo(() => dependencies ?? createBrowserAssetTreeDependencies(), [dependencies]);

  const navigation = useAssetTreeNavigationHook({
    files,
    folders,
    sectionOrder,
    getKind: selectors.getKind,
    getModifiedAt: selectors.getModifiedAt,
    navState,
    onNavStateChange,
  });
  const preview = useAssetTreePreviewHook(files, selectInitialPreviewFile);
  // Declared before `useAssetTreeSelection` so its in-flight `renaming.path`
  // (if any) can be threaded into selection's prune logic as
  // `pendingRenamePath` — see that hook's doc comment for the race this
  // closes. `onRenamed` referencing `selection` here (declared below) is
  // safe: it's a closure that only actually runs later, once `selection` is
  // fully bound.
  const rename = useAssetTreeRenameHook<TFile>({
    currentDir: navigation.currentDir,
    onRenameFile,
    onRenamed: (oldPath, renamedFile) => {
      if (preview.previewPath === oldPath) preview.setPreviewPath(renamedFile.path);
      selection.renamePath(oldPath, renamedFile.path);
    },
  });
  const selection = useAssetTreeSelectionHook(
    navigation.filesAtCurrentDir,
    navigation.currentDir,
    rename.renaming?.path ?? null,
  );
  const rowMenu = useAssetTreeRowMenu(deps.dom);
  const dragUpload = useAssetTreeDragUpload(onUploadFiles);
  useAssetTreeClipboardPasteUpload({
    dom: deps.dom,
    onUploadFiles,
    onBeforeUpload: dragUpload.clearDropReadError,
  });
  const batchActions = useAssetTreeBatchActions({ selected: selection.selected, onDeleteFiles, downloadFiles });
  const copyLocalPath = useAssetTreeCopyLocalPath(deps.clipboard);

  useEffect(() => {
    onSelectionChange?.(selection.selected);
  }, [selection.selected, onSelectionChange]);

  function findFile(path: string): TFile | undefined {
    return files.find((f) => f.path === path);
  }

  function openPath(path: string) {
    const target = findFile(path);
    if (target) onOpenFile(target);
  }

  const menuFile = rowMenu.menuPos ? (findFile(rowMenu.menuPos.path) ?? null) : null;
  const hasSelection = selection.selected.size > 0;
  const isEmpty = files.length === 0 && (folders?.length ?? 0) === 0;
  const previewedFile = preview.previewFile;
  const previewKindConfig = previewedFile ? resolveKindConfig(selectors.getKind(previewedFile), kindConfig) : null;

  return (
    <div
      className={`asset-tree-panel${previewedFile ? '' : ' no-preview'}${hasSelection ? ' has-selection' : ''}`}
    >
      {reloading ? (
        <div className="asset-tree-reloading-overlay" data-testid="asset-tree-reloading">
          {t('Loading…')}
        </div>
      ) : null}
      <div className="asset-tree-main">
        <div className="asset-tree-topbar">
          <div className="asset-tree-topbar-left">
            <AssetTreeBreadcrumbs
              currentDir={navigation.currentDir}
              rootLabel={rootLabel ?? t('Files')}
              onNavigate={navigation.setCurrentDir}
            />
          </div>
          <div className="asset-tree-topbar-right">
            <AssetTreeToolbar actions={toolbarActions} />
          </div>
        </div>
        <div
          className="asset-tree-body"
          data-testid="asset-tree-body"
          onDragEnter={dragUpload.onDragEnter}
          onDragOver={dragUpload.onDragOver}
          onDragLeave={dragUpload.onDragLeave}
          onDrop={dragUpload.onDrop}
        >
          {dragUpload.dropReadError && !preview.previewPath ? (
            <AssetTreeUploadErrorBanner message={dragUpload.dropReadError} onDismiss={dragUpload.clearDropReadError} />
          ) : null}
          {hasSelection ? (
            <AssetTreeSelectionBar
              count={selection.selected.size}
              onClear={selection.clearSelection}
              onDelete={() => void batchActions.deleteSelected()}
              deleting={batchActions.deleting}
              onDownload={downloadFiles ? () => void batchActions.downloadSelected() : undefined}
              downloading={batchActions.downloading}
              downloadError={batchActions.downloadError}
            />
          ) : null}
          {isEmpty ? (
            <AssetTreeEmptyState actions={emptyStateActions} />
          ) : (
            <>
              {navigation.dirsAtCurrentDir.length > 0 ? (
                <div className="asset-tree-section" key="folders">
                  <div className="asset-tree-section-label">
                    {t('Folders')}
                    <span className="asset-tree-section-count">{navigation.dirsAtCurrentDir.length}</span>
                  </div>
                  {navigation.dirsAtCurrentDir.map((dirName) => {
                    const fullPath = navigation.currentDir === '' ? dirName : `${navigation.currentDir}/${dirName}`;
                    return (
                      <AssetTreeFolderRow
                        key={fullPath}
                        name={dirName}
                        path={fullPath}
                        fileCount={countFilesUnderDir(files, fullPath)}
                        onNavigate={navigation.setCurrentDir}
                      />
                    );
                  })}
                </div>
              ) : null}
              {navigation.sections.map((section) => {
                const config = resolveKindConfig(section.kind, kindConfig);
                return (
                  <div className="asset-tree-section" key={`kind:${section.kind}`}>
                    <div className="asset-tree-section-label">
                      {t(config.label)}
                      <span className="asset-tree-section-count">{section.files.length}</span>
                    </div>
                    {section.files.map((f) => (
                      <AssetTreeFileRow
                        key={f.path}
                        path={f.path}
                        displayName={basenameForRename(f.path, navigation.currentDir)}
                        active={preview.previewPath === f.path}
                        selected={selection.selected.has(f.path)}
                        kindLabel={t(config.label)}
                        kindGlyph={config.glyph}
                        size={selectors.getSize(f)}
                        modifiedAt={selectors.getModifiedAt(f)}
                        renaming={rename.renaming?.path === f.path ? rename.renaming : null}
                        onSelectPreview={preview.setPreviewPath}
                        onOpen={openPath}
                        onToggleSelect={selection.toggleSelect}
                        onOpenMenu={rowMenu.openMenuFor}
                        onRenameDraftChange={rename.updateDraft}
                        onCommitRename={() => void rename.commitRename()}
                        onCancelRename={rename.cancelRename}
                      />
                    ))}
                  </div>
                );
              })}
            </>
          )}
          {footer}
        </div>
        {dragUpload.draggingFiles ? (
          <div className="asset-tree-drop-overlay" aria-hidden data-testid="asset-tree-drop-overlay">
            <div className="asset-tree-drop-overlay-card">
              <span className="label">{t('Drop to upload')}</span>
            </div>
          </div>
        ) : null}
      </div>
      {previewedFile && previewKindConfig ? (
        <FilePreviewPane
          // Keyed on the path so a host's `renderThumbnail` (which may mount
          // a heavy/stateful element like an iframe or canvas) fully
          // remounts when the user switches files, instead of React reusing
          // the same DOM node across two different files.
          key={previewedFile.path}
          file={previewedFile}
          path={previewedFile.path}
          kindLabel={t(previewKindConfig.label)}
          kindGlyph={previewKindConfig.glyph}
          size={selectors.getSize(previewedFile)}
          modifiedAt={selectors.getModifiedAt(previewedFile)}
          onOpen={() => onOpenFile(previewedFile)}
          onClose={preview.clearPreview}
          downloadHref={getFileUrl?.(previewedFile)}
          renderThumbnail={renderPreviewThumbnail}
          thumbnailIsInteractive={thumbnailIsInteractive}
        />
      ) : null}
      {rowMenu.menuPos ? (
        <AssetTreeRowMenu
          path={rowMenu.menuPos.path}
          displayName={basenameForRename(rowMenu.menuPos.path, navigation.currentDir)}
          top={rowMenu.menuPos.top}
          left={rowMenu.menuPos.left}
          containerRef={rowMenu.containerRef}
          canCopyLocalPath={!!menuFile && canCopyLocalPath(menuFile, selectors)}
          copied={copyLocalPath.copiedPath === rowMenu.menuPos.path}
          download={
            getFileUrl && menuFile
              ? { href: getFileUrl(menuFile), onClick: rowMenu.closeMenu }
              : undefined
          }
          onOpen={() => {
            const path = rowMenu.menuPos!.path;
            rowMenu.closeMenu();
            openPath(path);
          }}
          onRename={() => {
            const path = rowMenu.menuPos!.path;
            rowMenu.closeMenu();
            rename.startRename(path);
          }}
          // Deliberately does NOT close the menu (unlike every other action
          // here) — the origin `DesignFilesPanel`'s equivalent handler did
          // call `setMenuPos(null)` before copying, which meant its
          // "Copied" confirmation label could never actually become visible
          // to a user (it only ever renders inside the now-closed popover).
          // Since the whole point of `copiedPath`/the transient-confirmation
          // UI is to be seen, this keeps the menu open so it can be; the
          // existing outside-dismiss/Escape handling still closes it
          // normally afterward.
          onCopyLocalPath={() => {
            const path = rowMenu.menuPos!.path;
            // `canCopyLocalPath` (passed below) already gates the button's
            // `disabled` state on `!!menuFile`, so a click can only reach
            // this handler when `menuFile` is non-null — asserting that
            // instead of re-guarding it here avoids an unreachable `: null`
            // ternary arm (a real click can never fire on a disabled
            // button, so that arm was dead code, not defensive coding).
            const localPath = selectors.getLocalPath?.(menuFile!);
            if (localPath) void copyLocalPath.copyLocalPath(path, localPath);
          }}
          onDelete={() => {
            const path = rowMenu.menuPos!.path;
            rowMenu.closeMenu();
            onDeleteFile(path);
          }}
        />
      ) : null}
    </div>
  );
}
