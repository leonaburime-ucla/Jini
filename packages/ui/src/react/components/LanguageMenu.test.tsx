// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LanguageMenu } from './LanguageMenu.js';

const LOCALES = [
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
];

describe('LanguageMenu', () => {
  it('shows the active locale label on the trigger', () => {
    render(<LanguageMenu locales={LOCALES} locale="en" onLocaleChange={vi.fn()} />);
    expect(screen.getByTitle('English')).toBeTruthy();
  });

  it('opens the popover and lists every supplied locale', async () => {
    const user = userEvent.setup();
    render(<LanguageMenu locales={LOCALES} locale="en" onLocaleChange={vi.fn()} />);
    await user.click(screen.getByRole('button'));
    expect(screen.getByRole('menu')).toBeTruthy();
    expect(screen.getByText('日本語')).toBeTruthy();
  });

  it('calls onLocaleChange and closes when an option is picked', async () => {
    const user = userEvent.setup();
    const onLocaleChange = vi.fn();
    render(<LanguageMenu locales={LOCALES} locale="en" onLocaleChange={onLocaleChange} />);
    await user.click(screen.getByRole('button'));
    await user.click(screen.getByText('日本語'));
    expect(onLocaleChange).toHaveBeenCalledWith('ja');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    render(<LanguageMenu locales={LOCALES} locale="en" onLocaleChange={vi.fn()} />);
    await user.click(screen.getByRole('button'));
    expect(screen.getByRole('menu')).toBeTruthy();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
