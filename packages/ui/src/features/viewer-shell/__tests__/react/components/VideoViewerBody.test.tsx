import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { VideoViewerBody } from '../../../react/components/VideoViewerBody.js';

describe('VideoViewerBody', () => {
  it('renders a controlled video element with the given src', () => {
    const { container } = render(<VideoViewerBody src="/a.mp4" />);
    const video = container.querySelector('video');
    expect(video).not.toBeNull();
    expect(video).toHaveAttribute('src', '/a.mp4');
    expect(video).toHaveAttribute('controls');
    expect(video).toHaveAttribute('playsinline');
  });
});
