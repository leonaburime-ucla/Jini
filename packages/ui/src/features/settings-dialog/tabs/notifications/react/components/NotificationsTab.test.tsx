import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../../../../../features/i18n/index.js';
import { DEFAULT_NOTIFICATIONS_PREFERENCES } from '../../constants.js';
import { NotificationsTab } from './NotificationsTab.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('NotificationsTab', () => {
  it('toggles the completion-sound master switch', async () => {
    const onChange = vi.fn();
    render(<NotificationsTab preferences={DEFAULT_NOTIFICATIONS_PREFERENCES} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: /Completion sound/ }));
    expect(onChange).toHaveBeenCalledWith({ soundEnabled: true });
  });

  it('shows sound pickers only when sound is enabled', () => {
    const { rerender } = render(
      <NotificationsTab preferences={{ ...DEFAULT_NOTIFICATIONS_PREFERENCES, soundEnabled: false }} onChange={() => {}} />,
    );
    expect(screen.queryByLabelText('Success sound')).not.toBeInTheDocument();
    rerender(<NotificationsTab preferences={{ ...DEFAULT_NOTIFICATIONS_PREFERENCES, soundEnabled: true }} onChange={() => {}} />);
    expect(screen.getByLabelText('Success sound')).toBeInTheDocument();
    expect(screen.getByLabelText('Failure sound')).toBeInTheDocument();
  });

  it('picks a success sound', async () => {
    const onChange = vi.fn();
    render(
      <NotificationsTab preferences={{ ...DEFAULT_NOTIFICATIONS_PREFERENCES, soundEnabled: true }} onChange={onChange} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'notifications.sound.chime' }));
    expect(onChange).toHaveBeenCalledWith({ successSoundId: 'chime' });
  });

  it('disables the desktop toggle when Notification is unsupported', () => {
    vi.stubGlobal('Notification', undefined);
    render(<NotificationsTab preferences={DEFAULT_NOTIFICATIONS_PREFERENCES} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: /Desktop notifications/ })).toBeDisabled();
    expect(screen.getByText(/not supported/)).toBeInTheDocument();
  });

  it('requests permission and calls onChange(desktopEnabled: true) when granted', async () => {
    vi.stubGlobal('Notification', { permission: 'default', requestPermission: vi.fn().mockResolvedValue('granted') });
    const onChange = vi.fn();
    render(<NotificationsTab preferences={DEFAULT_NOTIFICATIONS_PREFERENCES} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: /Desktop notifications/ }));
    expect(onChange).toHaveBeenCalledWith({ desktopEnabled: true });
  });

  it('turns desktop notifications off directly (no permission prompt) when already enabled', async () => {
    vi.stubGlobal('Notification', { permission: 'granted', requestPermission: vi.fn() });
    const onChange = vi.fn();
    render(
      <NotificationsTab preferences={{ ...DEFAULT_NOTIFICATIONS_PREFERENCES, desktopEnabled: true }} onChange={onChange} />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Desktop notifications/ }));
    expect(onChange).toHaveBeenCalledWith({ desktopEnabled: false });
  });

  it('shows a "Send test notification" button and status once desktop is enabled + granted, and sends one', async () => {
    class FakeNotification {
      static permission = 'granted';
      constructor(
        public title: string,
        public options: NotificationOptions,
      ) {}
      onclick: (() => void) | null = null;
      onclose: (() => void) | null = null;
      onerror: (() => void) | null = null;
      close = vi.fn();
    }
    vi.stubGlobal('Notification', FakeNotification);
    render(
      <NotificationsTab preferences={{ ...DEFAULT_NOTIFICATIONS_PREFERENCES, desktopEnabled: true }} onChange={() => {}} />,
    );
    const testButton = screen.getByRole('button', { name: 'Send test notification' });
    await userEvent.click(testButton);
    expect(await screen.findByRole('status')).toHaveTextContent('Test notification sent.');
  });

  it('renders translated copy when mounted under an I18nProvider with a matching dictionary', () => {
    render(
      <I18nProvider dictionaries={{ fr: { 'Completion sound': 'Son de fin de tâche' } }} initialLocale="fr">
        <NotificationsTab preferences={DEFAULT_NOTIFICATIONS_PREFERENCES} onChange={() => {}} />
      </I18nProvider>,
    );
    expect(screen.getByText('Son de fin de tâche')).toBeInTheDocument();
  });
});
