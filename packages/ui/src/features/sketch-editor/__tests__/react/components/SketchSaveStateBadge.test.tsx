import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SketchSaveStateBadge } from '../../../react/components/SketchSaveStateBadge.js';

describe('SketchSaveStateBadge', () => {
  it('renders the given label and a status role', () => {
    render(<SketchSaveStateBadge state="saved" label="Saved" />);
    expect(screen.getByRole('status').textContent).toContain('Saved');
  });

  it('applies a state-specific class', () => {
    render(<SketchSaveStateBadge state="dirty" label="Unsaved changes" />);
    expect(screen.getByRole('status').className).toContain('is-dirty');
  });

  it('shows a spinning spinner icon while saving', () => {
    render(<SketchSaveStateBadge state="saving" label="Saving…" />);
    const svg = screen.getByRole('status').querySelector('svg')!;
    expect(svg.classList.contains('icon-spin')).toBe(true);
  });

  it('does not spin the icon once saved (non-saving states)', () => {
    render(<SketchSaveStateBadge state="saved" label="Saved" />);
    const svg = screen.getByRole('status').querySelector('svg')!;
    expect(svg.classList.contains('icon-spin')).toBe(false);
  });
});
