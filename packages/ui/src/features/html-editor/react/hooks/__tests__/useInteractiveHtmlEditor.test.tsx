import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * @file The export-safety half of the canvas-wrapper feature's proof: `useInteractiveHtmlEditor`
 * must never fold `canvasStyling.contentWrapper` into GrapesJS's `components` string, and must apply
 * it only via `applyCanvasContentWrapper` against the live canvas after `load`. `grapesjs` itself is
 * mocked — a real instance hangs under jsdom (no working iframe `load` event; confirmed by hand while
 * building this), which is also why no test in this package has ever mounted one — so this asserts
 * the WIRING (what gets passed to `grapesjs.init`, and what runs on `load`), while
 * `../../__tests__/canvas-content-wrapper.test.ts` separately proves the wrap function's own DOM
 * behavior against a real (non-GrapesJS) `<body>`.
 */

const RAW_HTML = '<p id="x">hello</p>';

function makeFakeEditor() {
  const handlers: Record<string, Array<() => void>> = {};
  const fakeBody = document.createElement('body');
  return {
    fakeBody,
    editor: {
      Components: { addType: vi.fn() },
      Canvas: { getBody: vi.fn(() => fakeBody) },
      on: vi.fn((event: string, cb: () => void) => {
        (handlers[event] ??= []).push(cb);
      }),
      off: vi.fn(),
      getCss: vi.fn(() => ''),
      getHtml: vi.fn(() => RAW_HTML),
      destroy: vi.fn(),
    },
    fire: (event: string) => handlers[event]?.forEach((cb) => cb()),
  };
}

let lastFake: ReturnType<typeof makeFakeEditor> | undefined;
let lastInitConfig: Record<string, unknown> | undefined;

vi.mock('grapesjs', () => ({
  default: {
    init: vi.fn((config: Record<string, unknown>) => {
      lastInitConfig = config;
      lastFake = makeFakeEditor();
      return lastFake.editor;
    }),
  },
}));

vi.mock('../../../canvas-content-wrapper.js', () => ({
  applyCanvasContentWrapper: vi.fn(),
}));

vi.mock('../../../canvas-embed-placeholders.js', () => ({
  applyCanvasEmbedPlaceholders: vi.fn(),
}));

const { useInteractiveHtmlEditor } = await import('../useInteractiveHtmlEditor.js');
const { applyCanvasContentWrapper } = await import('../../../canvas-content-wrapper.js');
const { applyCanvasEmbedPlaceholders } = await import('../../../canvas-embed-placeholders.js');

function TestHarness({
  canvasStyling,
  describeEmbedPlaceholder,
}: {
  canvasStyling?: Parameters<typeof useInteractiveHtmlEditor>[3];
  describeEmbedPlaceholder?: Parameters<typeof useInteractiveHtmlEditor>[4];
}) {
  const { containerRef } = useInteractiveHtmlEditor(RAW_HTML, () => {}, undefined, canvasStyling, describeEmbedPlaceholder);
  return <div ref={containerRef} />;
}

describe('useInteractiveHtmlEditor — canvas content wrapper wiring', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    lastFake = undefined;
    lastInitConfig = undefined;
  });

  it('passes the raw, unwrapped host HTML as components — the wrapper never becomes real components', () => {
    render(<TestHarness canvasStyling={{ contentWrapper: [{ tagName: 'article', attributes: { class: 'post-detail wrap' } }] }} />);
    expect(lastInitConfig?.components).toBe(RAW_HTML);
  });

  it('applies the content wrapper against the live canvas body once the editor fires load', () => {
    const contentWrapper = [{ tagName: 'main' }];
    render(<TestHarness canvasStyling={{ contentWrapper }} />);

    expect(applyCanvasContentWrapper).not.toHaveBeenCalled();
    lastFake!.fire('load');
    expect(applyCanvasContentWrapper).toHaveBeenCalledTimes(1);
    expect(applyCanvasContentWrapper).toHaveBeenCalledWith(lastFake!.fakeBody, contentWrapper);
  });

  it('still fires load->wrap wiring when canvasStyling omits contentWrapper (the pre-existing no-wrapper case)', () => {
    render(<TestHarness />);
    lastFake!.fire('load');
    expect(applyCanvasContentWrapper).toHaveBeenCalledTimes(1);
    expect(applyCanvasContentWrapper).toHaveBeenCalledWith(lastFake!.fakeBody, undefined);
  });

  it('detaches the load handler on unmount, same as the existing update handler', () => {
    const { unmount } = render(<TestHarness canvasStyling={{ contentWrapper: [{ tagName: 'main' }] }} />);
    unmount();
    expect(lastFake!.editor.off).toHaveBeenCalledWith('load', expect.any(Function));
  });
});

describe('useInteractiveHtmlEditor — embed placeholder wiring', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    lastFake = undefined;
    lastInitConfig = undefined;
  });

  it('does not decorate the canvas at all when no describeEmbedPlaceholder is supplied — the pre-existing, no-op default', () => {
    render(<TestHarness />);
    lastFake!.fire('load');
    expect(applyCanvasEmbedPlaceholders).not.toHaveBeenCalled();
  });

  it('applies embed placeholders against the live canvas body once the editor fires load, same event as the content wrapper', () => {
    const describeEmbedPlaceholder = vi.fn();
    render(<TestHarness describeEmbedPlaceholder={describeEmbedPlaceholder} />);

    expect(applyCanvasEmbedPlaceholders).not.toHaveBeenCalled();
    lastFake!.fire('load');

    expect(applyCanvasEmbedPlaceholders).toHaveBeenCalledTimes(1);
    expect(applyCanvasEmbedPlaceholders).toHaveBeenCalledWith(lastFake!.fakeBody, describeEmbedPlaceholder);
  });

  it('still passes RAW_HTML, unwrapped, as components — embed placeholders never fold into the parsed document either', () => {
    render(<TestHarness describeEmbedPlaceholder={vi.fn()} />);
    expect(lastInitConfig?.components).toBe(RAW_HTML);
  });

  it('detaches the SAME load handler on unmount that both the content wrapper and embed placeholders share', () => {
    const { unmount } = render(<TestHarness describeEmbedPlaceholder={vi.fn()} />);
    unmount();
    expect(lastFake!.editor.off).toHaveBeenCalledWith('load', expect.any(Function));
    // Exactly one 'load' registration/teardown pair — embed placeholders piggyback on the content
    // wrapper's existing handler rather than adding a second `editor.on('load', ...)` registration.
    const loadOnCalls = lastFake!.editor.on.mock.calls.filter((call) => call[0] === 'load');
    const loadOffCalls = lastFake!.editor.off.mock.calls.filter((call) => call[0] === 'load');
    expect(loadOnCalls).toHaveLength(1);
    expect(loadOffCalls).toHaveLength(1);
  });
});
