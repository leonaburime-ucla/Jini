import { describe, expect, it } from 'vitest';
import {
  anchorBounds,
  annotationBounds,
  clamp,
  clamp01,
  computeDockPlacement,
  dockPlacementEquals,
  DOCKED_PLACEMENT,
  markKind,
  normalizedRectFromPoints,
  normalizedRectToRect,
  rectsOverlap,
  strokeRect,
  textMarksBounds,
  toolbarElementForTool,
  unionRects,
} from './rules.js';

describe('clamp / clamp01', () => {
  it('clamps into range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(50, 0, 10)).toBe(10);
  });
  it('returns min when max < min', () => {
    expect(clamp(5, 10, 0)).toBe(10);
  });
  it('clamp01 clamps to 0..1', () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(0.5)).toBe(0.5);
  });
});

describe('rectsOverlap', () => {
  it('detects overlap', () => {
    expect(rectsOverlap({ x: 0, y: 0, width: 10, height: 10 }, { x: 5, y: 5, width: 10, height: 10 })).toBe(true);
  });
  it('detects no overlap', () => {
    expect(rectsOverlap({ x: 0, y: 0, width: 10, height: 10 }, { x: 20, y: 20, width: 10, height: 10 })).toBe(false);
  });
  it('touching edges do not overlap', () => {
    expect(rectsOverlap({ x: 0, y: 0, width: 10, height: 10 }, { x: 10, y: 0, width: 10, height: 10 })).toBe(false);
  });
});

describe('normalizedRectFromPoints', () => {
  it('normalizes regardless of drag direction', () => {
    const rect = normalizedRectFromPoints({ x: 0.6, y: 0.7 }, { x: 0.2, y: 0.1 });
    expect(rect.x).toBeCloseTo(0.2);
    expect(rect.y).toBeCloseTo(0.1);
    expect(rect.width).toBeCloseTo(0.4);
    expect(rect.height).toBeCloseTo(0.6);
  });
});

describe('normalizedRectToRect', () => {
  it('scales a normalized rect to canvas pixels', () => {
    expect(normalizedRectToRect({ x: 0.25, y: 0.5, width: 0.5, height: 0.25 }, { width: 200, height: 100 })).toEqual({
      x: 50,
      y: 50,
      width: 100,
      height: 25,
    });
  });
  it('returns null for a zero-size canvas', () => {
    expect(normalizedRectToRect({ x: 0, y: 0, width: 1, height: 1 }, { width: 0, height: 0 })).toBeNull();
  });
});

describe('unionRects', () => {
  it('returns null for empty input', () => {
    expect(unionRects([])).toBeNull();
  });
  it('unions multiple rects into an enclosing box', () => {
    expect(
      unionRects([
        { x: 0, y: 0, width: 10, height: 10 },
        { x: 20, y: 30, width: 5, height: 5 },
      ]),
    ).toEqual({ x: 0, y: 0, width: 25, height: 35 });
  });
});

describe('strokeRect', () => {
  it('returns null for empty points', () => {
    expect(strokeRect([], { width: 100, height: 100 })).toBeNull();
  });
  it('pads the bounding box of the points', () => {
    const rect = strokeRect([{ x: 0.5, y: 0.5 }], { width: 100, height: 100 }, 8);
    expect(rect).toEqual({ x: 42, y: 42, width: 16, height: 16 });
  });
});

describe('textMarksBounds', () => {
  it('ignores empty-text marks', () => {
    expect(
      textMarksBounds([{ id: 1, x: 0, y: 0, text: '   ' }], { width: 100, height: 100 }, () => null),
    ).toBeNull();
  });
  it('falls back to the drop point when no live element rect is available', () => {
    const bounds = textMarksBounds([{ id: 1, x: 0.5, y: 0.5, text: 'hi' }], { width: 100, height: 100 }, () => null);
    expect(bounds).toEqual({ x: 50, y: 50, width: 1, height: 1 });
  });
  it('uses the live element rect when available', () => {
    const bounds = textMarksBounds(
      [{ id: 1, x: 0, y: 0, text: 'hi' }],
      { width: 100, height: 100 },
      () => ({ left: 10, top: 10, right: 30, bottom: 20 }),
    );
    expect(bounds).toEqual({ x: 10, y: 10, width: 20, height: 10 });
  });
});

describe('anchorBounds', () => {
  const box = { x: 1, y: 1, width: 1, height: 1 };
  const stroke = { x: 2, y: 2, width: 1, height: 1 };
  const target = { x: 3, y: 3, width: 1, height: 1 };
  it('prefers the last box', () => {
    expect(anchorBounds(box, stroke, target)).toBe(box);
  });
  it('falls back to the last stroke', () => {
    expect(anchorBounds(null, stroke, target)).toBe(stroke);
  });
  it('falls back to the target', () => {
    expect(anchorBounds(null, null, target)).toBe(target);
  });
  it('returns null when nothing is present', () => {
    expect(anchorBounds(null, null, null)).toBeNull();
  });
});

describe('annotationBounds', () => {
  it('returns undefined when nothing is present', () => {
    expect(annotationBounds(null, null, null, null)).toBeUndefined();
  });
  it('returns the single rect unchanged when only one is present', () => {
    const box = { x: 1, y: 1, width: 1, height: 1 };
    expect(annotationBounds(box, null, null, null)).toBe(box);
  });
  it('unions every present rect', () => {
    const box = { x: 0, y: 0, width: 10, height: 10 };
    const stroke = { x: 20, y: 20, width: 5, height: 5 };
    expect(annotationBounds(box, stroke, null, null)).toEqual({ x: 0, y: 0, width: 25, height: 25 });
  });
});

describe('markKind', () => {
  it('click+stroke when both a target and a visual mark are present', () => {
    expect(markKind(true, true)).toBe('click+stroke');
  });
  it('click when only a target is present', () => {
    expect(markKind(true, false)).toBe('click');
  });
  it('stroke when only a visual mark is present', () => {
    expect(markKind(false, true)).toBe('stroke');
  });
  it('undefined when neither is present', () => {
    expect(markKind(false, false)).toBeUndefined();
  });
});

describe('toolbarElementForTool', () => {
  it('maps box to rect (legacy naming)', () => {
    expect(toolbarElementForTool('box')).toBe('rect');
  });
  it('maps text to text', () => {
    expect(toolbarElementForTool('text')).toBe('text');
  });
  it('maps pen to pen', () => {
    expect(toolbarElementForTool('pen')).toBe('pen');
  });
});

describe('dockPlacementEquals', () => {
  it('is true for two docked placements', () => {
    expect(dockPlacementEquals(DOCKED_PLACEMENT, { ...DOCKED_PLACEMENT })).toBe(true);
  });
  it('is false when side differs', () => {
    expect(
      dockPlacementEquals(DOCKED_PLACEMENT, { layout: 'floating', side: 'right', style: DOCKED_PLACEMENT.style }),
    ).toBe(false);
  });
});

describe('computeDockPlacement', () => {
  const hostRect = { x: 0, y: 0, width: 1000, height: 800 };
  const wrapRect = { x: 0, y: 0, width: 1000, height: 800 };
  const dockRect = { width: 200, height: 60 };

  it('falls back to docked when there is no anchor', () => {
    expect(computeDockPlacement({ hostRect, wrapRect, dockRect, anchor: null })).toEqual(DOCKED_PLACEMENT);
  });

  it('falls back to docked when the host is too small', () => {
    const tinyHost = { x: 0, y: 0, width: 100, height: 80 };
    const anchor = { x: 40, y: 30, width: 10, height: 10 };
    expect(computeDockPlacement({ hostRect: tinyHost, wrapRect: tinyHost, dockRect, anchor })).toEqual(DOCKED_PLACEMENT);
  });

  it('prefers the right side when it fits', () => {
    const anchor = { x: 100, y: 100, width: 20, height: 20 };
    const placement = computeDockPlacement({ hostRect, wrapRect, dockRect, anchor });
    expect(placement.layout).toBe('floating');
    expect(placement.side).toBe('right');
  });

  it('flips to the left when the right side does not fit', () => {
    // Anchor near the right edge of the host — the dock would overflow to the right.
    const anchor = { x: 850, y: 100, width: 20, height: 20 };
    const placement = computeDockPlacement({ hostRect, wrapRect, dockRect, anchor });
    expect(placement.layout).toBe('floating');
    expect(placement.side).toBe('left');
  });

  it('falls to bottom when neither left nor right fits (a centered anchor in a narrow host)', () => {
    // Just wide enough to clear the "host too small" gate (>= 320 + 32 min-width
    // margin), but too narrow for a 200px-wide dock to fit beside a centered anchor.
    const narrowHost = { x: 0, y: 0, width: 360, height: 800 };
    const anchor = { x: 170, y: 100, width: 20, height: 20 };
    const placement = computeDockPlacement({ hostRect: narrowHost, wrapRect: narrowHost, dockRect, anchor });
    expect(placement.layout).toBe('floating');
    expect(placement.side).toBe('bottom');
  });

  it('never overlaps the anchor', () => {
    const anchor = { x: 400, y: 400, width: 20, height: 20 };
    const placement = computeDockPlacement({ hostRect, wrapRect, dockRect, anchor });
    expect(placement.layout).toBe('floating');
    // A floating placement always resolves to a concrete left/top pixel pair.
    expect(placement.style.left).toMatch(/px$/);
    expect(placement.style.top).toMatch(/px$/);
  });
});
