/**
 * The one real "swap point" this feature needs: the embedded Excalidraw
 * engine itself. Everything else (save/export/scene-change callbacks) is
 * already a plain React prop with no transport behind it, so it stays on
 * `SketchEditorProps` rather than being duplicated here. `dependencies.ts`
 * binds the real `@excalidraw/excalidraw` package to this port; a host's
 * tests (and this package's own) can bind a lightweight fake instead so
 * component tests don't have to mount real canvas-based Excalidraw.
 */
import type { ComponentType, ReactElement, ReactNode } from 'react';
import type {
  AppState,
  BinaryFiles,
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
  ExcalidrawProps,
} from '@excalidraw/excalidraw/types';
import type { OrderedExcalidrawElement } from '@excalidraw/excalidraw/element/types';

export type {
  AppState,
  BinaryFiles,
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
  ExcalidrawProps,
  OrderedExcalidrawElement,
};

export interface SketchMainMenuItemProps {
  onClick: () => void;
  disabled?: boolean;
  icon?: ReactNode;
  'aria-label'?: string;
  'data-testid'?: string;
  children?: ReactNode;
}

export interface SketchMainMenuComponent {
  (props: { children?: ReactNode }): ReactElement | null;
  Item: ComponentType<SketchMainMenuItemProps>;
  Separator: ComponentType<Record<string, never>>;
  DefaultItems: {
    SearchMenu: ComponentType<Record<string, never>>;
    Help: ComponentType<Record<string, never>>;
    ChangeCanvasBackground: ComponentType<Record<string, never>>;
  };
}

export interface SketchExportToBlobOptions {
  elements: readonly OrderedExcalidrawElement[];
  appState: Partial<AppState>;
  files: BinaryFiles;
  mimeType?: string;
  exportPadding?: number;
}

export interface SketchEditorEnginePort {
  /** The `<Excalidraw>` component itself. */
  Excalidraw: ComponentType<ExcalidrawProps>;
  /** Excalidraw's composable `<MainMenu>` + subcomponents. */
  MainMenu: SketchMainMenuComponent;
  /** Rasterizes the current scene to a `Blob`. */
  exportToBlob: (opts: SketchExportToBlobOptions) => Promise<Blob>;
}

export interface SketchEditorDependencies {
  engine: SketchEditorEnginePort;
}
