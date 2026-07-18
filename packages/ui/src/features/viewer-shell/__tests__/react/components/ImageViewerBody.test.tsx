import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ImageViewerBody } from '../../../react/components/ImageViewerBody.js';

describe('ImageViewerBody', () => {
  it('renders an img with the given src and alt', () => {
    render(<ImageViewerBody src="/a.png" alt="a.png" />);
    const img = screen.getByAltText('a.png');
    expect(img).toHaveAttribute('src', '/a.png');
  });
});
