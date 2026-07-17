import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../../i18n/index.js';
import { SettingsDialogShell } from './SettingsDialogShell.js';
import type { SettingsDialogTab } from './SettingsDialogShell.js';

function makeTabs(): SettingsDialogTab[] {
  return [
    { id: 'appearance', label: 'Appearance', subtitle: 'Theme & accent', panel: <div data-testid="panel-appearance">Appearance panel</div> },
    { id: 'notifications', label: 'Notifications', navHint: 'Sound & desktop', panel: <div data-testid="panel-notifications">Notifications panel</div> },
  ];
}

describe('SettingsDialogShell', () => {
  it('renders the initially active tab panel and header', () => {
    render(<SettingsDialogShell tabs={makeTabs()} initialActiveTabId="appearance" />);
    expect(screen.getByTestId('panel-appearance')).toBeInTheDocument();
    expect(screen.queryByTestId('panel-notifications')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Appearance' })).toBeInTheDocument();
    expect(screen.getByText('Theme & accent')).toBeInTheDocument();
  });

  it('switches the active panel when a nav item is clicked', async () => {
    render(<SettingsDialogShell tabs={makeTabs()} initialActiveTabId="appearance" />);
    await userEvent.click(screen.getByTestId('settings-dialog-nav-notifications'));
    expect(screen.getByTestId('panel-notifications')).toBeInTheDocument();
    expect(screen.queryByTestId('panel-appearance')).not.toBeInTheDocument();
    expect(screen.getByText('Sound & desktop')).toBeInTheDocument();
  });

  it('falls back to the first tab when initialActiveTabId does not match any tab', () => {
    render(<SettingsDialogShell tabs={makeTabs()} initialActiveTabId="does-not-exist" />);
    expect(screen.getByTestId('panel-appearance')).toBeInTheDocument();
  });

  it('supports a controlled activeTabId', async () => {
    const onActiveTabIdChange = vi.fn();
    const { rerender } = render(
      <SettingsDialogShell tabs={makeTabs()} activeTabId="appearance" onActiveTabIdChange={onActiveTabIdChange} />,
    );
    await userEvent.click(screen.getByTestId('settings-dialog-nav-notifications'));
    expect(onActiveTabIdChange).toHaveBeenCalledWith('notifications');
    // Still shows "appearance" because the host hasn't updated the prop yet.
    expect(screen.getByTestId('panel-appearance')).toBeInTheDocument();
    rerender(<SettingsDialogShell tabs={makeTabs()} activeTabId="notifications" onActiveTabIdChange={onActiveTabIdChange} />);
    expect(screen.getByTestId('panel-notifications')).toBeInTheDocument();
  });

  it('calls onClose on backdrop click but not on inner dialog click', async () => {
    const onClose = vi.fn();
    render(<SettingsDialogShell tabs={makeTabs()} onClose={onClose} />);
    await userEvent.click(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.click(screen.getByTestId('settings-dialog-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the close button is clicked and on Escape', async () => {
    const onClose = vi.fn();
    render(<SettingsDialogShell tabs={makeTabs()} onClose={onClose} />);
    await userEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('renders no close button when onClose is omitted', () => {
    render(<SettingsDialogShell tabs={makeTabs()} />);
    expect(screen.queryByLabelText('Close')).not.toBeInTheDocument();
  });

  it('toggles the sidebar collapsed state', async () => {
    render(<SettingsDialogShell tabs={makeTabs()} />);
    const toggle = screen.getByLabelText('Collapse settings sidebar');
    await userEvent.click(toggle);
    expect(screen.getByLabelText('Expand settings sidebar')).toBeInTheDocument();
  });

  it('toggles fullscreen and hides the control when fullscreenEnabled=false', async () => {
    const { rerender } = render(<SettingsDialogShell tabs={makeTabs()} />);
    const toggle = screen.getByLabelText('Fullscreen');
    await userEvent.click(toggle);
    expect(screen.getByLabelText('Exit fullscreen')).toBeInTheDocument();

    rerender(<SettingsDialogShell tabs={makeTabs()} fullscreenEnabled={false} />);
    expect(screen.queryByLabelText('Exit fullscreen')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Fullscreen')).not.toBeInTheDocument();
  });

  it('renders the welcome hero instead of the per-tab header when welcome=true', () => {
    render(<SettingsDialogShell tabs={makeTabs()} welcome />);
    expect(screen.getByRole('heading', { level: 2, name: 'Get started' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: 'Appearance' })).not.toBeInTheDocument();
  });

  it('renders host-supplied chromeExtra', () => {
    render(<SettingsDialogShell tabs={makeTabs()} chromeExtra={<div data-testid="autosave-pill">Saved</div>} />);
    expect(screen.getByTestId('autosave-pill')).toBeInTheDocument();
  });

  it('renders translated chrome copy when mounted under an I18nProvider with a matching dictionary', () => {
    render(
      <I18nProvider dictionaries={{ fr: { Settings: 'Paramètres', Close: 'Fermer' } }} initialLocale="fr">
        <SettingsDialogShell tabs={makeTabs()} onClose={() => {}} />
      </I18nProvider>,
    );
    expect(screen.getByText('Paramètres')).toBeInTheDocument();
    expect(screen.getByLabelText('Fermer')).toBeInTheDocument();
  });
});
