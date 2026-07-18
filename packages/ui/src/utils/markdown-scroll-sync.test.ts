import { describe, expect, it } from 'vitest';
import { buildScrollAnchors, extractMarkdownBlockLines, mapScrollPosition } from './markdown-scroll-sync.js';

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
});
