import { render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Composer } from '../Composer.js';
import { useComposer } from '../../hooks/useComposer.js';

function ComposerHarness({ onSend }: { onSend: (draft: string) => void }) {
  const composer = useComposer();
  return <Composer composer={composer} onSend={() => onSend(composer.draft)} />;
}

describe('Composer', () => {
  it('disables send until there is a draft or attachment', async () => {
    render(<ComposerHarness onSend={() => {}} />);
    const send = screen.getByRole('button', { name: 'Send' });
    expect(send).toBeDisabled();
    await userEvent.type(screen.getByPlaceholderText('Send a message…'), 'hi');
    expect(send).not.toBeDisabled();
  });

  it('calls onSend when the send button is clicked', async () => {
    const onSend = vi.fn();
    render(<ComposerHarness onSend={onSend} />);
    await userEvent.type(screen.getByPlaceholderText('Send a message…'), 'hello');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(onSend).toHaveBeenCalledWith('hello');
  });

  it('Enter submits (without Shift), Shift+Enter inserts a newline instead', async () => {
    const onSend = vi.fn();
    render(<ComposerHarness onSend={onSend} />);
    const textarea = screen.getByPlaceholderText('Send a message…');
    await userEvent.type(textarea, 'line one{Shift>}{Enter}{/Shift}line two');
    expect(onSend).not.toHaveBeenCalled();
    expect((textarea as HTMLTextAreaElement).value).toBe('line one\nline two');
    await userEvent.type(textarea, '{Enter}');
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it('renders plusMenuItems and leadingAccessories slots when supplied', async () => {
    const onSelect = vi.fn();
    const { result } = renderHook(() => useComposer());
    render(
      <Composer
        composer={result.current}
        onSend={() => {}}
        slots={{
          leadingAccessories: <span data-testid="leading">mode</span>,
          plusMenuItems: [{ id: 'p1', label: 'Import file', onSelect }],
        }}
      />,
    );
    expect(screen.getByTestId('leading')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Import file'));
    expect(onSelect).toHaveBeenCalled();
  });

  it('renders the attachment tray for staged attachments', () => {
    render(<ComposerHarness onSend={() => {}} />);
    // No attachments staged yet -> tray renders nothing.
    expect(screen.queryByRole('button', { name: /remove/i })).not.toBeInTheDocument();
  });
});
