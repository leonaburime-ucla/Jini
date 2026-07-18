import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PopoverMenu } from '../../components/PopoverMenu.js';

describe('PopoverMenu', () => {
  it('renders children inside a jini-popover wrapper', () => {
    const { container } = render(
      <PopoverMenu>
        <div data-testid="item">row</div>
      </PopoverMenu>,
    );
    const wrap = container.querySelector('.jini-popover');
    expect(wrap).not.toBeNull();
    expect(wrap?.querySelector('[data-testid="item"]')).not.toBeNull();
  });

  it('renders an empty wrapper when given no children', () => {
    const { container } = render(<PopoverMenu />);
    const wrap = container.querySelector('.jini-popover');
    expect(wrap).not.toBeNull();
    expect(wrap?.childNodes.length).toBe(0);
  });

  it('appends a custom className', () => {
    const { container } = render(<PopoverMenu className="automation-popover--schedule" />);
    expect(container.querySelector('.jini-popover.automation-popover--schedule')).not.toBeNull();
  });
});
