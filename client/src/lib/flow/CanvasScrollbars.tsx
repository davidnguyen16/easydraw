'use client';

import { useEffect, useRef } from 'react';
import { useReactFlow, useStore, type Edge, type Node, type Viewport } from '@xyflow/react';

/**
 * Draw.io-style bounded canvas panning + scrollbars (port of
 * CanvasScrollbars.svelte). A finite world-space domain (initial canvas ∪ all
 * content + a work margin) drives both React Flow's translateExtent and the two
 * scrollbar thumbs. Reads width/height/transform/panZoom from the flow store.
 */
interface Props {
  nodes: Node[];
  edges: Edge[];
  /** Screen-space overlays covering the canvas from either side. */
  leftInset?: number;
  rightInset?: number;
  onNavigationStart?: () => void;
}

const MIN_THUMB = 28;
const TRACK_INSET = 8 + 24;
const START_PADDING_PX = 160;
const END_PADDING_PX = 240;
const VIEWPORT_EPSILON = 0.25;
const MIN_USABLE_VIEWPORT_PX = 1;

interface WorldBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}
interface HorizontalViewportBounds {
  left: number;
  right: number;
  rightEdge: number;
  width: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const nonNegativeFinite = (value: number) => (Number.isFinite(value) ? Math.max(0, value) : 0);

function isFiniteBounds(b: WorldBounds) {
  return (
    Number.isFinite(b.minX) &&
    Number.isFinite(b.minY) &&
    Number.isFinite(b.maxX) &&
    Number.isFinite(b.maxY) &&
    b.maxX >= b.minX &&
    b.maxY >= b.minY
  );
}

// screen = world * zoom + offset, inverted to a constrained offset. If the
// domain is smaller than the visible span, centre it and lock that axis.
function constrainViewportOffset(
  offset: number,
  zoom: number,
  screenStartPx: number,
  viewportPx: number,
  domainMin: number,
  domainMax: number,
) {
  const visibleSpan = viewportPx / zoom;
  const domainSpan = domainMax - domainMin;
  const currentStart = (screenStartPx - offset) / zoom;
  const nextStart =
    domainSpan <= visibleSpan
      ? domainMin - (visibleSpan - domainSpan) / 2
      : clamp(currentStart, domainMin, domainMax - visibleSpan);
  return screenStartPx - nextStart * zoom;
}

interface BarModel {
  thumbPx: number;
  thumbOffset: number;
  trackPx: number;
  domainMin: number;
  maxScrollWorld: number;
}

function barModel(
  domainMin: number,
  domainMax: number,
  visibleMin: number,
  visibleMax: number,
  trackPx: number,
): BarModel | null {
  if (trackPx <= MIN_THUMB) return null;
  const domainSpan = domainMax - domainMin;
  const visibleSpan = visibleMax - visibleMin;
  const maxScrollWorld = domainSpan - visibleSpan;
  if (maxScrollWorld <= VIEWPORT_EPSILON || domainSpan <= 0 || visibleSpan <= 0) return null;

  const thumbPx = Math.min(trackPx, Math.max((visibleSpan / domainSpan) * trackPx, MIN_THUMB));
  const scrollFraction = clamp((visibleMin - domainMin) / maxScrollWorld, 0, 1);
  const thumbOffset = scrollFraction * (trackPx - thumbPx);
  return { thumbPx, thumbOffset, trackPx, domainMin, maxScrollWorld };
}

export default function CanvasScrollbars({ nodes, edges, leftInset = 0, rightInset = 0, onNavigationStart }: Props) {
  const flow = useReactFlow();
  const transform = useStore((s) => s.transform);
  const panZoom = useStore((s) => s.panZoom);
  const width = useStore((s) => s.width);
  const height = useStore((s) => s.height);

  const viewport: Viewport = { x: transform[0], y: transform[1], zoom: transform[2] };
  const zoom = Math.max(viewport.zoom, 0.01);

  // Overlays are absolutely positioned over the flow, so the usable strip is
  // narrower than the container. Preserve exact insets while they fit.
  const horizontalViewport: HorizontalViewportBounds = (() => {
    const canvasWidth = nonNegativeFinite(width);
    const requestedLeft = nonNegativeFinite(leftInset);
    const requestedRight = nonNegativeFinite(rightInset);
    const maxCombinedInset = Math.max(0, canvasWidth - MIN_USABLE_VIEWPORT_PX);
    const requestedCombinedInset = requestedLeft + requestedRight;
    const insetScale =
      requestedCombinedInset > maxCombinedInset && requestedCombinedInset > 0
        ? maxCombinedInset / requestedCombinedInset
        : 1;
    const left = requestedLeft * insetScale;
    const right = requestedRight * insetScale;
    return { left, right, rightEdge: canvasWidth - right, width: Math.max(0, canvasWidth - left - right) };
  })();

  // World bounds of all visible content (nodes via getNodesBounds + edge bends).
  const diagramBounds: WorldBounds | null = (() => {
    const visibleNodes = nodes.filter((n) => !n.hidden);
    let bounds: WorldBounds | null = null;
    if (visibleNodes.length > 0) {
      const nb = flow.getNodesBounds(visibleNodes);
      const candidate = { minX: nb.x, minY: nb.y, maxX: nb.x + nb.width, maxY: nb.y + nb.height };
      if (isFiniteBounds(candidate)) bounds = candidate;
    }
    for (const edge of edges) {
      if (edge.hidden) continue;
      const bendPoints = (edge.data as { bendPoints?: { x: number; y: number }[] } | undefined)?.bendPoints;
      for (const point of bendPoints ?? []) {
        if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
        if (!bounds) {
          bounds = { minX: point.x, minY: point.y, maxX: point.x, maxY: point.y };
          continue;
        }
        bounds.minX = Math.min(bounds.minX, point.x);
        bounds.minY = Math.min(bounds.minY, point.y);
        bounds.maxX = Math.max(bounds.maxX, point.x);
        bounds.maxY = Math.max(bounds.maxY, point.y);
      }
    }
    return bounds;
  })();

  const getScrollBounds = (targetZoom: number): WorldBounds => {
    const safeZoom = Math.max(targetZoom, 0.01);
    const startPadding = START_PADDING_PX / safeZoom;
    const endPadding = END_PADDING_PX / safeZoom;
    const homeWidth = horizontalViewport.width;
    const contentMinX = diagramBounds ? diagramBounds.minX - startPadding : 0;
    const contentMaxX = diagramBounds ? diagramBounds.maxX + endPadding : homeWidth;
    return {
      minX: Math.min(0, contentMinX),
      minY: Math.min(0, diagramBounds?.minY ?? 0) - startPadding,
      maxX: Math.max(homeWidth, contentMaxX),
      maxY: Math.max(height, diagramBounds?.maxY ?? 0) + endPadding,
    };
  };

  const scrollBounds = getScrollBounds(zoom);

  const visible = {
    minX: (horizontalViewport.left - viewport.x) / viewport.zoom,
    minY: -viewport.y / viewport.zoom,
    maxX: (horizontalViewport.rightEdge - viewport.x) / viewport.zoom,
    maxY: (-viewport.y + height) / viewport.zoom,
  };

  const getViewportWithinBounds = (current: Viewport, bounds: WorldBounds, horizontal: HorizontalViewportBounds): Viewport => ({
    x: constrainViewportOffset(current.x, current.zoom, horizontal.left, horizontal.width, bounds.minX, bounds.maxX),
    y: constrainViewportOffset(current.y, current.zoom, 0, height, bounds.minY, bounds.maxY),
    zoom: current.zoom,
  });

  const applyViewportIfChanged = (current: Viewport, next: Viewport) => {
    if (Math.abs(next.x - current.x) > VIEWPORT_EPSILON || Math.abs(next.y - current.y) > VIEWPORT_EPSILON) {
      void flow.setViewport(next);
    }
  };

  interface HNavSnapshot {
    bounds: WorldBounds;
    viewport: HorizontalViewportBounds;
    zoom: number;
  }
  const prevHNav = useRef<HNavSnapshot | null>(null);

  const horizontalGeometryChanged = (previous: HorizontalViewportBounds, next: HorizontalViewportBounds) =>
    Math.abs(previous.left - next.left) > VIEWPORT_EPSILON ||
    Math.abs(previous.right - next.right) > VIEWPORT_EPSILON ||
    Math.abs(previous.width - next.width) > VIEWPORT_EPSILON;

  // Preserve the user's horizontal scroll fraction when an overlay opens/resizes.
  const preserveHorizontalScrollPosition = (current: Viewport, bounds: WorldBounds, horizontal: HorizontalViewportBounds): Viewport => {
    const previous = prevHNav.current;
    if (!previous || !horizontalGeometryChanged(previous.viewport, horizontal)) return current;
    if (Math.abs(previous.zoom - current.zoom) > Number.EPSILON) return current;

    const oldVisibleSpan = previous.viewport.width / current.zoom;
    const newVisibleSpan = horizontal.width / current.zoom;
    const oldScrollableSpan = previous.bounds.maxX - previous.bounds.minX - oldVisibleSpan;
    const newScrollableSpan = bounds.maxX - bounds.minX - newVisibleSpan;
    const oldViewStart = (previous.viewport.left - current.x) / current.zoom;

    let nextViewStart: number;
    if (oldScrollableSpan > VIEWPORT_EPSILON && newScrollableSpan > VIEWPORT_EPSILON) {
      const scrollFraction = clamp((oldViewStart - previous.bounds.minX) / oldScrollableSpan, 0, 1);
      nextViewStart = bounds.minX + scrollFraction * newScrollableSpan;
    } else {
      const previousWorldCenter = oldViewStart + oldVisibleSpan / 2;
      nextViewStart = previousWorldCenter - newVisibleSpan / 2;
    }
    return { ...current, x: horizontal.left - nextViewStart * current.zoom };
  };

  // Keep translateExtent in sync with content/zoom/size, then re-clamp.
  useEffect(() => {
    if (!panZoom || width <= 0 || height <= 0) return;
    const bounds = scrollBounds;
    const current = { ...viewport };
    const extent: [[number, number], [number, number]] = [
      [bounds.minX - horizontalViewport.left / zoom, bounds.minY],
      [bounds.maxX + horizontalViewport.right / zoom, bounds.maxY],
    ];
    panZoom.setTranslateExtent(extent);

    const positionPreserved = preserveHorizontalScrollPosition(current, bounds, horizontalViewport);
    const next = getViewportWithinBounds(positionPreserved, bounds, horizontalViewport);
    prevHNav.current = { bounds: { ...bounds }, viewport: { ...horizontalViewport }, zoom: current.zoom };
    applyViewportIfChanged(current, next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panZoom, width, height, zoom, scrollBounds.minX, scrollBounds.minY, scrollBounds.maxX, scrollBounds.maxY, horizontalViewport.left, horizontalViewport.right, horizontalViewport.width]);

  // fitView / setViewport bypass translateExtent → clamp viewport changes too.
  useEffect(() => {
    if (!panZoom || width <= 0 || height <= 0) return;
    const current = { ...viewport };
    const next = getViewportWithinBounds(current, scrollBounds, horizontalViewport);
    applyViewportIfChanged(current, next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transform[0], transform[1], transform[2]]);

  const hBar = barModel(scrollBounds.minX, scrollBounds.maxX, visible.minX, visible.maxX, horizontalViewport.width - TRACK_INSET);
  const vBar = barModel(scrollBounds.minY, scrollBounds.maxY, visible.minY, visible.maxY, height - TRACK_INSET);

  const setAxisViewport = (axis: 'h' | 'v', viewStart: number, source: Viewport) => {
    void flow.setViewport({
      x: axis === 'h' ? horizontalViewport.left - viewStart * source.zoom : source.x,
      y: axis === 'v' ? -viewStart * source.zoom : source.y,
      zoom: source.zoom,
    });
  };

  const startDrag = (axis: 'h' | 'v', event: React.PointerEvent) => {
    const bar = axis === 'h' ? hBar : vBar;
    if (!bar) return;
    event.preventDefault();
    event.stopPropagation();
    onNavigationStart?.();

    const element = event.currentTarget as HTMLElement;
    element.setPointerCapture(event.pointerId);
    const pointerStart = axis === 'h' ? event.clientX : event.clientY;
    const thumbStart = bar.thumbOffset;
    const viewportStart = flow.getViewport();
    const thumbTravel = bar.trackPx - bar.thumbPx;
    let finished = false;

    const cleanup = () => {
      if (finished) return;
      finished = true;
      element.removeEventListener('pointermove', onMove);
      element.removeEventListener('pointerup', finish);
      element.removeEventListener('pointercancel', finish);
      element.removeEventListener('lostpointercapture', cleanup);
    };
    const finish = () => {
      if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
      cleanup();
    };
    const onMove = (moveEvent: PointerEvent) => {
      if (thumbTravel <= 0) return;
      const pointer = axis === 'h' ? moveEvent.clientX : moveEvent.clientY;
      const thumbOffset = clamp(thumbStart + pointer - pointerStart, 0, thumbTravel);
      const viewStart = bar.domainMin + (thumbOffset / thumbTravel) * bar.maxScrollWorld;
      setAxisViewport(axis, viewStart, viewportStart);
    };
    element.addEventListener('pointermove', onMove);
    element.addEventListener('pointerup', finish);
    element.addEventListener('pointercancel', finish);
    element.addEventListener('lostpointercapture', cleanup);
  };

  return (
    <>
      {hBar && (
        <div
          className="pointer-events-none absolute bottom-1 z-30 h-2"
          style={{ left: horizontalViewport.left + 8, right: horizontalViewport.right + 24 }}
        >
          <button
            type="button"
            aria-label="Scroll canvas horizontally"
            className="pointer-events-auto absolute top-0 h-full touch-none cursor-grab rounded-full border-none bg-ink/30 p-0 transition-colors duration-100 hover:bg-ink/50 active:cursor-grabbing"
            style={{ left: hBar.thumbOffset, width: hBar.thumbPx }}
            onPointerDown={(event) => startDrag('h', event)}
          />
        </div>
      )}

      {vBar && (
        <div className="pointer-events-none absolute top-2 bottom-6 z-30 w-2" style={{ right: horizontalViewport.right + 4 }}>
          <button
            type="button"
            aria-label="Scroll canvas vertically"
            className="pointer-events-auto absolute left-0 w-full touch-none cursor-grab rounded-full border-none bg-ink/30 p-0 transition-colors duration-100 hover:bg-ink/50 active:cursor-grabbing"
            style={{ top: vBar.thumbOffset, height: vBar.thumbPx }}
            onPointerDown={(event) => startDrag('v', event)}
          />
        </div>
      )}
    </>
  );
}
