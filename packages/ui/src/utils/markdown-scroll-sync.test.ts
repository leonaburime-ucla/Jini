import { describe, expect, it } from 'vitest';
import {
  buildScrollAnchors,
  extractMarkdownBlockLines,
  mapScrollPosition,
  measureEditorBlockOffsets,
  measurePreviewBlockOffsets,
} from './markdown-scroll-sync.js';

/** Gives `el` a fixed `getBoundingClientRect().top`, bypassing jsdom's
 *  always-zero layout so a real (non-degenerate) offset can be measured. A
 *  fresh own-property function (not a `vi.spyOn` patch of the shared
 *  `Element.prototype` method) so v8 coverage attribution stays intact. */
function stubTop(el: Element, top: number): void {
  Object.defineProperty(el, 'getBoundingClientRect', {
    value: () => ({ top, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON() {} }),
    configurable: true,
  });
}

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
});

describe('buildScrollAnchors', () => {
  it('wraps offsets with a leading 0 and trailing scrollHeight', () => {
    expect(buildScrollAnchors([10, 20], 100)).toEqual([0, 10, 20, 100]);
  });

  it('clamps out-of-range and non-finite offsets, staying non-decreasing', () => {
    expect(buildScrollAnchors([-5, Number.NaN, 500], 100)).toEqual([0, 0, 0, 100, 100]);
  });

  it('pulls a later offset forward to the previous anchor when it would otherwise regress', () => {
    // [0, 50, 10, 100]: the raw "10" is less than the "50" anchor right
    // before it, so it must be clamped up to 50 to keep the array
    // non-decreasing.
    expect(buildScrollAnchors([50, 10], 100)).toEqual([0, 50, 50, 100]);
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

  it('binary-searches the bracketing segment across more than two anchors', () => {
    // 4 anchors -> the `while (high - low > 1)` loop runs more than once,
    // taking both the "mid is still below value" (low = mid) and "mid is at
    // or above value" (high = mid) branches before landing on [10, 20].
    const source = [0, 10, 20, 30];
    const target = [0, 100, 200, 300];
    expect(mapScrollPosition(15, source, target)).toBe(150);
  });
});

describe('measureEditorBlockOffsets', () => {
  it('returns null for an empty blockLines list', () => {
    const textarea = document.createElement('textarea');
    expect(measureEditorBlockOffsets(textarea, [], 'hello')).toBeNull();
  });

  it('measures a single-block document (trivially "has progression" regardless of jsdom\'s zeroed layout)', () => {
    const textarea = document.createElement('textarea');
    // whiteSpace left unset -> computed value is '' -> hits the `!style.whiteSpace` arm.
    expect(measureEditorBlockOffsets(textarea, [1], 'hello world')).toEqual([0]);
  });

  it('measures when the textarea already computes white-space: normal', () => {
    const textarea = document.createElement('textarea');
    textarea.style.whiteSpace = 'normal';
    expect(measureEditorBlockOffsets(textarea, [1], 'hello world')).toEqual([0]);
  });

  it('leaves a non-normal, already-set white-space computed style alone', () => {
    const textarea = document.createElement('textarea');
    textarea.style.whiteSpace = 'pre';
    expect(measureEditorBlockOffsets(textarea, [1], 'hello world')).toEqual([0]);
  });

  it('merges multiple blocks that start on the same source line, and falls back to null when jsdom reports no vertical progression', () => {
    const textarea = document.createElement('textarea');
    // Blocks 0 and 1 both start on line 1 (the "existing" merge branch);
    // block 2 starts on line 3. Three markers across a 3-line, non-final-\n
    // buffer exercises both the "line has markers" and "line has no
    // markers" paths, and both the "not last line" and "last line" \n
    // branches. jsdom never lays anything out, so every marker's real
    // `offsetTop` is 0 -> no vertical progression -> null.
    expect(measureEditorBlockOffsets(textarea, [1, 1, 3], 'first\n\nsecond')).toBeNull();
  });
});

describe('measurePreviewBlockOffsets', () => {
  it('returns null when blockCount is 0', () => {
    const pane = document.createElement('div');
    expect(measurePreviewBlockOffsets(pane, 0)).toBeNull();
  });

  it('returns null when the preview root selector matches nothing', () => {
    const pane = document.createElement('div');
    pane.innerHTML = '<p>no article wrapper</p>';
    expect(measurePreviewBlockOffsets(pane, 1)).toBeNull();
  });

  it('returns null when the rendered child count does not match blockCount', () => {
    const pane = document.createElement('div');
    pane.innerHTML = '<article class="markdown-rendered"><p>only one child</p></article>';
    expect(measurePreviewBlockOffsets(pane, 2)).toBeNull();
  });

  it('returns null when matched children report no vertical progression (jsdom default zeroed layout)', () => {
    const pane = document.createElement('div');
    pane.innerHTML = '<article class="markdown-rendered"><p>a</p><p>b</p></article>';
    expect(measurePreviewBlockOffsets(pane, 2)).toBeNull();
  });

  it('filters non-element children and measures real offsets against a custom preview selector', () => {
    const pane = document.createElement('div');
    const article = document.createElement('article');
    article.className = 'custom-root';
    const stray = document.createTextNode('stray whitespace text, not a block element');
    const child1 = document.createElement('p');
    const child2 = document.createElement('p');
    article.append(stray, child1, child2);
    pane.appendChild(article);
    stubTop(pane, 0);
    stubTop(child1, 10);
    stubTop(child2, 50);

    expect(measurePreviewBlockOffsets(pane, 2, '.custom-root')).toEqual([10, 50]);
  });
});
