import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { QuestionForm as QuestionFormType } from '@jini/chat-core';
import { QuestionForm } from './QuestionForm.js';

const form: QuestionFormType = {
  id: 'discovery',
  title: 'Quick brief',
  questions: [
    { id: 'platform', label: 'Platform', type: 'radio', options: [{ label: 'Mobile', value: 'mobile' }, { label: 'Desktop', value: 'desktop' }], required: true },
    { id: 'notes', label: 'Notes', type: 'text' },
  ],
};

describe('QuestionForm', () => {
  it('disables submit until the required question is answered', async () => {
    const onSubmit = vi.fn();
    render(<QuestionForm form={form} interactive onSubmit={onSubmit} />);
    const submit = screen.getByRole('button', { name: 'Continue' });
    expect(submit).toBeDisabled();
    await userEvent.click(screen.getByRole('radio', { name: 'Mobile' }));
    expect(submit).not.toBeDisabled();
  });

  it('calls onSubmit with formatted text and the raw answers map', async () => {
    const onSubmit = vi.fn();
    render(<QuestionForm form={form} interactive onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Desktop' }));
    // Two textboxes exist: the radio question's "something else" custom-choice
    // input, and the free-text "notes" question — the notes input is the last one.
    const textboxes = screen.getAllByRole('textbox');
    await userEvent.type(textboxes[textboxes.length - 1]!, 'ship it fast');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const [text, answers] = onSubmit.mock.calls[0]!;
    expect(text).toContain('[form answers — discovery]');
    expect(text).toContain('Platform: Desktop');
    expect(answers).toMatchObject({ platform: 'desktop', notes: 'ship it fast' });
  });

  it('renders locked/answered state and hides the submit control', () => {
    render(<QuestionForm form={form} interactive={false} submittedAnswers={{ platform: 'mobile', notes: 'x' }} />);
    expect(screen.getByText('Answered')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Mobile' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Mobile' })).toBeDisabled();
  });

  it('exposes an imperative skipAll() that submits every question as skipped', async () => {
    const onSubmit = vi.fn();
    let handle: { skipAll: () => void; submit: () => void } | null = null;
    render(
      <QuestionForm
        form={form}
        interactive
        onSubmit={onSubmit}
        ref={(h) => {
          handle = h;
        }}
      />,
    );
    handle!.skipAll();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]![0]).toContain('(skipped)');
  });
});
