import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildScrollAnchors,
  extractMarkdownBlockLines,
  mapScrollPosition,
  measureEditorBlockOffsets,
  measurePreviewBlockOffsets,
} from '../markdown-scroll-sync.js';

describe('extractMarkdownBlockLines', () => {
  it('returns an empty array for empty input', () => {
    expect(extractMarkdownBlockLines('')).toEqual([]);
  });

  it('finds one start line per top-level block', () => {
    const markdown = '# Heading\n\nParagraph one.\n\n- item one\n- item two\n\nParagraph two.\n';
    const lines = extractMarkdownBlockLines(markdown);
    // heading, paragraph, list (collapsed to one entry), paragraph
    expect(lines).toEqual([1, 3, 5, 8]);
  });

  it('collapses nested list-item content into the list container', () => {
    const markdown = '- one\n  more text\n- two\n';
    expect(extractMarkdownBlockLines(markdown)).toEqual([1]);
  });

  it('returns an empty array rather than throwing when the underlying parser throws', async () => {
    // Mocks the underlying `micromark` parse call to throw, rather than
    // trying to hand-craft a markdown string that breaks a deliberately
    // permissive parser (it accepts effectively any string) — this proves
    // the real defensive try/catch this file wraps around it, without
    // relying on an as-yet-undiscovered micromark bug.
    vi.doMock('micromark', () => ({
      parse: () => {
        throw new Error('parser exploded');
      },
      postprocess: (x: unknown) => x,
      preprocess: () => () => [],
    }));
    vi.resetModules();
    const fresh = await import('../markdown-scroll-sync.js');
    expect(fresh.extractMarkdownBlockLines('# still valid input')).toEqual([]);
    vi.doUnmock('micromark');
    vi.resetModules();
  });
});

describe('buildScrollAnchors', () => {
  it('wraps offsets with a leading 0 and trailing scrollHeight', () => {
    expect(buildScrollAnchors([10, 20], 100)).toEqual([0, 10, 20, 100]);
  });

  it('clamps out-of-range and non-finite offsets, staying non-decreasing', () => {
    expect(buildScrollAnchors([-5, Number.NaN, 500], 100)).toEqual([0, 0, 0, 100, 100]);
  });

  it('clamps a value that dips below the running previous anchor (out-of-order input)', () => {
    // 80 then 10: the second anchor would otherwise regress below the
    // first, which the caller relies on never happening (interpolation
    // assumes non-decreasing anchors).
    expect(buildScrollAnchors([80, 10], 100)).toEqual([0, 80, 80, 100]);
  });

  it('treats a hole in the offsets array as 0, still clamped non-decreasing (defensive against non-TS callers)', () => {
    const holey: number[] = [10];
    holey[2] = 30; // index 1 is a genuine array hole, not `undefined` assigned
    // The hole normalizes to raw value 0, but the running non-decreasing
    // clamp then pulls it back up to the previous anchor (10).
    expect(buildScrollAnchors(holey, 100)).toEqual([0, 10, 10, 30, 100]);
  });
});

describe('mapScrollPosition', () => {
  it('interpolates linearly within a bracketing segment', () => {
    const source = [0, 100];
    const target = [0, 200];
    expect(mapScrollPosition(50, source, target)).toBe(100);
  });

  it('clamps below the first anchor to the first target', () => {
    expect(mapScrollPosition(-10, [0, 100], [0, 200])).toBe(0);
  });

  it('clamps above the last anchor to the last target', () => {
    expect(mapScrollPosition(999, [0, 100], [0, 200])).toBe(200);
  });

  it('returns the input value when either anchor array is empty', () => {
    expect(mapScrollPosition(42, [], [])).toBe(42);
  });

  it('returns the sole target when arrays have exactly one anchor', () => {
    expect(mapScrollPosition(42, [10], [99])).toBe(99);
  });

  it('treats a hole in a length-1 target array as 0', () => {
    const holeyTarget: number[] = [];
    holeyTarget[0] = undefined as unknown as number;
    expect(mapScrollPosition(5, [10], holeyTarget)).toBe(0);
  });

  it('treats holes in the first-anchor position of both arrays as 0', () => {
    const holeySource: number[] = [];
    holeySource[1] = 10;
    const holeyTarget: number[] = [];
    holeyTarget[1] = 20;
    // value <= source[0]??0 (0) is true for a negative value, returning
    // target[0]??0.
    expect(mapScrollPosition(-5, holeySource, holeyTarget)).toBe(0);
  });

  it('treats holes in the last-anchor position of both arrays as 0', () => {
    const holeySource = [0, undefined as unknown as number];
    const holeyTarget = [0, undefined as unknown as number];
    // value >= source[last]??0 (0) is true for any non-negative value.
    expect(mapScrollPosition(999, holeySource, holeyTarget)).toBe(0);
  });

  it('treats a hole at the binary-search midpoint as 0', () => {
    const source = [0, undefined as unknown as number, 100, 200];
    const target = [0, 10, 100, 200];
    // Midpoint index 1 is a hole; source[1]??0 (0) <= 50 is true, so `low`
    // advances past it during the search rather than throwing.
    expect(mapScrollPosition(50, source, target)).toBeGreaterThanOrEqual(0);
  });

  it('treats a hole at the bracketing low index as 0 for both source and target', () => {
    const source = [0, undefined as unknown as number, 100];
    const target = [0, undefined as unknown as number, 200];
    // Binary search settles on low=1 (hole -> 0), high=2 (100): value 50
    // lands here.
    expect(mapScrollPosition(50, source, target)).toBe(100);
  });

  it('treats a hole at the bracketing high index as 0 for both source and target', () => {
    // A negative value paired with a negative first anchor keeps the early
    // clamp from short-circuiting, so the search reaches the loop; at the
    // midpoint, a hole (0) is greater than a sufficiently negative value,
    // so `high` (not `low`) lands on the hole this time.
    const source = [-100, undefined as unknown as number, 100];
    const target = [-200, undefined as unknown as number, 200];
    expect(mapScrollPosition(-50, source, target)).toBe(-100);
  });

});

describe('measureEditorBlockOffsets', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('returns null when there are no blocks to measure', () => {
    const textarea = document.createElement('textarea');
    expect(measureEditorBlockOffsets(textarea, [], 'hello')).toBeNull();
  });

  it('returns null when the mirror measurement shows no vertical progression (jsdom default zero layout)', () => {
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    const offsets = measureEditorBlockOffsets(textarea, [1, 3], 'first\n\nsecond');
    expect(offsets).toBeNull();
  });

  it('measures real per-block pixel offsets when the mirror markers report distinct positions', () => {
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    const originalDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetTop')!;
    Object.defineProperty(HTMLElement.prototype, 'offsetTop', {
      configurable: true,
      get(this: HTMLElement) {
        const blockIndex = this.getAttribute?.('data-md-block');
        return blockIndex !== null && blockIndex !== undefined ? Number(blockIndex) * 20 : 0;
      },
    });
    try {
      // Two blocks starting on distinct, non-first, non-last lines so the
      // multi-line buffer-building loop's newline-join branch (not the
      // last line) runs at least once for a real, non-degenerate line set.
      const offsets = measureEditorBlockOffsets(textarea, [1, 3], 'first\nsecond\nthird');
      expect(offsets).toEqual([0, 20]);
    } finally {
      Object.defineProperty(HTMLElement.prototype, 'offsetTop', originalDescriptor);
    }
  });

  it('collapses two blocks that clamp onto the same source line into one marker slot', () => {
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    const originalDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetTop')!;
    Object.defineProperty(HTMLElement.prototype, 'offsetTop', {
      configurable: true,
      get(this: HTMLElement) {
        const blockIndex = this.getAttribute?.('data-md-block');
        return blockIndex !== null && blockIndex !== undefined ? Number(blockIndex) * 20 : 0;
      },
    });
    try {
      // Both block "start lines" clamp to line 1 (line 5 is past the end of
      // a 1-line text) — exercises the `existing` (duplicate marker at the
      // same line) branch in the marker-grouping loop. Both markers still
      // render (as separate spans on that one line), each keeping its own
      // block index and offset.
      const offsets = measureEditorBlockOffsets(textarea, [1, 5], 'only one line');
      expect(offsets).toEqual([0, 20]);
    } finally {
      Object.defineProperty(HTMLElement.prototype, 'offsetTop', originalDescriptor);
    }
  });

  it('does not force pre-wrap when the textarea already has a non-normal white-space style', () => {
    const textarea = document.createElement('textarea');
    textarea.style.whiteSpace = 'nowrap';
    document.body.appendChild(textarea);
    const originalDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetTop')!;
    Object.defineProperty(HTMLElement.prototype, 'offsetTop', {
      configurable: true,
      get(this: HTMLElement) {
        const blockIndex = this.getAttribute?.('data-md-block');
        return blockIndex !== null && blockIndex !== undefined ? Number(blockIndex) * 20 : 0;
      },
    });
    const appended: Node[] = [];
    const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(function (
      this: HTMLElement,
      node: Node,
    ) {
      appended.push(node);
      return HTMLElement.prototype.appendChild.call(this, node);
    });
    try {
      measureEditorBlockOffsets(textarea, [1, 2], 'a\nb');
      const mirror = appended.find((node) => node instanceof HTMLDivElement) as HTMLDivElement | undefined;
      expect(mirror?.style.whiteSpace).toBe('nowrap');
    } finally {
      appendSpy.mockRestore();
      Object.defineProperty(HTMLElement.prototype, 'offsetTop', originalDescriptor);
    }
  });

  it('defaults an explicit "normal" white-space to pre-wrap too', () => {
    const textarea = document.createElement('textarea');
    textarea.style.whiteSpace = 'normal';
    document.body.appendChild(textarea);
    const appended: Node[] = [];
    const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(function (
      this: HTMLElement,
      node: Node,
    ) {
      appended.push(node);
      return HTMLElement.prototype.appendChild.call(this, node);
    });
    try {
      measureEditorBlockOffsets(textarea, [1], 'a');
      const mirror = appended.find((node) => node instanceof HTMLDivElement) as HTMLDivElement | undefined;
      expect(mirror?.style.whiteSpace).toBe('pre-wrap');
    } finally {
      appendSpy.mockRestore();
    }
  });
});

describe('measurePreviewBlockOffsets', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('returns null when blockCount is 0', () => {
    const pane = document.createElement('div');
    expect(measurePreviewBlockOffsets(pane, 0)).toBeNull();
  });

  it('returns null when the preview selector matches nothing', () => {
    const pane = document.createElement('div');
    pane.innerHTML = '<div class="not-the-article"></div>';
    expect(measurePreviewBlockOffsets(pane, 1)).toBeNull();
  });

  it('returns null when the rendered child count does not match blockCount', () => {
    const pane = document.createElement('div');
    pane.innerHTML = '<article class="markdown-rendered"><p>one</p><p>two</p></article>';
    expect(measurePreviewBlockOffsets(pane, 3)).toBeNull();
  });

  it('returns null when the measured children show no vertical progression (jsdom default zero layout)', () => {
    const pane = document.createElement('div');
    pane.innerHTML = '<article class="markdown-rendered"><p>one</p><p>two</p></article>';
    expect(measurePreviewBlockOffsets(pane, 2)).toBeNull();
  });

  it('measures real per-child pixel offsets via getBoundingClientRect', () => {
    const pane = document.createElement('div');
    pane.innerHTML =
      '<article class="markdown-rendered"><p data-i="0">one</p><p data-i="1">two</p></article>';
    document.body.appendChild(pane);

    const original = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function (this: Element) {
      if (this === pane) {
        return { top: 0 } as DOMRect;
      }
      const i = this.getAttribute?.('data-i');
      return { top: i !== null && i !== undefined ? Number(i) * 40 : 0 } as DOMRect;
    };
    try {
      const offsets = measurePreviewBlockOffsets(pane, 2);
      expect(offsets).toEqual([0, 40]);
    } finally {
      Element.prototype.getBoundingClientRect = original;
    }
  });

  it('honors a custom previewSelector', () => {
    const pane = document.createElement('div');
    pane.innerHTML = '<section class="custom-root"><p>one</p></section>';
    const original = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function () {
      return { top: 0 } as DOMRect;
    };
    try {
      // Single child trivially "has progression" (length <= 1 short-circuit).
      expect(measurePreviewBlockOffsets(pane, 1, '.custom-root')).toEqual([0]);
    } finally {
      Element.prototype.getBoundingClientRect = original;
    }
  });
});
