import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ChatMessage } from '@jini/chat-core';
import { MessageRow } from './MessageRow.js';

describe('MessageRow', () => {
  it('renders a user message with its content and attachments', () => {
    const message: ChatMessage = { id: 'u1', role: 'user', content: 'hello there', attachments: [{ path: '/a.png', name: 'a.png', kind: 'image' }] };
    render(<MessageRow message={message} />);
    expect(screen.getByText('hello there')).toBeInTheDocument();
    expect(screen.getByText('a.png')).toBeInTheDocument();
  });

  it('renders an assistant message body as markdown', () => {
    const message: ChatMessage = { id: 'a1', role: 'assistant', content: 'some **bold** result', runStatus: 'succeeded' };
    render(<MessageRow message={message} />);
    expect(screen.getByText('bold', { selector: 'strong' })).toBeInTheDocument();
  });

  it('renders a tool timeline for events on the message', () => {
    const message: ChatMessage = {
      id: 'a2',
      role: 'assistant',
      content: 'Let me check.',
      events: [
        { kind: 'tool_use', id: 't1', name: 'Bash', input: { command: 'pwd' } },
        { kind: 'tool_result', toolUseId: 't1', content: '/home', isError: false },
      ],
      runStatus: 'succeeded',
    };
    render(<MessageRow message={message} runSucceeded />);
    expect(screen.getByText('Bash')).toBeInTheDocument();
  });

  it('strips a completed <artifact> block from the visible text', () => {
    const message: ChatMessage = { id: 'a3', role: 'assistant', content: 'Here:\n<artifact identifier="x" type="text/html" title="X">\n<h1>hi</h1>\n</artifact>\nDone.', runStatus: 'succeeded' };
    render(<MessageRow message={message} />);
    expect(screen.queryByText('<h1>hi</h1>', { exact: false })).not.toBeInTheDocument();
    expect(screen.getByText('Here:')).toBeInTheDocument();
    expect(screen.getByText('Done.')).toBeInTheDocument();
  });

  it('renders an inline question-form and forwards submit', async () => {
    const content = 'Quick question:\n<question-form id="q1" title="Pick one">\n{"questions":[{"id":"x","label":"X","type":"radio","options":["A","B"],"required":true}]}\n</question-form>';
    const message: ChatMessage = { id: 'a4', role: 'assistant', content, runStatus: 'succeeded' };
    const onSubmit = vi.fn();
    render(<MessageRow message={message} questionFormInteractive onQuestionFormSubmit={onSubmit} />);
    expect(screen.getByText('Pick one')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'A' }));
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('shows a pending indicator for a running message with no content yet', () => {
    const message: ChatMessage = { id: 'a5', role: 'assistant', content: '', runStatus: 'running' };
    render(<MessageRow message={message} runStreaming />);
    expect(screen.getByText('Thinking…')).toBeInTheDocument();
  });

  it('shows a failure indicator for a failed run', () => {
    const message: ChatMessage = { id: 'a6', role: 'assistant', content: 'partial output', runStatus: 'failed' };
    render(<MessageRow message={message} />);
    expect(screen.getByText('This turn failed.')).toBeInTheDocument();
  });
});
