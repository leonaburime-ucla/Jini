// @vitest-environment jsdom
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EdgeScrollZones } from '../../components/EdgeScrollZones.js';

function renderZones(edges: { left: boolean; right: boolean }) {
  const startAutoScroll = vi.fn();
  const stopAutoScroll = vi.fn();
  const nudge = vi.fn();
  const utils = render(
    <EdgeScrollZones edges={edges} startAutoScroll={startAutoScroll} stopAutoScroll={stopAutoScroll} nudge={nudge} />,
  );
  const [left, right] = utils.container.querySelectorAll('.jini-edge-scroll-zone');
  return { ...utils, startAutoScroll, stopAutoScroll, nudge, left: left as HTMLElement, right: right as HTMLElement };
}

describe('EdgeScrollZones', () => {
  it('renders both zones as aria-hidden decorative overlays', () => {
    const { left, right } = renderZones({ left: false, right: false });
    expect(left).toHaveAttribute('aria-hidden');
    expect(right).toHaveAttribute('aria-hidden');
  });

  it('marks data-active only for reachable edges', () => {
    const { left, right } = renderZones({ left: true, right: false });
    expect(left).toHaveAttribute('data-active', 'true');
    expect(right).not.toHaveAttribute('data-active');
  });

  it('marks both zones active when both edges are reachable', () => {
    const { left, right } = renderZones({ left: true, right: true });
    expect(left).toHaveAttribute('data-active', 'true');
    expect(right).toHaveAttribute('data-active', 'true');
  });

  it('marks neither zone active when neither edge is reachable', () => {
    const { left, right } = renderZones({ left: false, right: false });
    expect(left).not.toHaveAttribute('data-active');
    expect(right).not.toHaveAttribute('data-active');
  });

  it('starts a leftward glide on pointer enter over the left zone', () => {
    const { left, startAutoScroll } = renderZones({ left: true, right: true });
    fireEvent.pointerEnter(left);
    expect(startAutoScroll).toHaveBeenCalledWith(-1);
  });

  it('starts a rightward glide on pointer enter over the right zone', () => {
    const { right, startAutoScroll } = renderZones({ left: true, right: true });
    fireEvent.pointerEnter(right);
    expect(startAutoScroll).toHaveBeenCalledWith(1);
  });

  it('stops the glide on pointer leave', () => {
    const { left, stopAutoScroll } = renderZones({ left: true, right: true });
    fireEvent.pointerLeave(left);
    expect(stopAutoScroll).toHaveBeenCalledTimes(1);
  });

  it('stops the glide on pointer down (so a click does not also glide)', () => {
    const { right, stopAutoScroll } = renderZones({ left: true, right: true });
    fireEvent.pointerDown(right);
    expect(stopAutoScroll).toHaveBeenCalledTimes(1);
  });

  it('nudges left on a left-zone click', () => {
    const { left, nudge } = renderZones({ left: true, right: true });
    fireEvent.click(left);
    expect(nudge).toHaveBeenCalledWith(-1);
  });

  it('nudges right on a right-zone click', () => {
    const { right, nudge } = renderZones({ left: true, right: true });
    fireEvent.click(right);
    expect(nudge).toHaveBeenCalledWith(1);
  });

  it('renders a chevron icon inside each zone', () => {
    const { left, right } = renderZones({ left: true, right: true });
    expect(left.querySelector('svg')).not.toBeNull();
    expect(right.querySelector('svg')).not.toBeNull();
  });
});
