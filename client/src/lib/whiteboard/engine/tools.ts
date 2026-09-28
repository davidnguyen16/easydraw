/**
 * The tools. Each is a small state machine fed image-space pointer events by
 * the engine. Freehand tools paint straight onto the board (after one
 * history snapshot per stroke); shape tools rubber-band on the preview layer
 * and commit on release; selection tools lift pixels into the engine's
 * floating selection.
 */
import type { WhiteboardEngine } from './engine';
import { bresenham, dragRect, snapAngle } from './raster';
import type { Point, Rect, ToolHandler, ToolId, ToolPointer } from './types';

const CLOSE_POLYGON_DISTANCE = 8;
const MIN_TEXT_BOX = { width: 120, height: 36 };

export function createTool(id: ToolId, engine: WhiteboardEngine): ToolHandler {
  switch (id) {
    case 'pencil':
      return stampTool(engine, 'pencil');
    case 'eraser':
      return stampTool(engine, 'eraser');
    case 'brush':
      return brushTool(engine);
    case 'airbrush':
      return airbrushTool(engine);
    case 'flood-fill':
      return { down: (p, pointer) => engine.fill(p, engine.colorsFor(pointer).line), move: noop, up: noop };
    case 'eyedropper':
      return eyedropperTool(engine);
    case 'line':
      return lineTool(engine);
    case 'curve':
      return curveTool(engine);
    case 'rectangle':
    case 'rounded-rectangle':
    case 'oval':
      return shapeTool(engine, id);
    case 'polygon':
      return polygonTool(engine);
    case 'text':
      return textTool(engine);
    case 'selection':
      return selectionTool(engine);
    case 'freeform-selection':
      return freeformSelectionTool(engine);
    case 'pan':
      return { down: noop, move: noop, up: noop, cursor: 'grab' };
  }
}

function noop(): void {}

// ── Freehand ────────────────────────────────────────────────────────────

/** Pencil and eraser: hard-edged square stamps along a Bresenham line, MS Paint style. */
function stampTool(engine: WhiteboardEngine, kind: 'pencil' | 'eraser'): ToolHandler {
  let last: Point | null = null;
  const size = () => (kind === 'eraser' ? Math.max(4, engine.options.lineWidth * 2) : engine.options.lineWidth);
  const color = (pointer: ToolPointer) => {
    const colors = engine.colorsFor(pointer);
    return kind === 'eraser' ? colors.fill : colors.line;
  };
  const stamp = (from: Point, to: Point, pointer: ToolPointer) => {
    const s = size();
    const offset = Math.floor(s / 2);
    engine.ctx.fillStyle = color(pointer);
    for (const cell of bresenham(from, to)) engine.ctx.fillRect(cell.x - offset, cell.y - offset, s, s);
    engine.contentChanged();
  };
  return {
    cursor: 'crosshair',
    down(p, pointer) {
      engine.snapshot();
      last = p;
      stamp(p, p, pointer);
    },
    move(p, pointer) {
      if (!last) return;
      stamp(last, p, pointer);
      last = p;
    },
    up() {
      if (!last) return;
      last = null;
      engine.documentChanged();
    },
    cancel() {
      if (!last) return;
      last = null;
      engine.documentChanged();
    },
  };
}

function brushTool(engine: WhiteboardEngine): ToolHandler {
  let last: Point | null = null;
  const prepare = (pointer: ToolPointer) => {
    const ctx = engine.ctx;
    ctx.strokeStyle = engine.colorsFor(pointer).line;
    ctx.fillStyle = ctx.strokeStyle;
    ctx.lineWidth = engine.options.lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };
  return {
    cursor: 'crosshair',
    down(p, pointer) {
      engine.snapshot();
      prepare(pointer);
      engine.ctx.beginPath();
      engine.ctx.arc(p.x, p.y, engine.options.lineWidth / 2, 0, Math.PI * 2);
      engine.ctx.fill();
      last = p;
      engine.contentChanged();
    },
    move(p, pointer) {
      if (!last) return;
      prepare(pointer);
      engine.ctx.beginPath();
      engine.ctx.moveTo(last.x, last.y);
      engine.ctx.lineTo(p.x, p.y);
      engine.ctx.stroke();
      last = p;
      engine.contentChanged();
    },
    up() {
      if (!last) return;
      last = null;
      engine.documentChanged();
    },
    cancel() {
      if (!last) return;
      last = null;
      engine.documentChanged();
    },
  };
}

function airbrushTool(engine: WhiteboardEngine): ToolHandler {
  let timer: ReturnType<typeof setInterval> | null = null;
  let at: Point | null = null;
  let color = '#000000';
  const spray = () => {
    if (!at) return;
    const radius = Math.max(6, engine.options.lineWidth * 2);
    engine.ctx.fillStyle = color;
    for (let i = 0; i < radius; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.sqrt(Math.random()) * radius;
      engine.ctx.fillRect(Math.round(at.x + Math.cos(angle) * distance), Math.round(at.y + Math.sin(angle) * distance), 1, 1);
    }
    engine.contentChanged();
  };
  const stop = () => {
    if (timer) clearInterval(timer);
    timer = null;
    at = null;
  };
  return {
    cursor: 'crosshair',
    down(p, pointer) {
      engine.snapshot();
      color = engine.colorsFor(pointer).line;
      at = p;
      spray();
      timer = setInterval(spray, 30);
    },
    move(p) {
      if (at) at = p;
    },
    up() {
      if (!at) return;
      stop();
      engine.documentChanged();
    },
    cancel() {
      const painted = at !== null;
      stop();
      if (painted) engine.documentChanged();
    },
  };
}

function eyedropperTool(engine: WhiteboardEngine): ToolHandler {
  const pick = (p: Point, pointer: ToolPointer) => {
    const color = engine.colorAt(p);
    if (!color) return;
    engine.setOptions(pointer.secondary ? { fillColor: color } : { lineColor: color });
  };
  return { cursor: 'crosshair', down: pick, move: noop, up: noop };
}

// ── Shapes on the preview layer ─────────────────────────────────────────

function strokeStyle(engine: WhiteboardEngine, pointer: ToolPointer): void {
  const ctx = engine.previewCtx;
  const colors = engine.colorsFor(pointer);
  ctx.strokeStyle = colors.line;
  ctx.fillStyle = colors.fill;
  ctx.lineWidth = engine.options.lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

/** Paint the current preview path per the outline / fill option. */
function paintPath(engine: WhiteboardEngine): void {
  const ctx = engine.previewCtx;
  const mode = engine.options.outlineMode;
  if (mode !== 'outline') ctx.fill();
  if (mode !== 'fill') ctx.stroke();
}

function lineTool(engine: WhiteboardEngine): ToolHandler {
  let start: Point | null = null;
  return {
    cursor: 'crosshair',
    down(p) {
      start = p;
    },
    move(p, pointer) {
      if (!start) return;
      const end = pointer.shift ? snapAngle(start, p) : p;
      engine.clearPreview();
      strokeStyle(engine, pointer);
      engine.previewCtx.beginPath();
      engine.previewCtx.moveTo(start.x, start.y);
      engine.previewCtx.lineTo(end.x, end.y);
      engine.previewCtx.stroke();
    },
    up(p, pointer) {
      if (!start) return;
      this.move(p, pointer);
      start = null;
      engine.commitPreview();
    },
    cancel() {
      start = null;
    },
  };
}

/** Line first, then up to two drags bend it — the MS Paint curve. */
function curveTool(engine: WhiteboardEngine): ToolHandler {
  let start: Point | null = null;
  let end: Point | null = null;
  let c1: Point | null = null;
  let c2: Point | null = null;
  let phase: 0 | 1 | 2 = 0;
  let dragging = false;
  let pointerState: ToolPointer = { secondary: false, shift: false, alt: false };

  const draw = () => {
    if (!start || !end) return;
    engine.clearPreview();
    strokeStyle(engine, pointerState);
    const ctx = engine.previewCtx;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    if (c1 && c2) ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, end.x, end.y);
    else if (c1) ctx.quadraticCurveTo(c1.x, c1.y, end.x, end.y);
    else ctx.lineTo(end.x, end.y);
    ctx.stroke();
  };
  const reset = () => {
    start = end = c1 = c2 = null;
    phase = 0;
    dragging = false;
  };
  const commit = () => {
    if (start && end) {
      draw();
      engine.commitPreview();
    }
    reset();
  };
  return {
    cursor: 'crosshair',
    down(p, pointer) {
      pointerState = pointer;
      dragging = true;
      if (phase === 0) {
        start = p;
        end = p;
      } else if (phase === 1) c1 = p;
      else c2 = p;
      draw();
    },
    move(p, pointer) {
      if (!dragging) return;
      pointerState = pointer;
      if (phase === 0) end = pointer.shift && start ? snapAngle(start, p) : p;
      else if (phase === 1) c1 = p;
      else c2 = p;
      draw();
    },
    up(p, pointer) {
      if (!dragging) return;
      this.move(p, pointer);
      dragging = false;
      if (phase === 0) {
        if (start && end && start.x === end.x && start.y === end.y) return reset();
        phase = 1;
      } else if (phase === 1) phase = 2;
      else commit();
    },
    finish: commit,
    cancel: reset,
    hasPendingWork: () => start !== null,
  };
}

function shapeTool(engine: WhiteboardEngine, kind: 'rectangle' | 'rounded-rectangle' | 'oval'): ToolHandler {
  let start: Point | null = null;
  const preview = (p: Point, pointer: ToolPointer) => {
    if (!start) return;
    const r = dragRect(start, p, pointer.shift);
    engine.clearPreview();
    strokeStyle(engine, pointer);
    const ctx = engine.previewCtx;
    ctx.beginPath();
    if (kind === 'oval') ctx.ellipse(r.x + r.width / 2, r.y + r.height / 2, r.width / 2, r.height / 2, 0, 0, Math.PI * 2);
    else if (kind === 'rounded-rectangle') ctx.roundRect(r.x, r.y, r.width, r.height, Math.min(r.width, r.height) * 0.2);
    else ctx.rect(r.x, r.y, r.width, r.height);
    paintPath(engine);
    return r;
  };
  return {
    cursor: 'crosshair',
    down(p) {
      start = p;
    },
    move: preview,
    up(p, pointer) {
      const r = preview(p, pointer);
      start = null;
      if (r && r.width > 0 && r.height > 0) engine.commitPreview();
      else engine.clearPreview();
    },
    cancel() {
      start = null;
    },
  };
}

function polygonTool(engine: WhiteboardEngine): ToolHandler {
  let vertices: Point[] = [];
  let cursor: Point | null = null;
  let dragging = false;
  let pointerState: ToolPointer = { secondary: false, shift: false, alt: false };

  const draw = (closed: boolean) => {
    if (vertices.length === 0) return;
    engine.clearPreview();
    strokeStyle(engine, pointerState);
    const ctx = engine.previewCtx;
    ctx.beginPath();
    vertices.forEach((v, i) => (i === 0 ? ctx.moveTo(v.x, v.y) : ctx.lineTo(v.x, v.y)));
    if (closed) {
      ctx.closePath();
      paintPath(engine);
    } else {
      if (cursor) ctx.lineTo(cursor.x, cursor.y);
      ctx.stroke();
    }
  };
  const reset = () => {
    vertices = [];
    cursor = null;
    dragging = false;
  };
  const commit = () => {
    if (vertices.length >= 3) {
      draw(true);
      engine.commitPreview();
    } else engine.clearPreview();
    reset();
  };
  const nearStart = (p: Point) => {
    const first = vertices[0];
    return Boolean(first) && vertices.length >= 3 && Math.hypot(p.x - first!.x, p.y - first!.y) <= CLOSE_POLYGON_DISTANCE;
  };
  return {
    cursor: 'crosshair',
    down(p, pointer) {
      pointerState = pointer;
      if (vertices.length && nearStart(p)) return commit();
      dragging = true;
      cursor = p;
      if (vertices.length === 0) vertices.push(p);
      draw(false);
    },
    move(p, pointer) {
      pointerState = pointer;
      cursor = pointer.shift && vertices.length ? snapAngle(vertices[vertices.length - 1]!, p) : p;
      draw(false);
    },
    up(p, pointer) {
      if (!dragging) return;
      dragging = false;
      const last = vertices[vertices.length - 1]!;
      const point = pointer.shift ? snapAngle(last, p) : p;
      if (Math.hypot(point.x - last.x, point.y - last.y) >= 1) vertices.push(point);
      draw(false);
    },
    hover(p) {
      if (vertices.length && !dragging) {
        cursor = p;
        draw(false);
        engine.render();
      }
    },
    finish: commit,
    cancel: reset,
    hasPendingWork: () => vertices.length > 0,
  };
}

// ── Text ────────────────────────────────────────────────────────────────

function textTool(engine: WhiteboardEngine): ToolHandler {
  let start: Point | null = null;
  return {
    cursor: 'text',
    down(p) {
      engine.commitText();
      start = p;
    },
    move(p) {
      if (!start) return;
      const r = dragRect(start, p);
      engine.clearPreview();
      const ctx = engine.previewCtx;
      ctx.save();
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = '#a6192e';
      ctx.lineWidth = 1;
      ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.width, r.height);
      ctx.restore();
    },
    up(p) {
      if (!start) return;
      const dragged = dragRect(start, p);
      start = null;
      engine.clearPreview();
      const rect: Rect = {
        x: dragged.x,
        y: dragged.y,
        width: Math.max(dragged.width, dragged.width < 8 ? 240 : MIN_TEXT_BOX.width),
        height: Math.max(dragged.height, dragged.height < 8 ? Math.round(engine.options.text.fontSize * 1.25 + 8) : MIN_TEXT_BOX.height),
      };
      engine.beginText(rect);
    },
    finish() {
      engine.commitText();
    },
    cancel() {
      start = null;
      engine.textBox = null;
    },
  };
}

// ── Selection ───────────────────────────────────────────────────────────

function selectionTool(engine: WhiteboardEngine): ToolHandler {
  let mode: 'idle' | 'marquee' | 'move' = 'idle';
  let start: Point | null = null;
  let last: Point | null = null;
  return {
    cursor: 'crosshair',
    down(p) {
      if (engine.selectionContains(p)) {
        mode = 'move';
        last = p;
        return;
      }
      engine.commitSelection();
      mode = 'marquee';
      start = p;
      engine.marquee = { x: p.x, y: p.y, width: 0, height: 0 };
    },
    move(p, pointer) {
      if (mode === 'move' && last) {
        engine.moveSelection(p.x - last.x, p.y - last.y);
        last = p;
      } else if (mode === 'marquee' && start) {
        engine.marquee = dragRect(start, p, pointer.shift);
      }
    },
    up(p, pointer) {
      if (mode === 'marquee' && start) {
        const r = dragRect(start, p, pointer.shift);
        engine.marquee = null;
        if (r.width >= 1 && r.height >= 1) engine.liftRect(r);
      }
      mode = 'idle';
      start = last = null;
    },
    cancel() {
      engine.marquee = null;
      mode = 'idle';
      start = last = null;
    },
  };
}

function freeformSelectionTool(engine: WhiteboardEngine): ToolHandler {
  let mode: 'idle' | 'lasso' | 'move' = 'idle';
  let last: Point | null = null;
  let points: Point[] = [];
  return {
    cursor: 'crosshair',
    down(p) {
      if (engine.selectionContains(p)) {
        mode = 'move';
        last = p;
        return;
      }
      engine.commitSelection();
      mode = 'lasso';
      points = [p];
      engine.lasso = points;
    },
    move(p) {
      if (mode === 'move' && last) {
        engine.moveSelection(p.x - last.x, p.y - last.y);
        last = p;
      } else if (mode === 'lasso') {
        points.push(p);
        engine.lasso = points;
      }
    },
    up() {
      if (mode === 'lasso') {
        engine.lasso = null;
        engine.liftPath(points);
      }
      mode = 'idle';
      last = null;
      points = [];
    },
    cancel() {
      engine.lasso = null;
      mode = 'idle';
      last = null;
      points = [];
    },
  };
}
