// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Icon } from './Icon.js';

describe('Icon', () => {
  it('renders an svg with the requested size for a known name', () => {
    const { container } = render(<Icon name="check" size={20} />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('width')).toBe('20');
    expect(svg?.getAttribute('height')).toBe('20');
  });

  it('applies the icon-spin class for the spinner icon', () => {
    const { container } = render(<Icon name="spinner" className="extra" />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('class')).toBe('icon-spin extra');
  });

  it('defaults to a 14px stroke icon', () => {
    const { container } = render(<Icon name="close" />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('14');
    expect(svg?.getAttribute('stroke-width')).toBe('1.6');
  });
});
