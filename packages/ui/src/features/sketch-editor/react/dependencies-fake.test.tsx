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
import { createFakeSketchEditorEngine } from './dependencies-fake.js';
import type { ExcalidrawImperativeAPI } from '../ports.js';

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
