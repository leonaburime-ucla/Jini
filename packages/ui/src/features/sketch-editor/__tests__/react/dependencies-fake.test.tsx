/**
 * Every other test in this feature mounts the fake engine via `SketchEditor`,
 * which always supplies a full `initialData`/`renderTopRightUI` — so this
 * fake's own defensive defaults (for a host that mounts it more minimally,
 * per its own doc comment "available to a host's tests too") were never
 * actually exercised. This file drives `createFakeSketchEditorEngine`
 * directly with the bare-minimum props real Excalidraw itself accepts as
 * optional.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createFakeSketchEditorEngine } from '../../react/dependencies-fake.js';
import type { ExcalidrawImperativeAPI } from '../../ports.js';

describe('createFakeSketchEditorEngine (minimal usage)', () => {
  it('renders without initialData or renderTopRightUI, defaulting elements/appState/files', () => {
    const engine = createFakeSketchEditorEngine();
    const { Excalidraw } = engine;
    expect(() => render(<Excalidraw />)).not.toThrow();
    expect(screen.getByTestId('fake-excalidraw')).toBeTruthy();
  });

  it('still exposes a working imperative API without initialData', () => {
    const engine = createFakeSketchEditorEngine();
    const { Excalidraw } = engine;
    let api: ExcalidrawImperativeAPI | undefined;
    render(<Excalidraw excalidrawAPI={(a) => (api = a as unknown as ExcalidrawImperativeAPI)} />);
    expect(api?.getSceneElementsIncludingDeleted()).toEqual([]);
    expect(api?.getAppState()).toEqual({});
  });
});

import { createFakeSketchEditorDependencies } from '../../react/dependencies-fake.js';
import { SketchEditor } from '../../react/components/SketchEditor.js';

describe('SketchEditor with useSketchTheme hook override (4-pattern suite)', () => {
  it('Pattern 1 — State 1: Light theme rendering state via useSketchTheme override', () => {
    const customThemeHook = () => 'light' as const;

    render(
      <SketchEditor
        scene={{ elements: [], appState: {}, files: {} }}
        fileName="test.sketch"
        onSceneChange={() => {}}
        onSave={() => {}}
        dependencies={createFakeSketchEditorDependencies()}
        useSketchTheme={customThemeHook}
      />,
    );

    // `FakeExcalidraw` didn't use to destructure/render `theme` at all, so
    // this and the "dark theme" assertion below were structurally incapable
    // of distinguishing the two states — both would pass identically
    // regardless of what `useSketchTheme` returned. It now mirrors `theme`
    // onto `data-theme` specifically so tests have something real to check.
    expect(screen.getByTestId('fake-excalidraw')).toHaveAttribute('data-theme', 'light');
  });

  it('Pattern 2 — State 2: Dark theme rendering state via useSketchTheme override', () => {
    const customThemeHook = () => 'dark' as const;

    render(
      <SketchEditor
        scene={{ elements: [], appState: {}, files: {} }}
        fileName="test.sketch"
        onSceneChange={() => {}}
        onSave={() => {}}
        dependencies={createFakeSketchEditorDependencies()}
        useSketchTheme={customThemeHook}
      />,
    );

    expect(screen.getByTestId('fake-excalidraw')).toHaveAttribute('data-theme', 'dark');
  });
});
