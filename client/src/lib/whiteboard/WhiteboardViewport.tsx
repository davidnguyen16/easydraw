'use client';

import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { Check, Copy, CopyPlus, Crop, Scissors, Trash2 } from 'lucide-react';
import { fontOf } from './engine/engine';
import type { Point } from './engine/types';
import { useWhiteboard } from './whiteboard.store';

/** Space around the board so its edges stay reachable at any zoom. */
const GUTTER = 32;
const GRID_MIN_ZOOM = 4;

/**
 * The scrollable view of the board. Scrolling is native: a spacer sized to
 * the zoomed board gives the container its scroll extent, while a display
 * canvas the size of the visible area sits in a zero-size sticky anchor at
 * the top-left and is redrawn from the engine's canvases each frame. The
 * board never becomes a giant DOM element at 800%, and every overlay (ants,
 * grid, text box) is drawn in screen space so it stays one pixel crisp.
 */
export default function WhiteboardViewport() {
  const engine = useWhiteboard((s) => s.engine);
  const zoom = useWhiteboard((s) => s.zoom);
  const showGrid = useWhiteboard((s) => s.showGrid);
  const size = useWhiteboard((s) => s.size);
  const hasSelection = useWhiteboard((s) => s.hasSelection);
  const textEditing = useWhiteboard((s) => s.textEditing);
  const options = useWhiteboard((s) => s.options);
  const setPointer = useWhiteboard((s) => s.setPointer);
  const setViewOrigin = useWhiteboard((s) => s.setViewOrigin);

  const containerRef = useRef<HTMLDivElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const selectionBarRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const frame = useRef<number | null>(null);
  const drag = useRef<{ kind: 'tool' | 'pan'; scroll: Point; client: Point } | null>(null);
  const zoomAnchor = useRef<{ image: Point; client: Point } | null>(null);
  const antsPhase = useRef(0);

  /** Where the board's top-left sits in the container's scroll content. */
  const origin = useCallback((): Point => {
    const spacer = spacerRef.current;
    return spacer ? { x: spacer.offsetLeft, y: spacer.offsetTop } : { x: 0, y: 0 };
  }, []);

  const toImage = useCallback(
    (clientX: number, clientY: number): Point => {
      const container = containerRef.current;
      if (!container) return { x: 0, y: 0 };
      const rect = container.getBoundingClientRect();
      const o = origin();
      return {
        x: (clientX - rect.left + container.scrollLeft - o.x) / zoom,
        y: (clientY - rect.top + container.scrollTop - o.y) / zoom,
      };
    },
    [origin, zoom],
  );

  /** Image point → position relative to the container's visible box. */
  const toScreen = useCallback(
    (p: Point): Point => {
      const container = containerRef.current;
      const o = origin();
      return { x: o.x - (container?.scrollLeft ?? 0) + p.x * zoom, y: o.y - (container?.scrollTop ?? 0) + p.y * zoom };
    },
    [origin, zoom],
  );

  const draw = useCallback(() => {
    frame.current = null;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !engine) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const offset = toScreen({ x: 0, y: 0 });
    setViewOrigin({ x: Math.max(0, Math.round(-offset.x / zoom)), y: Math.max(0, Math.round(-offset.y / zoom)) });
    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(zoom, zoom);
    ctx.imageSmoothingEnabled = zoom < 1;
    ctx.shadowColor = 'rgba(44,44,42,0.18)';
    ctx.shadowBlur = 12 / zoom;
    ctx.shadowOffsetY = 2 / zoom;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, engine.width, engine.height);
    ctx.shadowColor = 'transparent';
    ctx.drawImage(engine.doc, 0, 0);
    ctx.drawImage(engine.preview, 0, 0);
    const selection = engine.selection;
    if (selection) ctx.drawImage(selection.canvas, selection.x, selection.y);
    ctx.restore();

    if (showGrid && zoom >= GRID_MIN_ZOOM) {
      ctx.save();
      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const top = Math.max(0, offset.y);
      const bottom = Math.min(height, offset.y + engine.height * zoom);
      const left = Math.max(0, offset.x);
      const right = Math.min(width, offset.x + engine.width * zoom);
      for (let x = 0; x <= engine.width; x += 1) {
        const sx = Math.round(offset.x + x * zoom) + 0.5;
        if (sx < 0 || sx > width) continue;
        ctx.moveTo(sx, top);
        ctx.lineTo(sx, bottom);
      }
      for (let y = 0; y <= engine.height; y += 1) {
        const sy = Math.round(offset.y + y * zoom) + 0.5;
        if (sy < 0 || sy > height) continue;
        ctx.moveTo(left, sy);
        ctx.lineTo(right, sy);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Marching ants: white and maroon dashes offset by half a period.
    const ants = (path: () => void) => {
      ctx.save();
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 4]);
      ctx.lineDashOffset = -antsPhase.current;
      ctx.strokeStyle = '#ffffff';
      path();
      ctx.stroke();
      ctx.lineDashOffset = -antsPhase.current + 5;
      ctx.strokeStyle = '#a6192e';
      path();
      ctx.stroke();
      ctx.restore();
    };
    const marquee = engine.marquee;
    if (marquee && marquee.width > 0 && marquee.height > 0) {
      const a = toScreen(marquee);
      ants(() => {
        ctx.beginPath();
        ctx.rect(Math.round(a.x) + 0.5, Math.round(a.y) + 0.5, Math.round(marquee.width * zoom), Math.round(marquee.height * zoom));
      });
    }
    const lasso = engine.lasso;
    if (lasso && lasso.length > 1) {
      ants(() => {
        ctx.beginPath();
        lasso.forEach((p, i) => {
          const s = toScreen(p);
          if (i === 0) ctx.moveTo(s.x, s.y);
          else ctx.lineTo(s.x, s.y);
        });
      });
    }
    if (selection) {
      const a = toScreen(selection);
      ants(() => {
        ctx.beginPath();
        if (selection.outline) {
          selection.outline.forEach((p, i) => {
            const s = toScreen({ x: p.x + selection.x, y: p.y + selection.y });
            if (i === 0) ctx.moveTo(s.x, s.y);
            else ctx.lineTo(s.x, s.y);
          });
          ctx.closePath();
        } else {
          ctx.rect(Math.round(a.x) + 0.5, Math.round(a.y) + 0.5, Math.round(selection.width * zoom), Math.round(selection.height * zoom));
        }
      });
      const bar = selectionBarRef.current;
      if (bar) {
        const above = a.y - bar.offsetHeight - 8;
        const y = above < 8 ? a.y + selection.height * zoom + 8 : above;
        const x = Math.min(Math.max(8, a.x), Math.max(8, width - bar.offsetWidth - 8));
        bar.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
      }
    }
    const textBox = engine.textBox;
    const textArea = textAreaRef.current;
    if (textBox && textArea) {
      const a = toScreen(textBox.rect);
      textArea.style.left = `${a.x}px`;
      textArea.style.top = `${a.y}px`;
      textArea.style.width = `${textBox.rect.width * zoom}px`;
      textArea.style.height = `${textBox.rect.height * zoom}px`;
    }
  }, [engine, setViewOrigin, showGrid, toScreen, zoom]);

  const requestDraw = useCallback(() => {
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(draw);
  }, [draw]);

  // The engine asks for a repaint after every change; so do resize and layout.
  useEffect(() => {
    if (!engine) return;
    engine.setRenderer(requestDraw);
    requestDraw();
    const container = containerRef.current;
    const observer = new ResizeObserver(requestDraw);
    if (container) observer.observe(container);
    return () => {
      engine.setRenderer(null);
      observer.disconnect();
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
    };
  }, [engine, requestDraw]);

  useEffect(() => {
    requestDraw();
  }, [requestDraw, size, zoom, showGrid, hasSelection, textEditing]);

  // Ctrl+wheel zooms around the pointer. React registers wheel listeners as
  // passive, so the browser's own zoom can only be stopped from a native one.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const store = useWhiteboard.getState();
      const before = store.zoom;
      zoomAnchor.current = { image: toImage(e.clientX, e.clientY), client: { x: e.clientX, y: e.clientY } };
      if (e.deltaY < 0) store.zoomIn();
      else store.zoomOut();
      if (useWhiteboard.getState().zoom === before) zoomAnchor.current = null;
    };
    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, [toImage]);

  // After a zoom, keep the image point that was under the pointer in place.
  useEffect(() => {
    const anchor = zoomAnchor.current;
    const container = containerRef.current;
    if (!anchor || !container) return;
    zoomAnchor.current = null;
    const rect = container.getBoundingClientRect();
    const o = origin();
    container.scrollLeft = o.x + anchor.image.x * zoom - (anchor.client.x - rect.left);
    container.scrollTop = o.y + anchor.image.y * zoom - (anchor.client.y - rect.top);
    requestDraw();
  }, [zoom, origin, requestDraw]);

  // Marching ants only animate while there is something to march around.
  useEffect(() => {
    if (!hasSelection) return;
    const timer = setInterval(() => {
      antsPhase.current = (antsPhase.current + 1) % 9;
      requestDraw();
    }, 90);
    return () => clearInterval(timer);
  }, [hasSelection, requestDraw]);

  useEffect(() => {
    if (textEditing) textAreaRef.current?.focus();
  }, [textEditing]);

  const modifiers = (e: ReactPointerEvent) => ({ secondary: e.button === 2 || (e.buttons & 2) === 2, shift: e.shiftKey, alt: e.altKey });

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const container = containerRef.current;
    if (!engine || !container) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.focus();
    const client = { x: e.clientX, y: e.clientY };
    if (e.button === 1 || engine.tool === 'pan') {
      drag.current = { kind: 'pan', scroll: { x: container.scrollLeft, y: container.scrollTop }, client };
      e.currentTarget.style.cursor = 'grabbing';
      return;
    }
    if (e.button !== 0 && e.button !== 2) return;
    drag.current = { kind: 'tool', scroll: { x: 0, y: 0 }, client };
    engine.pointerDown(toImage(e.clientX, e.clientY), modifiers(e));
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const container = containerRef.current;
    if (!engine || !container) return;
    const p = toImage(e.clientX, e.clientY);
    const inside = p.x >= 0 && p.y >= 0 && p.x < engine.width && p.y < engine.height;
    setPointer(inside ? { x: Math.floor(p.x), y: Math.floor(p.y) } : null);
    const d = drag.current;
    if (d?.kind === 'pan') {
      container.scrollLeft = d.scroll.x - (e.clientX - d.client.x);
      container.scrollTop = d.scroll.y - (e.clientY - d.client.y);
      requestDraw();
      return;
    }
    if (d?.kind === 'tool') {
      engine.pointerMove(p, modifiers(e));
      return;
    }
    engine.pointerHover(p);
    const overSelection = (engine.tool === 'selection' || engine.tool === 'freeform-selection') && engine.selectionContains(p);
    e.currentTarget.style.cursor = overSelection ? 'move' : engine.cursor;
  };

  const endDrag = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const d = drag.current;
    if (!d || !engine) return;
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (d.kind === 'pan') {
      e.currentTarget.style.cursor = engine.cursor;
      return;
    }
    engine.pointerUp(toImage(e.clientX, e.clientY), modifiers(e));
  };

  const cancelDrag = () => {
    const pending = drag.current;
    if (!pending) return;
    drag.current = null;
    if (pending.kind === 'tool') engine?.pointerCancel();
    if (canvasRef.current) canvasRef.current.style.cursor = engine?.cursor ?? 'default';
  };

  useEffect(() => {
    const interrupt = () => {
      drag.current = null;
      engine?.pointerCancel();
      if (canvasRef.current) canvasRef.current.style.cursor = engine?.cursor ?? 'default';
    };
    window.addEventListener('blur', interrupt);
    return () => { window.removeEventListener('blur', interrupt); };
  }, [engine]);

  const text = options.text;

  return (
    <div
      ref={containerRef}
      className="relative min-h-0 flex-1 overflow-auto bg-panel"
      onContextMenu={(e) => e.preventDefault()}
      onScroll={requestDraw}
    >
      {/* Zero-size sticky anchor: everything inside stays at the visible top-left. */}
      <div className="sticky top-0 left-0 z-10 h-0 w-0 overflow-visible">
        <canvas
          ref={canvasRef}
          tabIndex={-1}
          className="absolute top-0 left-0 block touch-none outline-none"
          style={{ cursor: engine?.cursor ?? 'default' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={cancelDrag}
          onLostPointerCapture={cancelDrag}
          onPointerLeave={() => setPointer(null)}
          onDoubleClick={() => engine?.finish()}
          aria-label="Whiteboard canvas"
        />
        {hasSelection && (
          <div
            ref={selectionBarRef}
            role="toolbar"
            aria-label="Selection"
            className="absolute top-0 left-0 z-20 flex items-center gap-0.5 rounded-lg border border-line bg-white p-1 shadow-md"
          >
            <SelectionButton label="Done (Esc)" onClick={() => engine?.commitSelection()}><Check size={16} /></SelectionButton>
            <SelectionButton label="Erase (Del)" onClick={() => engine?.deleteSelection()}><Trash2 size={16} /></SelectionButton>
            <SelectionButton label="Cut (Ctrl+X)" onClick={() => engine?.cut()}><Scissors size={16} /></SelectionButton>
            <SelectionButton label="Copy (Ctrl+C)" onClick={() => engine?.copy()}><Copy size={16} /></SelectionButton>
            <SelectionButton label="Duplicate (Ctrl+D)" onClick={() => engine?.duplicate()}><CopyPlus size={16} /></SelectionButton>
            <SelectionButton label="Crop to selection" onClick={() => engine?.crop()}><Crop size={16} /></SelectionButton>
          </div>
        )}
        {textEditing && (
          <textarea
            ref={textAreaRef}
            aria-label="Text"
            spellCheck={false}
            className="absolute z-20 resize-none overflow-hidden border border-dashed border-mq-red outline-none"
            style={{
              font: fontOf({ ...text, fontSize: text.fontSize * zoom }),
              lineHeight: 1.25,
              color: options.lineColor,
              backgroundColor: text.opaque ? options.fillColor : 'transparent',
              textDecoration: [text.underline ? 'underline' : '', text.strike ? 'line-through' : ''].join(' ').trim() || 'none',
              padding: 4 * zoom,
            }}
            onChange={(e) => engine?.updateText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                engine?.commitText();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                engine?.cancel();
              }
              e.stopPropagation();
            }}
          />
        )}
      </div>
      {/* Scroll extent: the zoomed board plus a gutter, centred when it fits. */}
      <div className="flex min-h-full min-w-full" style={{ padding: GUTTER, pointerEvents: 'none' }}>
        {/* Auto margins centre the board when it fits and never clip its start when it overflows. */}
        <div ref={spacerRef} data-board style={{ width: size.width * zoom, height: size.height * zoom, flex: 'none', margin: 'auto' }} />
      </div>
    </div>
  );
}

function SelectionButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onClick}
      className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-toolbar-text hover:bg-surface-hover hover:text-ink"
    >
      {children}
    </button>
  );
}
