import { useLayoutEffect, useRef, useState } from 'react';
import { computeDockPlacement, dockPlacementEquals, DOCKED_PLACEMENT } from '../../rules.js';
import type { AnnotationDockPlacement, AnnotationRect } from '../../types.js';

export interface AnnotationDockPlacementController {
  dockRef: React.RefObject<HTMLDivElement | null>;
  placement: AnnotationDockPlacement;
  /** The resolved portal host (the `toolbarHost` prop, else
   *  `closest(toolbarHostSelector)`, else `null` — render inline). */
  resolvedToolbarHost: HTMLElement | null;
}

export interface UseAnnotationDockPlacementParams {
  active: boolean;
  wrapRef: React.RefObject<HTMLDivElement | null>;
  /** An explicit portal host element. When omitted, `toolbarHostSelector`
   *  (if given) is resolved via `wrapRef.current.closest(...)`; when
   *  neither is given the dock renders inline within the wrap element. */
  toolbarHost?: HTMLElement | null | undefined;
  toolbarHostSelector?: string | undefined;
  /** The current floating-toolbar anchor (the most relevant mark's
   *  bounds), in wrap-local pixels — recomputed by the caller from
   *  whichever of box/stroke/target bounds is most recent. */
  anchor: AnnotationRect | null;
  /** Extra values that should trigger a placement recompute even though
   *  they don't change the anchor's geometry (e.g. an attached-image strip
   *  or a capture-warning banner appearing changes the dock's own size). */
  extraDeps?: readonly unknown[];
}

/**
 * Resolves the floating-toolbar's portal host and runs the
 * collision-avoiding 4-side auto-flip placement engine (the pure geometry
 * lives in `rules.ts#computeDockPlacement`) whenever the wrap, dock, or
 * host resizes, or the anchor/extra deps change.
 */
export function useAnnotationDockPlacement(params: UseAnnotationDockPlacementParams): AnnotationDockPlacementController {
  const { active, wrapRef, toolbarHost, toolbarHostSelector, anchor, extraDeps = [] } = params;
  const dockRef = useRef<HTMLDivElement | null>(null);
  const [resolvedToolbarHost, setResolvedToolbarHost] = useState<HTMLElement | null>(null);
  const [placement, setPlacement] = useState<AnnotationDockPlacement>(DOCKED_PLACEMENT);
  const [resizeTick, setResizeTick] = useState(0);

  // In a scaled/clipped ancestor, the floating toolbar would otherwise be
  // cut off by the annotated surface's own bounds. Resolve in a layout
  // effect to avoid a clipped first paint.
  useLayoutEffect(() => {
    if (!active) {
      setResolvedToolbarHost(null);
      return;
    }
    const fallback = toolbarHostSelector ? (wrapRef.current?.closest(toolbarHostSelector) as HTMLElement | null) : null;
    setResolvedToolbarHost(toolbarHost ?? fallback ?? null);
  }, [active, toolbarHost, toolbarHostSelector, wrapRef]);

  useLayoutEffect(() => {
    if (!active) {
      setPlacement((current) => (dockPlacementEquals(current, DOCKED_PLACEMENT) ? current : DOCKED_PLACEMENT));
      return;
    }
    const wrap = wrapRef.current;
    const dock = dockRef.current;
    const host = resolvedToolbarHost ?? wrap;
    if (!wrap || !dock || !host || !anchor) {
      setPlacement((current) => (dockPlacementEquals(current, DOCKED_PLACEMENT) ? current : DOCKED_PLACEMENT));
      return;
    }
    const hostRect = host.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    const dockRect = dock.getBoundingClientRect();
    const next = computeDockPlacement({
      hostRect: { x: hostRect.left, y: hostRect.top, width: hostRect.width, height: hostRect.height },
      wrapRect: { x: wrapRect.left, y: wrapRect.top, width: wrapRect.width, height: wrapRect.height },
      dockRect: { width: dockRect.width, height: dockRect.height },
      anchor,
    });
    setPlacement((current) => (dockPlacementEquals(current, next) ? current : next));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, resolvedToolbarHost, anchor, resizeTick, ...extraDeps]);

  useLayoutEffect(() => {
    if (!active || typeof ResizeObserver === 'undefined') return undefined;
    const wrap = wrapRef.current;
    const dock = dockRef.current;
    const host = resolvedToolbarHost ?? wrap;
    if (!wrap || !dock || !host) return undefined;
    const recompute = () => setResizeTick((v) => v + 1);
    const ro = new ResizeObserver(recompute);
    ro.observe(wrap);
    ro.observe(dock);
    if (host !== wrap) ro.observe(host);
    return () => ro.disconnect();
  }, [active, resolvedToolbarHost, wrapRef]);

  return { dockRef, placement, resolvedToolbarHost };
}
