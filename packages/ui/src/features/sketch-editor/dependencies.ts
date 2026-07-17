/**
 * The only file allowed to import the real `@excalidraw/excalidraw`
 * package. Everything else in this feature depends on `SketchEditorEnginePort`
 * (see `ports.ts`), never on the concrete library. A React-based fake engine
 * for tests lives in `react/dependencies-fake.tsx` instead of here — unlike
 * a typical `dependencies.ts`, the thing being bound *is itself* a React
 * component (Excalidraw), so its fake unavoidably needs JSX too.
 */
import { Excalidraw, MainMenu, exportToBlob } from '@excalidraw/excalidraw';
import type { SketchEditorDependencies, SketchEditorEnginePort } from './ports.js';

export const realSketchEditorEngine: SketchEditorEnginePort = {
  Excalidraw,
  MainMenu: MainMenu as unknown as SketchEditorEnginePort['MainMenu'],
  exportToBlob: (opts) => exportToBlob(opts as never),
};

export const defaultSketchEditorDependencies: SketchEditorDependencies = {
  engine: realSketchEditorEngine,
};
