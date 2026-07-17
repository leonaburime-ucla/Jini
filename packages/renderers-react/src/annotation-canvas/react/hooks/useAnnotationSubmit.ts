import { useCallback, useEffect, useRef, useState, type ClipboardEvent as ReactClipboardEvent } from 'react';
import { useT } from '@jini/ui';
import { annotationBounds, markKind } from '../../rules.js';
import { drawAnnotationTarget, drawNormalizedBox, drawStrokes, drawTextMarks } from '../../canvas-paint.js';
import { ANNOTATION_STROKE_WIDTH, ANNOTATION_SUBMIT_TIMEOUT_MS } from '../../constants.js';
import type { AnnotationCanvasPort } from '../../ports.js';
import type {
  AnnotationAction,
  AnnotationRect,
  AnnotationSnapshot,
  AnnotationStroke,
  AnnotationSubmitResult,
  AnnotationTarget,
  AnnotationTextMark,
  NormalizedRect,
} from '../../types.js';

export interface ImagePreview {
  file: File;
  url: string;
}

export interface CaptureWarning {
  action: AnnotationAction;
  message: string;
}

export interface AnnotationSubmitController {
  note: string;
  setNote: (note: string) => void;
  extraFiles: File[];
  imagePreviews: ImagePreview[];
  addExtraFiles: (files: FileList | File[] | null) => void;
  removeExtraFile: (index: number) => void;
  onNotePaste: (e: ReactClipboardEvent<HTMLInputElement>) => void;
  previewIndex: number | null;
  setPreviewIndex: (index: number | null) => void;
  captureWarning: CaptureWarning | null;
  submitAction: AnnotationAction;
  submitMenuOpen: boolean;
  toggleSubmitMenu: () => void;
  submitMenuRef: React.RefObject<HTMLDivElement | null>;
  pendingAction: AnnotationAction | null;
  sending: boolean;
  canSubmit: boolean;
  canSend: boolean;
  canAddToInput: boolean;
  /** Runs the currently-selected submit action (the split button's main half). */
  send: (action: AnnotationAction) => Promise<void>;
  /** Picks a different submit action from the dropdown, closes the menu, and runs it. */
  pickSubmitAction: (action: AnnotationAction) => void;
  /** Clears attachments (but deliberately not the note or capture warning)
   *  when the overlay deactivates — matches the original's own reset scope. */
  resetOnDeactivate: () => void;
}

export interface UseAnnotationSubmitParams {
  wrapRef: React.RefObject<HTMLDivElement | null>;
  port: AnnotationCanvasPort;
  target?: AnnotationTarget | null;
  captureViewport?: boolean;
  sendDisabled?: boolean;
  hasInk: boolean;
  hasBox: boolean;
  hasText: boolean;
  getSelectionBoxes: () => NormalizedRect[];
  getStrokes: () => AnnotationStroke[];
  getTextMarks: () => AnnotationTextMark[];
  boxBoundsRect: () => AnnotationRect | null;
  strokeBoundsRect: () => AnnotationRect | null;
  textBoundsRect: () => AnnotationRect | null;
  onCapturingChange: (capturing: boolean) => void;
  /** Clears drawing + text-mark state after a successful send. */
  onSentSuccessfully: () => void;
  onToolbarClick?: ((element: 'annotation_submit', submitAction: AnnotationAction) => void) | undefined;
  /**
   * `pendingAction`/`sending` are owned by the orchestrator (not this
   * hook) because `useAnnotationDrawing` — constructed first, since this
   * hook needs its outputs — also needs `sending` to gate pointer
   * handlers and undo/redo. Both hooks share the same state via these two.
   */
  pendingAction: AnnotationAction | null;
  setPendingAction: (action: AnnotationAction | null) => void;
}

function waitTwoAnimationFrames(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

function withTimeout<T>(promise: Promise<T>, ms: number, onTimeout: T): Promise<T> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(onTimeout);
    }, ms);
    promise.then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(onTimeout);
      },
    );
  });
}

/**
 * Owns the note/attachment inputs, the capture+composite+submit pipeline,
 * and the submit-action split button's dropdown state. The actual
 * screenshot/submission mechanism is entirely behind `port` — this hook
 * only orchestrates when to call it and how to render the composite from
 * whatever snapshot comes back.
 */
export function useAnnotationSubmit(params: UseAnnotationSubmitParams): AnnotationSubmitController {
  const {
    wrapRef,
    port,
    target = null,
    captureViewport = false,
    sendDisabled = false,
    hasInk,
    hasBox,
    hasText,
    getSelectionBoxes,
    getStrokes,
    getTextMarks,
    boxBoundsRect,
    strokeBoundsRect,
    textBoundsRect,
    onCapturingChange,
    onSentSuccessfully,
    onToolbarClick,
    pendingAction,
    setPendingAction,
  } = params;
  const t = useT();

  const [note, setNote] = useState('');
  const [extraFiles, setExtraFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<ImagePreview[]>([]);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [captureWarning, setCaptureWarning] = useState<CaptureWarning | null>(null);
  const [submitAction, setSubmitAction] = useState<AnnotationAction>('send');
  const [submitMenuOpen, setSubmitMenuOpen] = useState(false);
  const submitMenuRef = useRef<HTMLDivElement | null>(null);
  const sending = pendingAction !== null;

  const addExtraFiles = useCallback((files: FileList | File[] | null) => {
    if (!files) return;
    const imgs = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (imgs.length === 0) return;
    setExtraFiles((cur) => [...cur, ...imgs]);
  }, []);

  const removeExtraFile = useCallback((index: number) => {
    setExtraFiles((cur) => cur.filter((_, i) => i !== index));
    setPreviewIndex(null);
  }, []);

  const onNotePaste = useCallback(
    (e: ReactClipboardEvent<HTMLInputElement>) => {
      const files = e.clipboardData?.files;
      if (!files || files.length === 0) return;
      const imgs = Array.from(files).filter((f) => f.type.startsWith('image/'));
      if (imgs.length === 0) return;
      e.preventDefault();
      addExtraFiles(imgs);
    },
    [addExtraFiles],
  );

  // Keep object-URL thumbnails in sync with the attached files; revoke on
  // change/unmount so blob URLs never leak.
  useEffect(() => {
    const next = extraFiles.map((file) => ({ file, url: URL.createObjectURL(file) }));
    setImagePreviews(next);
    return () => {
      next.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, [extraFiles]);

  // Dismiss the staged-image preview on Escape (capture phase, so it runs
  // before the overlay's own Escape-to-deactivate handler).
  useEffect(() => {
    if (previewIndex === null) return undefined;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setPreviewIndex(null);
      }
    }
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [previewIndex]);

  // Dismiss the submit menu on outside pointer-down / Escape. Capture
  // phase + stopPropagation lets Escape close the menu without also
  // deactivating the whole overlay.
  useEffect(() => {
    if (!submitMenuOpen) return undefined;
    function onPointerDown(e: MouseEvent) {
      if (submitMenuRef.current && !submitMenuRef.current.contains(e.target as Node)) {
        setSubmitMenuOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setSubmitMenuOpen(false);
      }
    }
    window.addEventListener('mousedown', onPointerDown, true);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('mousedown', onPointerDown, true);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [submitMenuOpen]);

  const toggleSubmitMenu = useCallback(() => setSubmitMenuOpen((open) => !open), []);

  const requestSnapshotWithHiddenChrome = useCallback(async (): Promise<AnnotationSnapshot | null> => {
    onCapturingChange(true);
    try {
      await waitTwoAnimationFrames();
      return await port.requestSnapshot();
    } finally {
      onCapturingChange(false);
    }
  }, [port, onCapturingChange]);

  const compositeWithBackground = useCallback(
    async (snap: AnnotationSnapshot): Promise<Blob | null> => {
      const frameRect = port.getCaptureFrameRect?.() ?? wrapRef.current?.getBoundingClientRect() ?? null;
      if (!frameRect) return null;
      const out = document.createElement('canvas');
      out.width = snap.w;
      out.height = snap.h;
      const ctx = out.getContext('2d');
      if (!ctx) return null;
      const bg = await new Promise<HTMLImageElement | null>((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = snap.dataUrl;
      });
      if (!bg) return null;
      // Opaque base: even a transparent snapshot never flattens to black —
      // it degrades to a white frame with the marks on top.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, out.width, out.height);
      ctx.drawImage(bg, 0, 0, snap.w, snap.h);
      const sx = snap.w / Math.max(1, frameRect.width);
      const sy = snap.h / Math.max(1, frameRect.height);
      if (target) drawAnnotationTarget(ctx, sx, sy, target.position, target.label);
      for (const box of getSelectionBoxes()) drawNormalizedBox(ctx, box, snap.w, snap.h);
      drawStrokes(ctx, getStrokes(), snap.w, snap.h, ANNOTATION_STROKE_WIDTH * Math.max(sx, sy));
      drawTextMarks(ctx, getTextMarks(), snap.w, snap.h);
      return new Promise((resolve) => out.toBlob((b) => resolve(b), 'image/png'));
    },
    [port, wrapRef, target, getSelectionBoxes, getStrokes, getTextMarks],
  );

  const canSubmit = hasInk || hasBox || hasText || Boolean(target) || captureViewport || Boolean(note.trim()) || extraFiles.length > 0;
  const canAddToInput = canSubmit;
  const canSend = canSubmit && !sendDisabled;

  const send = useCallback(
    async (action: AnnotationAction) => {
      const hasTarget = Boolean(target);
      const shouldCapture = hasInk || hasBox || hasText || hasTarget || captureViewport;
      const canSubmitNow = shouldCapture || Boolean(note.trim()) || extraFiles.length > 0;
      if (sending || !canSubmitNow) return;
      if (action === 'send' && sendDisabled) return;
      onToolbarClick?.('annotation_submit', action);
      setCaptureWarning(null);
      setPendingAction(action);
      try {
        let file: File | null = null;
        if (shouldCapture) {
          let blob: Blob | null = null;
          const snap = await requestSnapshotWithHiddenChrome();
          if (snap) blob = await compositeWithBackground(snap);
          if (blob) {
            const ts = new Date().toISOString().replace(/[:.]/g, '-');
            file = new File([blob], `annotation-${ts}.png`, { type: 'image/png' });
          } else if (!note.trim() && extraFiles.length === 0) {
            // The snapshot pipeline is best-effort — a host's capture can
            // legitimately fail on real-world content, and retrying
            // replays the same failure. Only block when the annotation
            // has no meaning without pixels: ink/box-only marks are pure
            // bitmap. A typed note or attached images still carry the
            // user's intent, so those fall through and send without it.
            setCaptureWarning({
              action,
              message:
                captureViewport && !hasInk && !hasBox && !hasTarget
                  ? t('Nothing to capture — draw a mark or add a note before sending.')
                  : t('The screenshot failed — add a note or keep the ink to send anyway.'),
            });
            return;
          }
        }
        const sentWithoutScreenshot = shouldCapture && !file;
        const kind = markKind(hasTarget, hasInk || hasBox || hasText);
        const bounds = kind ? annotationBounds(boxBoundsRect(), strokeBoundsRect(), textBoundsRect(), target?.position ?? null) : undefined;
        const result = await withTimeout<AnnotationSubmitResult>(
          port.submitAnnotation({
            file,
            note: note.trim(),
            action,
            markKind: kind,
            bounds,
            target,
            extraFiles: extraFiles.length ? extraFiles : undefined,
          }),
          ANNOTATION_SUBMIT_TIMEOUT_MS,
          { ok: false, message: t('Sending timed out.') },
        );
        if (!result.ok) {
          setCaptureWarning({ action, message: result.message || t('Sending failed.') });
          return;
        }
        onSentSuccessfully();
        setCaptureWarning(
          sentWithoutScreenshot ? { action, message: t('Sent without a screenshot — only the note went out.') } : null,
        );
        setNote('');
        setExtraFiles([]);
        setPreviewIndex(null);
      } finally {
        setPendingAction(null);
      }
    },
    [
      target,
      hasInk,
      hasBox,
      hasText,
      captureViewport,
      note,
      extraFiles,
      sending,
      sendDisabled,
      onToolbarClick,
      requestSnapshotWithHiddenChrome,
      compositeWithBackground,
      boxBoundsRect,
      strokeBoundsRect,
      textBoundsRect,
      port,
      onSentSuccessfully,
      t,
      setPendingAction,
    ],
  );

  const pickSubmitAction = useCallback(
    (action: AnnotationAction) => {
      setSubmitAction(action);
      setSubmitMenuOpen(false);
      void send(action);
    },
    [send],
  );

  const resetOnDeactivate = useCallback(() => {
    setExtraFiles([]);
    setPreviewIndex(null);
  }, []);

  return {
    note,
    setNote,
    extraFiles,
    imagePreviews,
    addExtraFiles,
    removeExtraFile,
    onNotePaste,
    previewIndex,
    setPreviewIndex,
    captureWarning,
    submitAction,
    submitMenuOpen,
    toggleSubmitMenu,
    submitMenuRef,
    pendingAction,
    sending,
    canSubmit,
    canSend,
    canAddToInput,
    send,
    pickSubmitAction,
    resetOnDeactivate,
  };
}
