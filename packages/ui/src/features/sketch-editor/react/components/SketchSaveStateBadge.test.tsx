import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SketchSaveStateBadge } from './SketchSaveStateBadge.js';

describe('SketchSaveStateBadge', () => {
  it('renders the given label and a status role', () => {
    render(<SketchSaveStateBadge state="saved" label="Saved" />);
    expect(screen.getByRole('status').textContent).toContain('Saved');
  });

  it('applies a state-specific class', () => {
    render(<SketchSaveStateBadge state="dirty" label="Unsaved changes" />);
    expect(screen.getByRole('status').className).toContain('is-dirty');
  });
});
