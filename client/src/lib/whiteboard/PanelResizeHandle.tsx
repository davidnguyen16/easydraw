'use client';

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';

export interface PanelResizeHandleProps {
  /** The panel edge carrying this divider, not the panel's screen position. */
  edge: 'left' | 'right';
  width: number;
  minWidth: number;
  maxWidth: number;
  label: string;
  controls: string;
  onResize: (width: number) => void;
  onResizeEnd?: (width: number) => void;
}

interface Drag {
  pointerId: number;
  startX: number;
  startWidth: number;
  width: number;
  direction: number;
  cleanup: () => void;
}

const KEYBOARD_STEP = 20;
function bounds(minWidth: number, maxWidth: number) {
  const min = Number.isFinite(minWidth) ? Math.max(0, minWidth) : 0;
  const max = Number.isFinite(maxWidth) ? Math.max(min, maxWidth) : min;
  return { min, max };
}
function clamp(width: number, minWidth: number, maxWidth: number) {
  const { min, max } = bounds(minWidth, maxWidth);
  return Math.min(max, Math.max(min, Number.isFinite(width) ? width : min));
}

/** Local pointer/keyboard splitter. Its owner controls width and persistence;
 * this component never touches drawing state or another editor's preferences. */
export default function PanelResizeHandle(props: PanelResizeHandleProps) {
  const { edge, width, minWidth, maxWidth, label, controls } = props;
  const callbacks = useRef(props);
  const drag = useRef<Drag | null>(null);
  const [dragging, setDragging] = useState(false);
  useLayoutEffect(() => { callbacks.current = props; });
  useEffect(() => () => {
    const pending = drag.current;
    drag.current = null;
    // Teardown cannot publish into an owner that is unmounting. It still must
    // release capture/listeners and restore the body's previous inline styles.
    pending?.cleanup();
  }, []);

  function finish(commit: boolean) {
    const pending = drag.current;
    if (!pending) return;
    drag.current = null; // releasePointerCapture can synchronously signal loss.
    pending.cleanup();
    setDragging(false);
    const current = callbacks.current;
    const next = clamp(commit ? pending.width : pending.startWidth, current.minWidth, current.maxWidth);
    if (next !== pending.width) current.onResize(next);
    current.onResizeEnd?.(next);
  }

  function start(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || !event.isPrimary || drag.current) return;
    event.preventDefault();
    event.stopPropagation();
    const target = event.currentTarget;
    const pointerId = event.pointerId;
    target.focus({ preventScroll: true });
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    const cancelOnBlur = () => finish(false);
    const cancelOnEscape = (keyboard: globalThis.KeyboardEvent) => {
      if (keyboard.key !== 'Escape') return;
      keyboard.preventDefault();
      keyboard.stopPropagation();
      finish(false);
    };
    const startWidth = clamp(callbacks.current.width, callbacks.current.minWidth, callbacks.current.maxWidth);
    drag.current = {
      pointerId, startX: event.clientX, startWidth, width: startWidth, direction: edge === 'right' ? 1 : -1,
      cleanup: () => {
        window.removeEventListener('blur', cancelOnBlur);
        window.removeEventListener('keydown', cancelOnEscape, true);
        document.body.style.cursor = previousCursor;
        document.body.style.userSelect = previousUserSelect;
        try { if (target.hasPointerCapture(pointerId)) target.releasePointerCapture(pointerId); }
        catch { /* The browser may already have detached the capture target. */ }
      },
    };
    window.addEventListener('blur', cancelOnBlur);
    window.addEventListener('keydown', cancelOnEscape, true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    setDragging(true);
    try { target.setPointerCapture(pointerId); }
    catch { finish(false); }
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    const pending = drag.current;
    if (!pending || pending.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const current = callbacks.current;
    const next = clamp(pending.startWidth + (event.clientX - pending.startX) * pending.direction,
      current.minWidth, current.maxWidth);
    if (next === pending.width) return;
    pending.width = next;
    current.onResize(next);
  }

  function end(event: PointerEvent<HTMLDivElement>, commit: boolean) {
    if (drag.current?.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    if (commit) move(event);
    finish(commit);
  }

  function keyDown(event: KeyboardEvent<HTMLDivElement>) {
    event.stopPropagation();
    if (event.key === 'Escape' && drag.current) {
      event.preventDefault();
      finish(false);
      return;
    }
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    if (drag.current) return;
    const current = callbacks.current;
    const { min, max } = bounds(current.minWidth, current.maxWidth);
    const direction = current.edge === 'right' ? 1 : -1;
    const next = event.key === 'Home' ? min : event.key === 'End' ? max
      : clamp(current.width + (event.key === 'ArrowRight' ? KEYBOARD_STEP : -KEYBOARD_STEP) * direction, min, max);
    current.onResize(next);
    current.onResizeEnd?.(next);
  }

  const { min, max } = bounds(minWidth, maxWidth);
  const currentWidth = clamp(width, min, max);
  return <div role="separator" tabIndex={0} aria-orientation="vertical" aria-label={label}
    aria-controls={controls} aria-valuemin={min} aria-valuemax={max} aria-valuenow={currentWidth}
    aria-valuetext={`${Math.round(currentWidth)} pixels`} data-panel-resize-handle data-resizing={dragging}
    className={`absolute top-0 z-40 h-full w-1.5 touch-none cursor-col-resize select-none transition-colors duration-150 hover:bg-[rgba(166,25,46,0.35)] focus-visible:bg-[rgba(166,25,46,0.5)] focus-visible:shadow-[0_0_0_2px_rgba(166,25,46,0.4)] focus-visible:outline-none ${dragging ? 'bg-[rgba(166,25,46,0.35)]' : 'bg-transparent'}`}
    style={edge === 'right' ? { right: -3 } : { left: -3 }}
    onPointerDown={start} onPointerMove={move}
    onPointerUp={(event) => end(event, true)} onPointerCancel={(event) => end(event, false)}
    onLostPointerCapture={(event) => end(event, false)} onKeyDown={keyDown}
  />;
}
