import type { CSSProperties, ReactNode } from 'react';

export interface AnnotationPoint { x: number; y: number }
export interface AnnotationStroke { points: AnnotationPoint[] }
export interface NormalizedRect { x: number; y: number; width: number; height: number }
export interface AnnotationTextLabel { id: number; x: number; y: number; text: string }

export type AnnotationTool = 'box' | 'pen' | 'text';
export type AnnotationSubmitAction = 'draft' | 'queue' | 'send';

export interface AnnotationCanvasValue {
  strokes: AnnotationStroke[];
  selectionBoxes: NormalizedRect[];
  textLabels: AnnotationTextLabel[];
  note: string;
}

export interface AnnotationCaptureRequest {
  value: AnnotationCanvasValue;
  frame: { width: number; height: number };
  canvas: HTMLCanvasElement | null;
}

export interface AnnotationSubmitRequest extends AnnotationCaptureRequest {
  action: AnnotationSubmitAction;
}

export interface AnnotationToolbarLabels {
  box?: string;
  pen?: string;
  text?: string;
  undo?: string;
  redo?: string;
  submit?: string;
  clear?: string;
  notePlaceholder?: string;
}

export interface AnnotationCanvasProps {
  children?: ReactNode;
  active?: boolean;
  initialTool?: AnnotationTool;
  labels?: AnnotationToolbarLabels;
  submitDisabled?: boolean;
  submitDisabledReason?: string;
  toolbarHost?: HTMLElement | null;
  onActiveChange?: (active: boolean) => void;
  onCapture?: (request: AnnotationCaptureRequest) => void | Promise<void>;
  onSubmit?: (request: AnnotationSubmitRequest) => void | Promise<void>;
  onToolbarPlacementChange?: (placement: ToolbarPlacement) => void;
}

export type ToolbarLayout = 'floating' | 'docked';
export type ToolbarSide = 'right' | 'left' | 'bottom' | 'top';
export interface ToolbarPlacement {
  layout: ToolbarLayout;
  side: ToolbarSide | null;
  style: CSSProperties;
}
