import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SvgSourcePane } from './SvgSourcePane.js';

describe('SvgSourcePane', () => {
  it('renders the preview image in preview mode', () => {
    render(<SvgSourcePane mode="preview" previewSrc="/a.svg" previewAlt="a.svg" source={null} />);
    expect(screen.getByAltText('a.svg')).toHaveAttribute('src', '/a.svg');
  });

  it('renders source text in source mode', () => {
    const { container } = render(<SvgSourcePane mode="source" previewSrc="/a.svg" previewAlt="a.svg" source="<svg></svg>" />);
    expect(container.querySelector('pre')?.textContent).toBe('<svg></svg>');
  });

  it('shows a loading message while source is loading', () => {
    render(<SvgSourcePane mode="source" previewSrc="/a.svg" previewAlt="a.svg" source={null} loading loadingLabel="Loading…" />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('shows an error message when the source failed to load', () => {
    render(<SvgSourcePane mode="source" previewSrc="/a.svg" previewAlt="a.svg" source={null} error errorLabel="Unavailable" />);
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
  });

  it('renders empty source text as an empty pre rather than crashing', () => {
    const { container } = render(<SvgSourcePane mode="source" previewSrc="/a.svg" previewAlt="a.svg" source={null} />);
    expect(container.querySelector('pre')?.textContent).toBe('');
  });
});
