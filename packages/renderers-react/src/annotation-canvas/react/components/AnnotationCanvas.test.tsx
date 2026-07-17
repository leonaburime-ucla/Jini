import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AnnotationCanvas } from './AnnotationCanvas.js';
import { createFakeAnnotationCanvasPort } from '../../dependencies.js';
import { I18nProvider } from '../../../react/i18n.js';

describe('AnnotationCanvas', () => {
  it('renders children plus the toolbar while active', () => {
    render(
      <AnnotationCanvas active port={createFakeAnnotationCanvasPort()}>
        <div data-testid="preview-content">preview</div>
      </AnnotationCanvas>,
    );
    expect(screen.getByTestId('preview-content')).toBeInTheDocument();
    expect(screen.getByRole('toolbar', { name: 'Annotation tools' })).toBeInTheDocument();
  });

  it('hides the toolbar when inactive and there is nothing drawn', () => {
    render(
      <AnnotationCanvas active={false} port={createFakeAnnotationCanvasPort()}>
        <div>preview</div>
      </AnnotationCanvas>,
    );
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
  });

  it('the submit-action picker: opening the menu and choosing draft switches the primary action', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => ({ ok: true }));
    render(
      <AnnotationCanvas active port={createFakeAnnotationCanvasPort({ onSubmit })}>
        <div>preview</div>
      </AnnotationCanvas>,
    );

    const noteInput = screen.getByLabelText('Annotation note');
    await user.type(noteInput, 'hello');

    await user.click(screen.getByRole('button', { name: 'Submit options' }));
    const menu = screen.getByRole('menu', { name: 'Submit options' });
    await user.click(within(menu).getByRole('menuitemradio', { name: 'Add to input' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ action: 'draft', note: 'hello' }));
  });

  it('the submit-action picker: choosing queue then clicking the primary button submits queue again', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => ({ ok: true }));
    render(
      <AnnotationCanvas active port={createFakeAnnotationCanvasPort({ onSubmit })}>
        <div>preview</div>
      </AnnotationCanvas>,
    );
    await user.type(screen.getByLabelText('Annotation note'), 'hi');
    await user.click(screen.getByRole('button', { name: 'Submit options' }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Queue' }));
    onSubmit.mockClear();
    await user.type(screen.getByLabelText('Annotation note'), '!');
    await user.click(screen.getByRole('button', { name: /Queue/ }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ action: 'queue' }));
  });

  it('disables the send option and shows the reason when sendDisabled', async () => {
    const user = userEvent.setup();
    render(
      <AnnotationCanvas active sendDisabled sendDisabledReason="A run is already streaming" port={createFakeAnnotationCanvasPort()}>
        <div>preview</div>
      </AnnotationCanvas>,
    );
    await user.type(screen.getByLabelText('Annotation note'), 'hi');
    await user.click(screen.getByRole('button', { name: 'Submit options' }));
    expect(screen.getByRole('menuitemradio', { name: 'Send' })).toBeDisabled();
  });

  it('Escape closes the overlay (keyboard shortcut)', async () => {
    const user = userEvent.setup();
    const onActiveChange = vi.fn();
    render(
      <AnnotationCanvas active onActiveChange={onActiveChange} port={createFakeAnnotationCanvasPort()}>
        <div>preview</div>
      </AnnotationCanvas>,
    );
    await user.keyboard('{Escape}');
    expect(onActiveChange).toHaveBeenCalledWith(false);
  });

  it('the close button also closes the overlay and fires onToolbarClick', async () => {
    const user = userEvent.setup();
    const onActiveChange = vi.fn();
    const onToolbarClick = vi.fn();
    render(
      <AnnotationCanvas active onActiveChange={onActiveChange} onToolbarClick={onToolbarClick} port={createFakeAnnotationCanvasPort()}>
        <div>preview</div>
      </AnnotationCanvas>,
    );
    await user.click(screen.getByRole('button', { name: 'Close annotation tools' }));
    expect(onActiveChange).toHaveBeenCalledWith(false);
    expect(onToolbarClick).toHaveBeenCalledWith('exit');
  });

  it('the mark-tool picker switches tools via its menu', async () => {
    const user = userEvent.setup();
    render(
      <AnnotationCanvas active port={createFakeAnnotationCanvasPort()}>
        <div>preview</div>
      </AnnotationCanvas>,
    );
    await user.click(screen.getByRole('button', { name: 'Box select' }));
    const menu = screen.getByRole('menu', { name: 'Box select' });
    await user.click(within(menu).getByRole('menuitemradio', { name: 'Text' }));
    expect(screen.getByRole('button', { name: 'Text' })).toBeInTheDocument();
  });

  it('renders custom icons when overridden', () => {
    render(
      <AnnotationCanvas
        active
        port={createFakeAnnotationCanvasPort()}
        icons={{ close: () => <span data-testid="custom-close-icon" /> }}
      >
        <div>preview</div>
      </AnnotationCanvas>,
    );
    expect(screen.getByTestId('custom-close-icon')).toBeInTheDocument();
  });

  it('translates toolbar labels when mounted under an I18nProvider with a dictionary', () => {
    render(
      <I18nProvider dictionary={{ 'Annotation tools': 'Outils d’annotation', Send: 'Envoyer' }}>
        <AnnotationCanvas active port={createFakeAnnotationCanvasPort()}>
          <div>preview</div>
        </AnnotationCanvas>
      </I18nProvider>,
    );
    expect(screen.getByRole('toolbar', { name: 'Outils d’annotation' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Envoyer/ })).toBeInTheDocument();
  });
});
