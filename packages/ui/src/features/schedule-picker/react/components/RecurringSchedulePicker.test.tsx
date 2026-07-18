import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RecurringSchedulePicker } from './RecurringSchedulePicker.js';
import { I18nProvider } from '../../../i18n/index.js';
import type { ScheduleValue } from '../../types.js';

describe('RecurringSchedulePicker', () => {
  it('shows the schedule summary on the trigger and opens the popover on click', async () => {
    const value: ScheduleValue = { kind: 'daily', time: '09:00', timezone: 'UTC' };
    render(<RecurringSchedulePicker value={value} onChange={vi.fn()} />);
    expect(screen.getByText('Daily')).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Daily at 9:00 AM/ }));
    expect(screen.getByRole('tablist')).toBeInTheDocument();
  });

  it('switching kind tabs shows the weekday grid only for weekly', async () => {
    const value: ScheduleValue = { kind: 'daily', time: '09:00', timezone: 'UTC' };
    render(<RecurringSchedulePicker value={value} onChange={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /Daily at/ }));
    expect(screen.queryByLabelText('Weekday')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'Weekly' }));
    expect(screen.getByLabelText('Weekday')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'Hourly' }));
    expect(screen.queryByLabelText('Weekday')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Minute of every hour')).toBeInTheDocument();
  });

  it('editing the schedule and clicking Done commits the new value and closes', async () => {
    const value: ScheduleValue = { kind: 'daily', time: '09:00', timezone: 'UTC' };
    const onChange = vi.fn();
    render(<RecurringSchedulePicker value={value} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: /Daily at/ }));

    const timeInput = screen.getByLabelText('Time') as HTMLInputElement;
    await userEvent.clear(timeInput);
    await userEvent.type(timeInput, '13:00');

    await userEvent.click(screen.getByRole('button', { name: 'Done' }));

    expect(onChange).toHaveBeenCalledWith({ kind: 'daily', time: '13:00', timezone: 'UTC' });
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('closes the popover on outside click without committing', async () => {
    const value: ScheduleValue = { kind: 'daily', time: '09:00', timezone: 'UTC' };
    const onChange = vi.fn();
    render(
      <div>
        <RecurringSchedulePicker value={value} onChange={onChange} />
        <button type="button">outside</button>
      </div>,
    );
    await userEvent.click(screen.getByRole('button', { name: /Daily at/ }));
    expect(screen.getByRole('tablist')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'outside' }));
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('disables the trigger when disabled', () => {
    const value: ScheduleValue = { kind: 'hourly', minute: 0 };
    render(<RecurringSchedulePicker value={value} onChange={vi.fn()} disabled />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('accepts a custom kinds/weekdays/timezones configuration', async () => {
    const value: ScheduleValue = { kind: 'weekly', weekday: 1, time: '09:00', timezone: 'UTC' };
    render(
      <RecurringSchedulePicker
        value={value}
        onChange={vi.fn()}
        kinds={[{ kind: 'weekly', label: 'Weekly' }]}
        weekdays={[{ value: 1, short: 'M', long: 'Mon-day' }]}
        timezones={['UTC']}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Mon-day at/ }));
    expect(screen.queryByRole('tab', { name: 'Hourly' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'M' })).toBeInTheDocument();
  });

  it('renders translated copy end-to-end under an I18nProvider', async () => {
    const value: ScheduleValue = { kind: 'daily', time: '09:00', timezone: 'UTC' };
    render(
      <I18nProvider dictionaries={{ fr: { Daily: 'Quotidien', Done: 'Terminé', Time: 'Heure' } }} initialLocale="fr">
        <RecurringSchedulePicker value={value} onChange={vi.fn()} />
      </I18nProvider>,
    );
    expect(screen.getByText('Quotidien')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Quotidien/ }));
    expect(screen.getByText('Heure')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Terminé' })).toBeInTheDocument();
  });
});
