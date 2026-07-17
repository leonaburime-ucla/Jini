// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RemixIcon } from './RemixIcon.js';

describe('RemixIcon', () => {
  it('emits an <i> element with the ri-<name> class and sizing', () => {
    const { container } = render(<RemixIcon name="settings-line" size={18} />);
    const el = container.querySelector('i');
    expect(el?.className).toContain('ri-settings-line');
    expect(el?.style.fontSize).toBe('18px');
  });

  it('appends an extra className', () => {
    const { container } = render(<RemixIcon name="close-line" className="extra" />);
    expect(container.querySelector('i')?.className).toBe('ri-close-line extra');
  });
});
