import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Markdown } from './Markdown.js';

describe('Markdown', () => {
  it('renders headings, paragraphs, and inline emphasis', () => {
    render(<Markdown>{'# Title\n\nSome **bold** and *italic* text.'}</Markdown>);
    expect(screen.getByRole('heading', { level: 1, name: 'Title' })).toBeInTheDocument();
    expect(screen.getByText('bold', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByText('italic', { selector: 'em' })).toBeInTheDocument();
  });

  it('renders fenced code blocks verbatim without inline-parsing their contents', () => {
    render(<Markdown>{'```ts\nconst x = 1;\n```'}</Markdown>);
    expect(screen.getByText('const x = 1;')).toBeInTheDocument();
  });

  it('renders unordered and ordered lists', () => {
    render(<Markdown>{'- first\n- second\n\n1. one\n2. two'}</Markdown>);
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
  });

  it('renders bare autolinks as anchors', () => {
    render(<Markdown>{'see https://example.com/docs for more'}</Markdown>);
    const link = screen.getByRole('link', { name: 'https://example.com/docs' });
    expect(link).toHaveAttribute('href', 'https://example.com/docs');
  });

  it('renders a blockquote and a horizontal rule', () => {
    const { container } = render(<Markdown>{'> quoted line\n\n---\n\nafter'}</Markdown>);
    expect(container.querySelector('blockquote')).toHaveTextContent('quoted line');
    expect(container.querySelector('hr')).toBeInTheDocument();
  });
});
