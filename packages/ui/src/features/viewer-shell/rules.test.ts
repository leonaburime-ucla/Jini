// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  appendSavedCommentOrder,
  computeSplitPaneScrollTarget,
  dropEdgeForClientY,
  formatJsonTextForDisplay,
  hasPrecisionSensitiveJsonNumberText,
  hasUnsafeJsonNumber,
  humanFileSize,
  relativeCommentTimeTranslation,
  reorderCommentIds,
  scrollRange,
  scrollRatio,
  scrollTopForRatio,
  visibleSelectedCommentIds,
} from './rules.js';

describe('humanFileSize', () => {
  it('formats bytes', () => {
    expect(humanFileSize(512)).toBe('512 B');
  });
  it('formats kilobytes', () => {
    expect(humanFileSize(3400)).toBe('3.3 KB');
  });
  it('formats megabytes', () => {
    expect(humanFileSize(1024 * 1024 * 2)).toBe('2.0 MB');
  });
});

describe('dropEdgeForClientY', () => {
  it('returns before when above the midpoint', () => {
    expect(dropEdgeForClientY(10, { top: 0, height: 100 })).toBe('before');
  });
  it('returns after when below the midpoint', () => {
    expect(dropEdgeForClientY(90, { top: 0, height: 100 })).toBe('after');
  });
});

describe('reorderCommentIds', () => {
  it('moves an id before the target', () => {
    expect(reorderCommentIds(['a', 'b', 'c'], 'c', 'a', 'before')).toEqual(['c', 'a', 'b']);
  });
  it('moves an id after the target', () => {
    expect(reorderCommentIds(['a', 'b', 'c'], 'a', 'c', 'after')).toEqual(['b', 'c', 'a']);
  });
  it('returns the original order when dragging id is missing', () => {
    const original = ['a', 'b'];
    expect(reorderCommentIds(original, 'zzz', 'a', 'before')).toEqual(original);
  });
  it('returns the original order when target id is missing', () => {
    const original = ['a', 'b'];
    expect(reorderCommentIds(original, 'a', 'zzz', 'before')).toEqual(original);
  });
});

describe('appendSavedCommentOrder', () => {
  it('appends a brand-new id to an empty order', () => {
    expect(appendSavedCommentOrder([], ['a', 'b'], 'c')).toEqual(['a', 'b', 'c']);
  });
  it('leaves the order unchanged when the id is already present', () => {
    const order = ['a', 'b'];
    expect(appendSavedCommentOrder(order, ['a', 'b'], 'a')).toBe(order);
  });
  it('drops ids no longer visible and appends the new one', () => {
    expect(appendSavedCommentOrder(['x', 'a'], ['a', 'b'], 'c')).toEqual(['a', 'b', 'c']);
  });
  it('returns the input unchanged for an empty savedId', () => {
    const order = ['a'];
    expect(appendSavedCommentOrder(order, ['a'], '')).toBe(order);
  });
});

describe('relativeCommentTimeTranslation', () => {
  const now = 1_000_000;
  it('reports "just now" under a minute', () => {
    expect(relativeCommentTimeTranslation(now - 1000, now)).toEqual({ key: 'Just now' });
  });
  it('reports minutes ago', () => {
    expect(relativeCommentTimeTranslation(now - 5 * 60_000, now)).toEqual({ key: '{n} minutes ago', vars: { n: 5 } });
  });
  it('reports hours ago', () => {
    expect(relativeCommentTimeTranslation(now - 3 * 3_600_000, now)).toEqual({ key: '{n} hours ago', vars: { n: 3 } });
  });
  it('reports days ago', () => {
    expect(relativeCommentTimeTranslation(now - 2 * 86_400_000, now)).toEqual({ key: '{n} days ago', vars: { n: 2 } });
  });
  it('reports weeks ago', () => {
    expect(relativeCommentTimeTranslation(now - 14 * 86_400_000, now)).toEqual({ key: '{n} weeks ago', vars: { n: 2 } });
  });
});

describe('visibleSelectedCommentIds', () => {
  it('only includes ids that are both selected and visible', () => {
    const result = visibleSelectedCommentIds(
      [{ id: 'a' }, { id: 'b' }],
      new Set(['a', 'zzz']),
    );
    expect(result).toEqual(new Set(['a']));
  });
});

describe('JSON-safe text formatting', () => {
  it('passes non-JSON text through unchanged', () => {
    expect(formatJsonTextForDisplay('hello', false)).toBe('hello');
  });
  it('pretty-prints safe JSON', () => {
    expect(formatJsonTextForDisplay('{"a":1}', true)).toBe('{\n  "a": 1\n}');
  });
  it('leaves invalid JSON untouched', () => {
    expect(formatJsonTextForDisplay('not json', true)).toBe('not json');
  });
  it('flags -0 as precision-sensitive', () => {
    expect(hasPrecisionSensitiveJsonNumberText('{"a": -0}')).toBe(true);
  });
  it('does not flag an ordinary integer', () => {
    expect(hasPrecisionSensitiveJsonNumberText('{"a": 42}')).toBe(false);
  });
  it('leaves text with a precision-sensitive number unchanged even when isJsonLike', () => {
    const text = '{"a": -0}';
    expect(formatJsonTextForDisplay(text, true)).toBe(text);
  });
  it('flags an unsafe integer beyond Number.isSafeInteger', () => {
    expect(hasUnsafeJsonNumber(Number.MAX_SAFE_INTEGER + 10)).toBe(true);
  });
  it('does not flag a safe integer', () => {
    expect(hasUnsafeJsonNumber(42)).toBe(false);
  });
  it('recurses into arrays and objects', () => {
    expect(hasUnsafeJsonNumber([{ a: Number.MAX_SAFE_INTEGER + 10 }])).toBe(true);
    expect(hasUnsafeJsonNumber([{ a: 1 }])).toBe(false);
  });
});

describe('scroll-ratio helpers', () => {
  it('computes 0 range with nothing to scroll', () => {
    expect(scrollRange({ scrollHeight: 100, clientHeight: 100 })).toBe(0);
  });
  it('computes a positive range', () => {
    expect(scrollRange({ scrollHeight: 300, clientHeight: 100 })).toBe(200);
  });
  it('computes ratio 0 when nothing to scroll', () => {
    expect(scrollRatio({ scrollHeight: 100, clientHeight: 100, scrollTop: 0 })).toBe(0);
  });
  it('computes a mid-range ratio', () => {
    expect(scrollRatio({ scrollHeight: 300, clientHeight: 100, scrollTop: 100 })).toBe(0.5);
  });
  it('inverts ratio back to scrollTop', () => {
    expect(scrollTopForRatio({ scrollHeight: 300, clientHeight: 100 }, 0.5)).toBe(100);
  });
  it('clamps an out-of-range ratio', () => {
    expect(scrollTopForRatio({ scrollHeight: 300, clientHeight: 100 }, 5)).toBe(200);
    expect(scrollTopForRatio({ scrollHeight: 300, clientHeight: 100 }, -5)).toBe(0);
  });
});

describe('computeSplitPaneScrollTarget', () => {
  it('falls back to ratio sync when block offsets are unavailable', () => {
    const target = computeSplitPaneScrollTarget({
      sourcePane: 'editor',
      source: { scrollTop: 50, scrollHeight: 200, clientHeight: 100 },
      target: { scrollHeight: 400, clientHeight: 100 },
      blockLineCount: 0,
      editorOffsets: null,
      previewOffsets: null,
    });
    // ratio = 50/100 = 0.5, target range = 300, so 150
    expect(target).toBe(150);
  });

  it('uses block-anchored interpolation when offsets are available', () => {
    const target = computeSplitPaneScrollTarget({
      sourcePane: 'editor',
      source: { scrollTop: 50, scrollHeight: 200, clientHeight: 100 },
      target: { scrollHeight: 200, clientHeight: 100 },
      blockLineCount: 2,
      editorOffsets: [0, 100],
      previewOffsets: [0, 100],
    });
    // Identical anchor sets -> mapped position equals source position.
    expect(target).toBe(50);
  });
});
