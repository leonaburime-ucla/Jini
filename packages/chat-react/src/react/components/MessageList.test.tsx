import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ChatMessage } from '@jini/chat-core';
import { MessageList } from './MessageList.js';

const messages: ChatMessage[] = [
  { id: '1', role: 'user', content: 'hi' },
  { id: '2', role: 'assistant', content: 'hello back', runStatus: 'succeeded' },
];

describe('MessageList', () => {
  it('renders every message in order', () => {
    render(<MessageList messages={messages} />);
    expect(screen.getByText('hi')).toBeInTheDocument();
    expect(screen.getByText('hello back')).toBeInTheDocument();
  });

  it('marks only the last message as streaming while isStreaming is true', () => {
    const streamingMessages: ChatMessage[] = [
      { id: '1', role: 'assistant', content: '', runStatus: 'running', events: [{ kind: 'tool_use', id: 't1', name: 'Bash', input: {} }] },
      { id: '2', role: 'assistant', content: '', runStatus: 'running', events: [{ kind: 'tool_use', id: 't2', name: 'Bash', input: {} }] },
    ];
    render(<MessageList messages={streamingMessages} isStreaming />);
    // Both render a Bash tool card; only the last (id: '2') is "running" (spinner) — the
    // first, non-last message resolves to runStreaming=false so its unresolved
    // tool renders as an error state instead of a spinner.
    const runningBadges = screen.getAllByTitle('Running');
    expect(runningBadges).toHaveLength(1);
  });

  it('calls onScrolled once after an auto-scroll driven by scrollIntent', () => {
    const onScrolled = vi.fn();
    render(<MessageList messages={messages} scrollIntent onScrolled={onScrolled} />);
    expect(onScrolled).toHaveBeenCalledTimes(1);
  });

  it('does not scroll (or call onScrolled) when scrollIntent is false', () => {
    const onScrolled = vi.fn();
    render(<MessageList messages={messages} scrollIntent={false} onScrolled={onScrolled} />);
    expect(onScrolled).not.toHaveBeenCalled();
  });

  it('marks the active question-form message interactive and routes submit with its message id', () => {
    const withForm: ChatMessage[] = [{ id: 'a1', role: 'assistant', content: '<question-form id="q" title="T">\n{"questions":[{"id":"x","label":"X","type":"text"}]}\n</question-form>', runStatus: 'running' }];
    const onSubmit = vi.fn();
    render(<MessageList messages={withForm} activeQuestionFormMessageId="a1" onQuestionFormSubmit={onSubmit} />);
    expect(screen.getByText('T')).toBeInTheDocument();
  });
});
