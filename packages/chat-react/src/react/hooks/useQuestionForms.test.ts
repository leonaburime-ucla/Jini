import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '@jini/chat-core';
import { useQuestionForms } from './useQuestionForms.js';

const FORM_CONTENT = `Let's clarify a few things.
<question-form id="discovery" title="Quick brief">
{
  "questions": [
    { "id": "platform", "label": "Platform", "type": "radio", "options": ["Mobile", "Desktop"], "required": true }
  ]
}
</question-form>`;

describe('useQuestionForms', () => {
  it('finds no forms in a plain conversation', () => {
    const messages: ChatMessage[] = [{ id: '1', role: 'user', content: 'hello' }];
    const { result } = renderHook(() => useQuestionForms(messages));
    expect(result.current.forms).toEqual([]);
    expect(result.current.activeForm).toBeNull();
  });

  it('marks the form on the most recent assistant message as active/interactive', () => {
    const messages: ChatMessage[] = [
      { id: '1', role: 'user', content: 'help me build something' },
      { id: '2', role: 'assistant', content: FORM_CONTENT },
    ];
    const { result } = renderHook(() => useQuestionForms(messages));
    expect(result.current.forms).toHaveLength(1);
    expect(result.current.activeForm?.form.id).toBe('discovery');
    expect(result.current.activeForm?.interactive).toBe(true);
    expect(result.current.activeForm?.submittedAnswers).toBeUndefined();
  });

  it('recovers submitted answers from the following user message and marks the form non-interactive', () => {
    const messages: ChatMessage[] = [
      { id: '1', role: 'user', content: 'help me build something' },
      { id: '2', role: 'assistant', content: FORM_CONTENT },
      { id: '3', role: 'user', content: '[form answers — discovery]\n- Platform: Mobile' },
    ];
    const { result } = renderHook(() => useQuestionForms(messages));
    const form = result.current.forms[0]!;
    expect(form.interactive).toBe(false);
    expect(form.submittedAnswers).toEqual({ platform: 'Mobile' });
    expect(result.current.activeForm).toBeNull();
  });

  it('buildSubmission formats answers into the transcript-safe text the host sends back', () => {
    const messages: ChatMessage[] = [{ id: '2', role: 'assistant', content: FORM_CONTENT }];
    const { result } = renderHook(() => useQuestionForms(messages));
    const form = result.current.forms[0]!.form;
    const text = result.current.buildSubmission(form, { platform: 'Mobile' });
    expect(text).toContain('[form answers — discovery]');
    expect(text).toContain('Platform: Mobile');
  });

  it('an older form is not interactive once a newer assistant message exists', () => {
    const messages: ChatMessage[] = [
      { id: '1', role: 'assistant', content: FORM_CONTENT },
      { id: '2', role: 'assistant', content: 'moving on without answering' },
    ];
    const { result } = renderHook(() => useQuestionForms(messages));
    expect(result.current.forms[0]?.interactive).toBe(false);
    expect(result.current.activeForm).toBeNull();
  });
});
