import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, afterEach } from 'vitest';
import { ToolCard } from './ToolCard.js';
import { registerToolRenderer, clearToolRenderers } from '../../tool-renderer-registry.js';

afterEach(() => clearToolRenderers());

describe('ToolCard', () => {
  it('renders a Bash card with the command and output', async () => {
    render(<ToolCard use={{ kind: 'tool_use', id: 't1', name: 'Bash', input: { command: 'ls -la' } }} result={{ kind: 'tool_result', toolUseId: 't1', content: 'a.txt\nb.txt', isError: false }} runSucceeded />);
    expect(screen.getByText('Bash')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button'));
    expect(screen.getByText('ls -la')).toBeInTheDocument();
    expect(document.querySelector('.op-output')?.textContent).toBe('a.txt\nb.txt');
  });

  it('falls back to GenericCard for an unrecognized tool', () => {
    render(<ToolCard use={{ kind: 'tool_use', id: 't2', name: 'CustomTool', input: { query: 'hello' } }} runSucceeded />);
    expect(screen.getByText('CustomTool')).toBeInTheDocument();
    expect(screen.getByText('hello')).toBeInTheDocument();
  });

  it('shows a spinner status while running with no result yet', () => {
    render(<ToolCard use={{ kind: 'tool_use', id: 't3', name: 'WebFetch', input: { url: 'https://x.test' } }} runStreaming />);
    expect(screen.getByTitle('Running')).toBeInTheDocument();
  });

  it('prefers a registered custom renderer over the built-in family card', () => {
    registerToolRenderer('Bash', (props) => <div data-testid="custom">{props.name}:{props.status}</div>);
    render(<ToolCard use={{ kind: 'tool_use', id: 't4', name: 'Bash', input: { command: 'x' } }} runSucceeded />);
    expect(screen.getByTestId('custom')).toHaveTextContent('Bash:complete');
  });

  it('renders TodoWrite input as a TodoCard', () => {
    render(<ToolCard use={{ kind: 'tool_use', id: 't5', name: 'TodoWrite', input: { todos: [{ content: 'step 1', status: 'completed' }] } }} runSucceeded />);
    expect(screen.getByText('Todos')).toBeInTheDocument();
    expect(screen.getByText('1/1')).toBeInTheDocument();
  });
});
