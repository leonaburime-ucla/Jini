// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AssetTreeBrowser, type AssetTreeBrowserProps } from './AssetTreeBrowser.js';
import { createFakeAssetTreeDependencies } from '../../dependencies.js';
import { I18nProvider } from '../../../i18n/index.js';
import type { AssetTreeFolderItem, AssetTreeSelectors } from '../../types.js';

interface TestFile {
  path: string;
  kind: string;
  size: number;
  mtime: number;
  localPath?: string | null;
}

const NOW = 1_700_000_000_000;

function makeFiles(): TestFile[] {
  return [
    { path: 'readme.txt', kind: 'text', size: 100, mtime: NOW - 1_000, localPath: null },
    { path: 'photo.png', kind: 'image', size: 2048, mtime: NOW - 2_000, localPath: '/Users/me/photo.png' },
    { path: 'docs/spec.md', kind: 'text', size: 300, mtime: NOW - 3_000, localPath: null },
  ];
}

const folders: AssetTreeFolderItem[] = [{ path: 'empty' }];

const selectors: AssetTreeSelectors<TestFile> = {
  getSize: (f) => f.size,
  getModifiedAt: (f) => f.mtime,
  getKind: (f) => f.kind,
  getLocalPath: (f) => f.localPath,
};

const kindConfig = {
  text: { label: 'Text file', glyph: '¶' },
  image: { label: 'Image', glyph: '▣' },
};

function baseProps(overrides: Partial<Parameters<typeof AssetTreeBrowser<TestFile>>[0]> = {}) {
  return {
    files: makeFiles(),
    folders,
    selectors,
    kindConfig,
    dependencies: createFakeAssetTreeDependencies(),
    onOpenFile: vi.fn(),
    onRenameFile: vi.fn(),
    onDeleteFile: vi.fn(),
    onDeleteFiles: vi.fn(),
    onUploadFiles: vi.fn(),
    ...overrides,
  };
}

/**
 * A minimal stateful host wrapper: owns `files` itself and applies a
 * successful rename to it, exactly like a real host would (the origin
 * `DesignFilesPanel` never owns its own file list — its `files` prop comes
 * from the parent, which is expected to update it after a rename resolves).
 * `AssetTreeBrowser` itself never mutates `files` — only its own preview/
 * selection paths — so a rename test against a STATIC `files` array would
 * incorrectly show the preview closing (the renamed path no longer matches
 * any entry in `files`) even though the rename genuinely succeeded.
 */
function RenameHarness(props: Omit<AssetTreeBrowserProps<TestFile>, 'files' | 'onRenameFile'>) {
  const [files, setFiles] = useState<TestFile[]>(makeFiles());
  return (
    <AssetTreeBrowser
      {...props}
      files={files}
      onRenameFile={(path, nextPath) => {
        const target = files.find((f) => f.path === path);
        if (!target) return null;
        const renamed: TestFile = { ...target, path: nextPath };
        setFiles((prev) => [...prev.filter((f) => f.path !== path), renamed]);
        return renamed;
      }}
    />
  );
}

describe('AssetTreeBrowser', () => {
  it('renders the Folders section and kind sections at the root', () => {
    render(<AssetTreeBrowser {...baseProps()} />);
    expect(screen.getByText('Folders')).toBeInTheDocument();
    expect(screen.getByTestId('asset-tree-dir-row-docs')).toBeInTheDocument();
    expect(screen.getByTestId('asset-tree-dir-row-empty')).toBeInTheDocument();
    expect(screen.getByText('Text file', { selector: '.asset-tree-section-label' })).toBeInTheDocument();
    expect(screen.getByText('Image', { selector: '.asset-tree-section-label' })).toBeInTheDocument();
    expect(screen.getByTestId('asset-tree-file-row-readme.txt')).toBeInTheDocument();
    expect(screen.getByTestId('asset-tree-file-row-photo.png')).toBeInTheDocument();
  });

  it('shows the empty state when there are no files or folders', () => {
    render(<AssetTreeBrowser {...baseProps({ files: [], folders: [] })} />);
    expect(screen.getByTestId('asset-tree-empty')).toBeInTheDocument();
  });

  it('navigates into a folder via breadcrumbs and back to root', async () => {
    render(<AssetTreeBrowser {...baseProps()} rootLabel="My Project" />);
    await userEvent.click(screen.getByTestId('asset-tree-dir-row-docs'));
    expect(screen.getByTestId('asset-tree-file-row-docs/spec.md')).toBeInTheDocument();
    expect(screen.queryByTestId('asset-tree-file-row-readme.txt')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'My Project' }));
    expect(screen.getByTestId('asset-tree-file-row-readme.txt')).toBeInTheDocument();
  });

  it('reports navigation via onNavStateChange', async () => {
    const onNavStateChange = vi.fn();
    render(<AssetTreeBrowser {...baseProps({ onNavStateChange })} />);
    await userEvent.click(screen.getByTestId('asset-tree-dir-row-docs'));
    expect(onNavStateChange).toHaveBeenCalledWith({ currentDir: 'docs' });
  });

  it('opens the preview pane on clicking a file name, and Open triggers onOpenFile', async () => {
    const onOpenFile = vi.fn();
    render(<AssetTreeBrowser {...baseProps({ onOpenFile })} />);
    await userEvent.click(screen.getByTestId('asset-tree-file-row-readme.txt').querySelector('.asset-tree-row-name')!);
    expect(screen.getByTestId('asset-tree-preview')).toBeInTheDocument();
    await userEvent.click(within(screen.getByTestId('asset-tree-preview')).getByRole('button', { name: 'Open' }));
    expect(onOpenFile).toHaveBeenCalledWith(expect.objectContaining({ path: 'readme.txt' }));
  });

  it('selecting rows shows the selection bar with the right count, and Clear hides it', async () => {
    const onSelectionChange = vi.fn();
    render(<AssetTreeBrowser {...baseProps({ onSelectionChange })} />);
    await userEvent.click(within(screen.getByTestId('asset-tree-file-row-readme.txt')).getByRole('checkbox'));
    expect(screen.getByTestId('asset-tree-batch-bar')).toBeInTheDocument();
    expect(screen.getByText('1 selected')).toBeInTheDocument();
    expect(onSelectionChange).toHaveBeenCalledWith(new Set(['readme.txt']));
    await userEvent.click(within(screen.getByTestId('asset-tree-file-row-photo.png')).getByRole('checkbox'));
    expect(screen.getByText('2 selected')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Clear selection' }));
    expect(screen.queryByTestId('asset-tree-batch-bar')).toBeNull();
  });

  it('batch delete calls onDeleteFiles with the selected paths', async () => {
    const onDeleteFiles = vi.fn().mockResolvedValue(undefined);
    render(<AssetTreeBrowser {...baseProps({ onDeleteFiles })} />);
    await userEvent.click(within(screen.getByTestId('asset-tree-file-row-readme.txt')).getByRole('checkbox'));
    await userEvent.click(within(screen.getByTestId('asset-tree-file-row-photo.png')).getByRole('checkbox'));
    await userEvent.click(screen.getByTestId('asset-tree-batch-delete'));
    expect(onDeleteFiles).toHaveBeenCalledWith(expect.arrayContaining(['readme.txt', 'photo.png']));
  });

  it('hides the batch-download action when downloadFiles is omitted, shows it when supplied', async () => {
    const { rerender } = render(<AssetTreeBrowser {...baseProps()} />);
    await userEvent.click(within(screen.getByTestId('asset-tree-file-row-readme.txt')).getByRole('checkbox'));
    expect(screen.queryByRole('button', { name: 'Download' })).toBeNull();

    // Selection persists across this rerender (same mounted instance) — no need to click again.
    const downloadFiles = vi.fn().mockResolvedValue({ blob: new Blob(['x']), filename: 'archive.zip' });
    rerender(<AssetTreeBrowser {...baseProps({ downloadFiles })} />);
    expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument();
  });

  it('opens the row menu and Delete calls onDeleteFile with the path', async () => {
    const onDeleteFile = vi.fn();
    render(<AssetTreeBrowser {...baseProps({ onDeleteFile })} />);
    await userEvent.click(screen.getByTestId('asset-tree-file-menu-readme.txt'));
    expect(screen.getByTestId('asset-tree-row-menu-popover')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('asset-tree-row-delete-readme.txt'));
    expect(onDeleteFile).toHaveBeenCalledWith('readme.txt');
    expect(screen.queryByTestId('asset-tree-row-menu-popover')).toBeNull();
  });

  it('the row menu Open action resolves the file and calls onOpenFile', async () => {
    const onOpenFile = vi.fn();
    render(<AssetTreeBrowser {...baseProps({ onOpenFile })} />);
    await userEvent.click(screen.getByTestId('asset-tree-file-menu-readme.txt'));
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(onOpenFile).toHaveBeenCalledWith(expect.objectContaining({ path: 'readme.txt' }));
  });

  it('gates copy-local-path on the selectors.getLocalPath result: disabled for readme.txt, enabled for photo.png', async () => {
    render(<AssetTreeBrowser {...baseProps()} />);
    await userEvent.click(screen.getByTestId('asset-tree-file-menu-readme.txt'));
    expect(screen.getByRole('button', { name: 'Copy local path' })).toBeDisabled();
    await userEvent.keyboard('{Escape}');

    await userEvent.click(screen.getByTestId('asset-tree-file-menu-photo.png'));
    const copyButton = screen.getByRole('button', { name: 'Copy local path' });
    expect(copyButton).not.toBeDisabled();
    await userEvent.click(copyButton);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument());
  });

  it('hides the row menu Download action when getFileUrl is omitted, shows it when supplied', async () => {
    const { rerender } = render(<AssetTreeBrowser {...baseProps()} />);
    await userEvent.click(screen.getByTestId('asset-tree-file-menu-readme.txt'));
    expect(screen.queryByRole('link')).toBeNull();

    rerender(<AssetTreeBrowser {...baseProps({ getFileUrl: (f: TestFile) => `/files/${f.path}` })} />);
    await userEvent.click(screen.getByTestId('asset-tree-file-menu-readme.txt'));
    expect(screen.getByRole('link')).toHaveAttribute('href', '/files/readme.txt');
  });

  it('renames a file, carrying an active selection and preview over to the new path', async () => {
    render(<RenameHarness {...baseProps()} />);

    // Select and preview readme.txt first.
    await userEvent.click(within(screen.getByTestId('asset-tree-file-row-readme.txt')).getByRole('checkbox'));
    await userEvent.click(screen.getByTestId('asset-tree-file-row-readme.txt').querySelector('.asset-tree-row-name')!);
    expect(screen.getByTestId('asset-tree-preview')).toBeInTheDocument();

    await userEvent.click(screen.getByTestId('asset-tree-file-menu-readme.txt'));
    await userEvent.click(screen.getByRole('button', { name: 'Rename' }));
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('readme.txt');
    await userEvent.clear(input);
    await userEvent.type(input, 'renamed.txt{Enter}');

    await waitFor(() => expect(screen.getByTestId('asset-tree-file-row-renamed.txt')).toBeInTheDocument());
    // Selection carried over: still exactly one row selected, under the new path.
    expect(screen.getByText('1 selected')).toBeInTheDocument();
    expect(within(screen.getByTestId('asset-tree-file-row-renamed.txt')).getByRole('checkbox')).toHaveAttribute(
      'aria-checked',
      'true',
    );
    // Preview carried over too: still open, now showing the new path.
    expect(screen.getByTestId('asset-tree-preview')).toHaveTextContent('renamed.txt');
  });

  it('renders the reloading overlay while reloading is true', () => {
    render(<AssetTreeBrowser {...baseProps({ reloading: true })} />);
    expect(screen.getByTestId('asset-tree-reloading')).toBeInTheDocument();
  });

  it('renders and wires toolbarActions', async () => {
    const onSelect = vi.fn();
    render(
      <AssetTreeBrowser
        {...baseProps({ toolbarActions: [{ key: 'new', label: 'New File', onSelect, testId: 'toolbar-new' }] })}
      />,
    );
    await userEvent.click(screen.getByTestId('toolbar-new'));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('renders and wires emptyStateActions', async () => {
    const onSelect = vi.fn();
    render(
      <AssetTreeBrowser
        {...baseProps({
          files: [],
          folders: [],
          emptyStateActions: [{ key: 'new', label: 'New File', onSelect, testId: 'empty-new' }],
        })}
      />,
    );
    await userEvent.click(screen.getByTestId('empty-new'));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('renders a host-supplied footer', () => {
    render(<AssetTreeBrowser {...baseProps({ footer: <div data-testid="host-footer">footer</div> })} />);
    expect(screen.getByTestId('host-footer')).toBeInTheDocument();
  });

  it('applies an auto-selected initial preview via selectInitialPreviewFile', () => {
    const selectInitialPreviewFile = (files: TestFile[]) => files.find((f) => f.path === 'photo.png') ?? null;
    render(<AssetTreeBrowser {...baseProps({ selectInitialPreviewFile })} />);
    expect(screen.getByTestId('asset-tree-preview')).toHaveTextContent('photo.png');
  });

  it('shows a drag overlay while a file is being dragged over the body, and uploads on drop', async () => {
    const onUploadFiles = vi.fn();
    render(<AssetTreeBrowser {...baseProps({ onUploadFiles })} />);
    const body = screen.getByTestId('asset-tree-body');
    const file = new File(['x'], 'dropped.txt');
    fireEvent.dragEnter(body, { dataTransfer: { items: [], files: [] } });
    expect(screen.getByTestId('asset-tree-drop-overlay')).toBeInTheDocument();
    fireEvent.drop(body, { dataTransfer: { items: [], files: [file] } });
    expect(screen.queryByTestId('asset-tree-drop-overlay')).toBeNull();
    await waitFor(() => expect(onUploadFiles).toHaveBeenCalledWith([file]));
  });

  it('renders translated copy when mounted under an I18nProvider with a matching dictionary', () => {
    render(
      <I18nProvider dictionaries={{ fr: { Files: 'Fichiers', Folders: 'Dossiers' } }} initialLocale="fr">
        <AssetTreeBrowser {...baseProps()} />
      </I18nProvider>,
    );
    expect(screen.getByText('Fichiers')).toBeInTheDocument();
    expect(screen.getByText('Dossiers')).toBeInTheDocument();
  });
});
