import { describe, expect, it } from 'vitest';
import {
  buildInitialData,
  buildSketchTooltipLabels,
  defaultExcalidrawLangCode,
  emptySketchScene,
  exportedImageFileName,
  exportedImageResultFileName,
  isExcalidrawUnableToEmbedToast,
  isNonDeletedExcalidrawElement,
  normalizeTooltipLabel,
  orderContextMenuActions,
  resolveDefaultSketchToolColor,
  sanitizeExcalidrawAppState,
  sceneContentSignature,
  sceneFromExcalidraw,
  sketchSceneHasContent,
  translateDomTextValue,
  validateSketchEmbeddableUrl,
} from './rules.js';

describe('sanitizeExcalidrawAppState', () => {
  it('strips transient/session-only fields', () => {
    const sanitized = sanitizeExcalidrawAppState({
      viewBackgroundColor: '#fff',
      openDialog: { name: 'help' },
      collaborators: new Map(),
      selectionElement: {},
    });
    expect(sanitized).toEqual({ viewBackgroundColor: '#fff' });
  });

  it('handles null input', () => {
    expect(sanitizeExcalidrawAppState(null)).toEqual({});
  });
});

describe('emptySketchScene / sketchSceneHasContent', () => {
  it('an empty scene has no content', () => {
    expect(sketchSceneHasContent(emptySketchScene('a.png'))).toBe(false);
  });

  it('null/undefined scenes have no content', () => {
    expect(sketchSceneHasContent(null)).toBe(false);
    expect(sketchSceneHasContent(undefined)).toBe(false);
  });

  it('a scene with a non-deleted element has content', () => {
    expect(sketchSceneHasContent({ elements: [{ isDeleted: false }], appState: null, files: {} })).toBe(true);
  });

  it('a scene with only deleted elements has no content', () => {
    expect(sketchSceneHasContent({ elements: [{ isDeleted: true }], appState: null, files: {} })).toBe(false);
  });
});

describe('buildInitialData', () => {
  it('carries elements/files through and applies the default stroke color', () => {
    const scene = { elements: [{ id: '1' }], appState: { viewBackgroundColor: '#123456' }, files: { f1: {} } };
    const data = buildInitialData(scene, 'diagram.excalidraw', '#abcdef');
    expect(data.elements).toEqual(scene.elements);
    expect(data.files).toEqual(scene.files);
    expect(data.appState.name).toBe('diagram.excalidraw');
    expect(data.appState.currentItemStrokeColor).toBe('#abcdef');
    expect(data.appState.viewBackgroundColor).toBe('#123456');
    expect(data.scrollToContent).toBe(true);
  });

  it('defaults viewBackgroundColor to white and scrollToContent to false for an empty scene', () => {
    const data = buildInitialData(emptySketchScene(), 'empty', '#000');
    expect(data.appState.viewBackgroundColor).toBe('#ffffff');
    expect(data.scrollToContent).toBe(false);
  });
});

describe('sceneFromExcalidraw', () => {
  it('deep-clones and sanitizes the scene', () => {
    const elements = [{ id: '1', isDeleted: false }];
    const appState = { viewBackgroundColor: '#fff', openDialog: { name: 'x' } };
    const files = { f1: { mimeType: 'image/png' } };
    const scene = sceneFromExcalidraw(elements, appState, files);
    expect(scene.elements).toEqual(elements);
    expect(scene.elements).not.toBe(elements);
    expect(scene.appState).toEqual({ viewBackgroundColor: '#fff' });
    expect(scene.files).toEqual(files);
  });
});

describe('isNonDeletedExcalidrawElement', () => {
  it('rejects deleted elements and non-objects', () => {
    expect(isNonDeletedExcalidrawElement({ isDeleted: true })).toBe(false);
    expect(isNonDeletedExcalidrawElement(null)).toBe(false);
    expect(isNonDeletedExcalidrawElement('x')).toBe(false);
  });

  it('accepts a non-deleted element', () => {
    expect(isNonDeletedExcalidrawElement({ isDeleted: false })).toBe(true);
    expect(isNonDeletedExcalidrawElement({})).toBe(true);
  });
});

describe('sceneContentSignature', () => {
  it('is stable across identical content', () => {
    const elements = [{ id: '1', version: 1, versionNonce: 1, isDeleted: false }];
    const appState = { viewBackgroundColor: '#fff' };
    const files = {};
    expect(sceneContentSignature(elements, appState, files)).toBe(sceneContentSignature(elements, appState, files));
  });

  it('changes when an element version changes', () => {
    const appState = { viewBackgroundColor: '#fff' };
    const a = sceneContentSignature([{ id: '1', version: 1, versionNonce: 1, isDeleted: false }], appState, {});
    const b = sceneContentSignature([{ id: '1', version: 2, versionNonce: 1, isDeleted: false }], appState, {});
    expect(a).not.toBe(b);
  });

  it('changes when the background color changes', () => {
    const elements = [{ id: '1', version: 1, versionNonce: 1, isDeleted: false }];
    const a = sceneContentSignature(elements, { viewBackgroundColor: '#fff' }, {});
    const b = sceneContentSignature(elements, { viewBackgroundColor: '#000' }, {});
    expect(a).not.toBe(b);
  });

  it('is order-independent for file signatures (sorted by id)', () => {
    const elements: unknown[] = [];
    const a = sceneContentSignature(elements, {}, { b: { mimeType: 'image/png' }, a: { mimeType: 'image/jpeg' } });
    const b = sceneContentSignature(elements, {}, { a: { mimeType: 'image/jpeg' }, b: { mimeType: 'image/png' } });
    expect(a).toBe(b);
  });
});

describe('exportedImageFileName', () => {
  it('strips the last extension by default, dropping any directory prefix', () => {
    expect(exportedImageFileName('diagram.excalidraw')).toBe('diagram.png');
    expect(exportedImageFileName('nested/path/diagram.sketch.json')).toBe('diagram.sketch.png');
  });

  it('strips a caller-supplied multi-part extension', () => {
    expect(exportedImageFileName('diagram.sketch.json', '.sketch.json')).toBe('diagram.png');
  });

  it('falls back to "sketch" for an empty stem', () => {
    expect(exportedImageFileName('.excalidraw')).toBe('sketch.png');
  });
});

describe('exportedImageResultFileName', () => {
  it('uses the result file name when provided', () => {
    expect(exportedImageResultFileName({ fileName: 'custom.png' }, 'fallback.png')).toBe('custom.png');
  });

  it('falls back for boolean/void results', () => {
    expect(exportedImageResultFileName(true, 'fallback.png')).toBe('fallback.png');
    expect(exportedImageResultFileName(undefined, 'fallback.png')).toBe('fallback.png');
  });
});

describe('resolveDefaultSketchToolColor / defaultExcalidrawLangCode', () => {
  it('resolves an explicit theme first', () => {
    expect(resolveDefaultSketchToolColor('dark', false)).toBe('#ffffff');
    expect(resolveDefaultSketchToolColor('light', true)).toBe('#1c1b1a');
  });

  it('falls back to prefers-color-scheme when theme is unset', () => {
    expect(resolveDefaultSketchToolColor(null, true)).toBe('#ffffff');
    expect(resolveDefaultSketchToolColor(null, false)).toBe('#1c1b1a');
  });

  it('maps a known locale to its Excalidraw langCode', () => {
    expect(defaultExcalidrawLangCode('zh-CN')).toBe('zh-CN');
    expect(defaultExcalidrawLangCode('fr')).toBe('fr-FR');
  });

  it('falls back to "en" for an unknown locale', () => {
    expect(defaultExcalidrawLangCode('xx-unknown')).toBe('en');
  });

  it('accepts a host-supplied override map', () => {
    expect(defaultExcalidrawLangCode('en', { en: 'en-CUSTOM' })).toBe('en-CUSTOM');
  });
});

describe('normalizeTooltipLabel', () => {
  it('collapses whitespace and trims', () => {
    expect(normalizeTooltipLabel('  Main   menu  ')).toBe('Main menu');
  });

  it('returns null for empty/whitespace-only/nullish input', () => {
    expect(normalizeTooltipLabel('   ')).toBeNull();
    expect(normalizeTooltipLabel(null)).toBeNull();
    expect(normalizeTooltipLabel(undefined)).toBeNull();
  });
});

describe('buildSketchTooltipLabels', () => {
  it('routes every label through t()', () => {
    const labels = buildSketchTooltipLabels((key) => `[${key}]`);
    expect(labels.mainMenu).toBe('[Main menu]');
    expect(labels.rectangle).toBe('[Rectangle]');
    expect(labels.moreTools).toBe('[More tools]');
  });
});

describe('translateDomTextValue', () => {
  const overrides = { Close: 'Fermer', 'Edit link': 'Modifier le lien' };

  it('translates an exact match, preserving surrounding whitespace', () => {
    expect(translateDomTextValue('  Close  ', overrides)).toBe('  Fermer  ');
  });

  it('translates a prefix match with " — "/" - "/": " separators', () => {
    expect(translateDomTextValue('Edit link — object', overrides)).toBe('Modifier le lien — object');
    expect(translateDomTextValue('Edit link - object', overrides)).toBe('Modifier le lien - object');
    expect(translateDomTextValue('Edit link: object', overrides)).toBe('Modifier le lien: object');
  });

  it('returns null when nothing matches', () => {
    expect(translateDomTextValue('Something else', overrides)).toBeNull();
  });

  it('returns null for whitespace-only input', () => {
    expect(translateDomTextValue('   ', overrides)).toBeNull();
  });
});

describe('orderContextMenuActions', () => {
  it('filters to the allow-list and reorders to match it', () => {
    expect(orderContextMenuActions(['copyAsSvg', 'delete', 'copy'], ['copy', 'paste', 'copyAsPng', 'copyAsSvg'])).toEqual([
      'copy',
      'copyAsSvg',
    ]);
  });

  it('returns an empty array when nothing is present', () => {
    expect(orderContextMenuActions(['delete'], ['copy', 'paste'])).toEqual([]);
  });
});

describe('validateSketchEmbeddableUrl', () => {
  it('accepts http(s) URLs', () => {
    expect(validateSketchEmbeddableUrl('https://example.com')).toBe(true);
    expect(validateSketchEmbeddableUrl('http://example.com')).toBe(true);
  });

  it('rejects non-http(s) protocols, empty, and malformed input', () => {
    expect(validateSketchEmbeddableUrl('javascript:alert(1)')).toBe(false);
    expect(validateSketchEmbeddableUrl('')).toBe(false);
    expect(validateSketchEmbeddableUrl('   ')).toBe(false);
    expect(validateSketchEmbeddableUrl('not a url')).toBe(false);
  });
});

describe('isExcalidrawUnableToEmbedToast', () => {
  it('recognizes the English "not allowed" phrasing', () => {
    expect(isExcalidrawUnableToEmbedToast('Embedding this URL is currently not allowed')).toBe(true);
  });

  it('recognizes a GitHub-issue-whitelist mention', () => {
    expect(isExcalidrawUnableToEmbedToast('Please open a GitHub issue to get this domain whitelisted')).toBe(true);
  });

  it('recognizes a host-supplied additional phrase', () => {
    expect(isExcalidrawUnableToEmbedToast('目前不允许嵌入此网址', ['目前不允许嵌入此网址'])).toBe(true);
  });

  it('rejects an unrelated message', () => {
    expect(isExcalidrawUnableToEmbedToast('Saved successfully')).toBe(false);
  });
});
