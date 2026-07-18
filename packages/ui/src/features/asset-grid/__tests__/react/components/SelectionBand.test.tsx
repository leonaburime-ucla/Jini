// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SelectionBand } from '../../../react/components/SelectionBand.js';

describe('SelectionBand', () => {
  it('renders nothing when band is null', () => {
    const { container } = render(<SelectionBand band={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('positions the band via fixed inline styles matching the given rect', () => {
    const { container } = render(<SelectionBand band={{ x: 10, y: 20, w: 30, h: 40 }} />);
    const el = container.firstElementChild as HTMLElement;
    expect(el).toHaveStyle({ position: 'fixed', left: '10px', top: '20px', width: '30px', height: '40px' });
  });
});
