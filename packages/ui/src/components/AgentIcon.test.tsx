// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AgentIcon } from './AgentIcon.js';

describe('AgentIcon', () => {
  it('renders an img with the default base path for a known svg-family id', () => {
    const { container } = render(<AgentIcon id="claude" size={24} />);
    const img = container.querySelector('img');
    expect(img?.getAttribute('src')).toBe('/agent-icons/claude.svg');
    expect(img?.getAttribute('width')).toBe('24');
  });

  it('honors a custom basePath', () => {
    const { container } = render(<AgentIcon id="devin" basePath="/assets/agents" />);
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/assets/agents/devin.png');
  });

  it('renders a mask-based span for mono icons', () => {
    const { container } = render(<AgentIcon id="opencode" />);
    const span = container.querySelector('span.agent-icon-mono');
    expect(span).not.toBeNull();
    expect(container.querySelector('img')).toBeNull();
  });

  it('falls back to an initial-letter badge for unknown ids', () => {
    const { getByText } = render(<AgentIcon id="some-new-agent" />);
    expect(getByText('S')).toBeTruthy();
  });
});
