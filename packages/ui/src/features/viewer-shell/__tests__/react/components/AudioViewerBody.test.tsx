import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AudioViewerBody } from '../../../react/components/AudioViewerBody.js';

describe('AudioViewerBody', () => {
  it('renders the audio element and the file-name label', () => {
    const { container } = render(<AudioViewerBody src="/a.mp3" label="a.mp3" />);
    const audio = container.querySelector('audio');
    expect(audio).toHaveAttribute('src', '/a.mp3');
    expect(screen.getByText('a.mp3')).toBeInTheDocument();
  });
});
