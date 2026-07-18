import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../../features/i18n/index.js';
import { FileImportPanel } from '../../components/FileImportPanel.js';

describe('FileImportPanel', () => {
  it('renders the title, body, and file label', () => {
    render(
      <FileImportPanel
        title="Upload zip"
        body="Choose a .zip archive"
        working={false}
        fileLabel="No zip selected"
        canSubmit={false}
        onChange={() => {}}
        onImport={() => {}}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Upload zip' })).toBeInTheDocument();
    expect(screen.getByText('Choose a .zip archive')).toBeInTheDocument();
    expect(screen.getByText('No zip selected')).toBeInTheDocument();
  });

  it('uses the single-file test id and no directory attributes by default', () => {
    render(
      <FileImportPanel
        title="Upload zip"
        body="Choose a .zip archive"
        working={false}
        fileLabel="No zip selected"
        canSubmit={false}
        onChange={() => {}}
        onImport={() => {}}
      />,
    );
    const input = screen.getByTestId('plugins-zip-input') as HTMLInputElement;
    expect(input).not.toHaveAttribute('webkitdirectory');
    expect(input.multiple).toBe(false);
  });

  it('uses the folder test id and directory attributes when folder=true', () => {
    render(
      <FileImportPanel
        title="Upload folder"
        body="Choose a folder"
        working={false}
        fileLabel="No folder selected"
        folder
        canSubmit={false}
        onChange={() => {}}
        onImport={() => {}}
      />,
    );
    const input = screen.getByTestId('plugins-folder-input') as HTMLInputElement;
    expect(input).toHaveAttribute('webkitdirectory', '');
    expect(input.multiple).toBe(true);
  });

  it('calls onChange with the picked files', async () => {
    const onChange = vi.fn();
    render(
      <FileImportPanel
        title="Upload zip"
        body="Choose a .zip archive"
        accept=".zip"
        working={false}
        fileLabel="No zip selected"
        canSubmit={false}
        onChange={onChange}
        onImport={() => {}}
      />,
    );
    const file = new File(['contents'], 'plugin.zip', { type: 'application/zip' });
    await userEvent.upload(screen.getByTestId('plugins-zip-input'), file);
    expect(onChange).toHaveBeenCalledWith([file]);
  });

  it('calls onChange with an empty array when the change event carries no FileList', () => {
    const onChange = vi.fn();
    render(
      <FileImportPanel
        title="Upload zip"
        body="Choose a .zip archive"
        working={false}
        fileLabel="No zip selected"
        canSubmit={false}
        onChange={onChange}
        onImport={() => {}}
      />,
    );
    const input = screen.getByTestId('plugins-zip-input');
    // A real <input type="file"> always exposes a FileList, but the DOM
    // typing (`FileList | null`) allows null — simulate that edge to
    // exercise the `?? []` fallback.
    Object.defineProperty(input, 'files', { value: null, configurable: true });
    fireEvent.change(input);
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('shows "Import" and calls onImport on click when submittable', async () => {
    const onImport = vi.fn();
    render(
      <FileImportPanel
        title="Upload zip"
        body="Choose a .zip archive"
        working={false}
        fileLabel="plugin.zip"
        canSubmit
        onChange={() => {}}
        onImport={onImport}
      />,
    );
    const button = screen.getByRole('button', { name: 'Import' });
    expect(button).not.toBeDisabled();
    await userEvent.click(button);
    expect(onImport).toHaveBeenCalledTimes(1);
  });

  it('shows "Importing…" and disables the button while working', () => {
    render(
      <FileImportPanel
        title="Upload zip"
        body="Choose a .zip archive"
        working
        fileLabel="plugin.zip"
        canSubmit
        onChange={() => {}}
        onImport={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: 'Importing…' })).toBeDisabled();
  });

  it('disables the import button when canSubmit is false', () => {
    render(
      <FileImportPanel
        title="Upload zip"
        body="Choose a .zip archive"
        working={false}
        fileLabel="No zip selected"
        canSubmit={false}
        onChange={() => {}}
        onImport={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled();
  });

  it('appends a caller-supplied className', () => {
    const { container } = render(
      <FileImportPanel
        title="Upload zip"
        body="Choose a .zip archive"
        working={false}
        fileLabel="No zip selected"
        canSubmit={false}
        onChange={() => {}}
        onImport={() => {}}
        className="extra"
      />,
    );
    expect(container.firstChild).toHaveClass('extra');
  });

  it('renders translated copy when mounted under an I18nProvider with a matching dictionary', () => {
    render(
      <I18nProvider dictionaries={{ fr: { Import: 'Importer', 'Importing…': 'Importation…' } }} initialLocale="fr">
        <FileImportPanel
          title="Upload zip"
          body="Choose a .zip archive"
          working={false}
          fileLabel="No zip selected"
          canSubmit
          onChange={() => {}}
          onImport={() => {}}
        />
      </I18nProvider>,
    );
    expect(screen.getByRole('button', { name: 'Importer' })).toBeInTheDocument();
  });
});
