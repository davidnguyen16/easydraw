/**
 * The whiteboard engine: a bitmap, a preview layer, one floating selection,
 * an undo history and the active tool — everything a paint program needs
 * that is not a widget. React renders *from* it (through `subscribe`) and
 * forwards pointer events *to* it in image coordinates; it never draws.
 *
 * Conventions, all borrowed from MS Paint / PaintZ so the board behaves the
 * way people expect: the left button paints with the line colour and the
 * right button with the fill colour; a lifted selection leaves the fill
 * colour behind; every change is preceded by one history snapshot.
 */
import { createEmptyWhiteboardDocument, type WhiteboardDocumentV1 } from '@easydraw/pack-whiteboard';
import { History } from './history';
import { floodFill, hexToRgba, invertColors, pixelAt, rgbaToHex } from './raster';
import { createTool } from './tools';
import {
  DEFAULT_DRAW_OPTIONS,
  WHITEBOARD_PREVIEW_SNAPSHOT_LIMITS,
  type DrawOptions,
  type Point,
  type Rect,
  type TextStyle,
  type ToolHandler,
  type ToolId,
  type ToolPointer,
  type WhiteboardPreviewSnapshot,
} from './types';

export interface FloatingSelection {
  /** The lifted pixels; transparent outside a freeform outline. */
  canvas: HTMLCanvasElement;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Freeform lasso, relative to the selection's origin. Null for a rectangle. */
  outline: Point[] | null;
}

export interface TextBox {
  rect: Rect;
  text: string;
}

export type ResizeMode = 'crop' | 'scale';

type Listener = () => void;

const DUPLICATE_OFFSET = 16;

export function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

function context(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D is not available.');
  return ctx;
}

export class WhiteboardEngine {
  /** The board itself. Read by the viewport; written only through this class. */
  readonly doc: HTMLCanvasElement;
  /** Transparent layer the current tool draws its in-progress shape on. */
  readonly preview: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly previewCtx: CanvasRenderingContext2D;

  options: DrawOptions = structuredClone(DEFAULT_DRAW_OPTIONS);
  tool: ToolId = 'pencil';
  selection: FloatingSelection | null = null;
  textBox: TextBox | null = null;
  /** Rectangle being dragged out by the selection tool; drawn by the viewport. */
  marquee: Rect | null = null;
  /** Lasso being drawn by the freeform selection tool; drawn by the viewport. */
  lasso: Point[] | null = null;
  /** Last copied pixels; also offered to the system clipboard when allowed. */
  clipboard: HTMLCanvasElement | null = null;

  /** Called whenever the viewport must repaint (cheap; every pointer move). */
  onRender: (() => void) | null = null;
  /** Called after the board's pixels change, for autosave. */
  onDocumentChange: (() => void) | null = null;

  private handler: ToolHandler;
  private readonly history: History;
  private readonly listeners = new Set<Listener>();
  private revision = 0;
  private pointerActive = false;

  constructor(width: number, height: number, maxUndoLevels = 50) {
    this.doc = createCanvas(width, height);
    this.preview = createCanvas(width, height);
    this.ctx = context(this.doc);
    this.previewCtx = context(this.preview);
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, this.doc.width, this.doc.height);
    this.history = new History(maxUndoLevels);
    this.handler = createTool(this.tool, this);
  }

  // ── Observation ──

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** State that widgets show changed (tool, colours, selection, history). */
  notify(): void {
    for (const listener of this.listeners) listener();
    this.render();
  }

  render(): void {
    this.onRender?.();
  }

  /** The viewport installs its repaint here while mounted. */
  setRenderer(render: (() => void) | null): void {
    this.onRender = render;
  }

  get width(): number {
    return this.doc.width;
  }

  get height(): number {
    return this.doc.height;
  }

  get canUndo(): boolean {
    return this.history.canUndo;
  }

  get canRedo(): boolean {
    return this.history.canRedo;
  }

  /** Monotonic local content version. Viewport zoom, pan and grid do not affect it. */
  get contentRevision(): number {
    return this.revision;
  }

  get previewBlockedReason(): string | null {
    if (this.pointerActive) return 'Finish the current drawing gesture before creating a preview.';
    if (this.handler.hasPendingWork?.()) return `Finish or cancel the ${this.tool} before creating a preview.`;
    return null;
  }

  /** Visible pixels changed, including floating/text content not yet saved. */
  contentChanged(): void {
    this.revision += 1;
    this.notify();
  }

  // ── Options and tools ──

  setTool(tool: ToolId): void {
    if (tool === this.tool) return;
    if (this.pointerActive) this.pointerCancel();
    this.handler.finish?.();
    this.tool = tool;
    this.handler = createTool(tool, this);
    this.notify();
  }

  get cursor(): string {
    return this.handler.cursor ?? 'crosshair';
  }

  setOptions(patch: Partial<Omit<DrawOptions, 'text'>> & { text?: Partial<TextStyle> }): void {
    const { text, ...rest } = patch;
    const before = this.options;
    this.options = { ...before, ...rest, text: { ...before.text, ...text } };
    const affectsText = this.textBox && (
      before.lineColor !== this.options.lineColor ||
      ((before.text.opaque || this.options.text.opaque) && before.fillColor !== this.options.fillColor) ||
      (Object.keys(before.text) as (keyof TextStyle)[]).some((key) => before.text[key] !== this.options.text[key])
    );
    if (affectsText) this.contentChanged();
    else this.notify();
  }

  swapColors(): void {
    this.setOptions({ lineColor: this.options.fillColor, fillColor: this.options.lineColor });
  }

  /** Line and fill colours for a stroke; the right button swaps them. */
  colorsFor(pointer: ToolPointer): { line: string; fill: string } {
    const { lineColor, fillColor } = this.options;
    return pointer.secondary ? { line: fillColor, fill: lineColor } : { line: lineColor, fill: fillColor };
  }

  // ── Pointer routing ──

  pointerDown(p: Point, pointer: ToolPointer): void {
    if (this.pointerActive) this.pointerCancel();
    this.pointerActive = true;
    try {
      this.handler.down(p, pointer);
    } catch (error) {
      this.pointerCancel();
      throw error;
    } finally {
      this.notify();
    }
  }

  pointerMove(p: Point, pointer: ToolPointer): void {
    if (!this.pointerActive) return;
    try {
      this.handler.move(p, pointer);
    } catch (error) {
      this.pointerCancel();
      throw error;
    }
    this.render();
  }

  pointerUp(p: Point, pointer: ToolPointer): void {
    if (!this.pointerActive) return;
    try {
      this.handler.up(p, pointer);
    } finally {
      this.pointerActive = false;
      this.notify();
    }
  }

  /** Lost capture/blur: stop raster strokes and discard only unfinished tool work. */
  pointerCancel(): void {
    if (!this.pointerActive && !this.handler.hasPendingWork?.()) return;
    this.pointerActive = false;
    try {
      this.handler.cancel?.();
    } finally {
      this.clearPreview();
      this.notify();
    }
  }

  pointerHover(p: Point): void {
    this.handler.hover?.(p);
  }

  /** Enter: complete a polygon, curve or text box. */
  finish(): void {
    if (this.pointerActive) return;
    this.handler.finish?.();
    this.notify();
  }

  /** Escape: drop work in progress, then drop the floating selection. */
  cancel(): void {
    this.pointerActive = false;
    if (this.textBox) {
      this.handler.cancel?.();
      this.textBox = null;
      this.clearPreview();
      this.contentChanged();
      return;
    }
    if (this.handler.cancel) {
      this.handler.cancel();
      this.clearPreview();
    }
    if (this.selection) this.commitSelection();
    this.notify();
  }

  clearPreview(): void {
    this.previewCtx.clearRect(0, 0, this.preview.width, this.preview.height);
  }

  /** Stamp the preview layer onto the board as one change. */
  commitPreview(): void {
    this.snapshot();
    this.ctx.drawImage(this.preview, 0, 0);
    this.clearPreview();
    this.documentChanged();
  }

  // ── History ──

  /** Record the board before a change. Tools call this once per gesture. */
  snapshot(): void {
    this.history.push(this.ctx.getImageData(0, 0, this.doc.width, this.doc.height));
  }

  documentChanged(): void {
    this.revision += 1;
    this.onDocumentChange?.();
    this.notify();
  }

  undo(): void {
    this.pointerActive = false;
    const hadFloatingContent = this.selection !== null || this.textBox !== null;
    this.handler.cancel?.();
    this.clearPreview();
    this.selection = null;
    this.textBox = null;
    const restored = this.history.undo(this.ctx.getImageData(0, 0, this.doc.width, this.doc.height));
    if (restored) this.restore(restored);
    else if (hadFloatingContent) this.contentChanged();
    else this.notify();
  }

  redo(): void {
    this.pointerActive = false;
    const hadFloatingContent = this.selection !== null || this.textBox !== null;
    this.handler.cancel?.();
    this.clearPreview();
    this.selection = null;
    this.textBox = null;
    const restored = this.history.redo(this.ctx.getImageData(0, 0, this.doc.width, this.doc.height));
    if (restored) this.restore(restored);
    else if (hadFloatingContent) this.contentChanged();
    else this.notify();
  }

  private restore(image: ImageData): void {
    if (image.width !== this.doc.width || image.height !== this.doc.height) this.setSize(image.width, image.height);
    this.ctx.putImageData(image, 0, 0);
    this.documentChanged();
  }

  private setSize(width: number, height: number): void {
    this.doc.width = Math.max(1, Math.round(width));
    this.doc.height = Math.max(1, Math.round(height));
    this.preview.width = this.doc.width;
    this.preview.height = this.doc.height;
  }

  // ── Whole-board operations ──

  clear(): void {
    this.pointerActive = false;
    this.handler.cancel?.();
    this.clearPreview();
    this.selection = null;
    this.textBox = null;
    this.snapshot();
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, this.doc.width, this.doc.height);
    this.documentChanged();
  }

  /** Crop keeps the top-left and pads with white; scale resamples. */
  resize(width: number, height: number, mode: ResizeMode): void {
    this.commitSelection();
    this.snapshot();
    const old = createCanvas(this.doc.width, this.doc.height);
    context(old).drawImage(this.doc, 0, 0);
    this.setSize(width, height);
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, this.doc.width, this.doc.height);
    if (mode === 'scale') {
      this.ctx.imageSmoothingEnabled = true;
      this.ctx.imageSmoothingQuality = 'high';
      this.ctx.drawImage(old, 0, 0, old.width, old.height, 0, 0, this.doc.width, this.doc.height);
    } else {
      this.ctx.drawImage(old, 0, 0);
    }
    this.documentChanged();
  }

  /** Replace the board with an opened image, at the image's own size. */
  openImage(image: CanvasImageSource & { width: number; height: number }): void {
    this.commitSelection();
    this.snapshot();
    this.setSize(image.width, image.height);
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, this.doc.width, this.doc.height);
    this.ctx.drawImage(image, 0, 0);
    this.documentChanged();
  }

  rotate(direction: 'cw' | 'ccw'): void {
    const target = this.selection;
    if (target) {
      target.canvas = rotated(target.canvas, direction);
      [target.width, target.height] = [target.height, target.width];
      this.contentChanged();
      return;
    }
    this.snapshot();
    const turned = rotated(this.doc, direction);
    this.setSize(turned.width, turned.height);
    this.ctx.drawImage(turned, 0, 0);
    this.documentChanged();
  }

  flip(axis: 'horizontal' | 'vertical'): void {
    const target = this.selection;
    if (target) {
      target.canvas = flipped(target.canvas, axis);
      this.contentChanged();
      return;
    }
    this.snapshot();
    const mirrored = flipped(this.doc, axis);
    this.ctx.clearRect(0, 0, this.doc.width, this.doc.height);
    this.ctx.drawImage(mirrored, 0, 0);
    this.documentChanged();
  }

  invert(): void {
    const target = this.selection;
    if (target) {
      const c = context(target.canvas);
      const image = c.getImageData(0, 0, target.canvas.width, target.canvas.height);
      invertColors(image);
      c.putImageData(image, 0, 0);
      this.contentChanged();
      return;
    }
    this.snapshot();
    const image = this.ctx.getImageData(0, 0, this.doc.width, this.doc.height);
    invertColors(image);
    this.ctx.putImageData(image, 0, 0);
    this.documentChanged();
  }

  fill(p: Point, color: string): void {
    const image = this.ctx.getImageData(0, 0, this.doc.width, this.doc.height);
    const before = this.ctx.getImageData(0, 0, this.doc.width, this.doc.height);
    if (!floodFill(image, p, hexToRgba(color))) return;
    this.history.push(before);
    this.ctx.putImageData(image, 0, 0);
    this.documentChanged();
  }

  colorAt(p: Point): string | null {
    const rgba = pixelAt(this.ctx.getImageData(0, 0, this.doc.width, this.doc.height), p);
    return rgba ? rgbaToHex(rgba) : null;
  }

  // ── Selection ──

  /** Lift a rectangle off the board into a floating selection. */
  liftRect(rect: Rect): void {
    const r = clampRect(rect, this.doc.width, this.doc.height);
    if (r.width < 1 || r.height < 1) return;
    this.commitSelection();
    this.snapshot();
    const canvas = createCanvas(r.width, r.height);
    context(canvas).drawImage(this.doc, r.x, r.y, r.width, r.height, 0, 0, r.width, r.height);
    this.ctx.fillStyle = this.options.fillColor;
    this.ctx.fillRect(r.x, r.y, r.width, r.height);
    this.selection = { canvas, x: r.x, y: r.y, width: r.width, height: r.height, outline: null };
    this.documentChanged();
  }

  /** Lift the pixels inside a lasso; everything outside it stays put. */
  liftPath(points: Point[]): void {
    if (points.length < 3) return;
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const bounds = clampRect(
      { x: Math.floor(Math.min(...xs)), y: Math.floor(Math.min(...ys)), width: Math.ceil(Math.max(...xs)) - Math.floor(Math.min(...xs)), height: Math.ceil(Math.max(...ys)) - Math.floor(Math.min(...ys)) },
      this.doc.width,
      this.doc.height,
    );
    if (bounds.width < 1 || bounds.height < 1) return;
    this.commitSelection();
    this.snapshot();
    const canvas = createCanvas(bounds.width, bounds.height);
    const c = context(canvas);
    const outline = points.map((p) => ({ x: p.x - bounds.x, y: p.y - bounds.y }));
    c.save();
    tracePath(c, outline);
    c.clip();
    c.drawImage(this.doc, bounds.x, bounds.y, bounds.width, bounds.height, 0, 0, bounds.width, bounds.height);
    c.restore();
    this.ctx.save();
    tracePath(this.ctx, points);
    this.ctx.clip();
    this.ctx.fillStyle = this.options.fillColor;
    this.ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
    this.ctx.restore();
    this.selection = { canvas, ...bounds, outline };
    this.documentChanged();
  }

  selectAll(): void {
    this.setTool('selection');
    this.liftRect({ x: 0, y: 0, width: this.doc.width, height: this.doc.height });
  }

  moveSelection(dx: number, dy: number): void {
    if (!this.selection || (!dx && !dy)) return;
    this.selection.x += dx;
    this.selection.y += dy;
    this.contentChanged();
  }

  /** Stamp the floating selection back onto the board. */
  commitSelection(): void {
    const s = this.selection;
    if (!s) return;
    this.selection = null;
    this.ctx.drawImage(s.canvas, Math.round(s.x), Math.round(s.y));
    this.documentChanged();
  }

  /** The lifted pixels are discarded; the board keeps the fill left behind. */
  deleteSelection(): void {
    if (!this.selection) return;
    this.selection = null;
    this.documentChanged();
  }

  copy(): boolean {
    const s = this.selection;
    if (!s) return false;
    const copy = createCanvas(s.width, s.height);
    context(copy).drawImage(s.canvas, 0, 0);
    this.clipboard = copy;
    void offerToSystemClipboard(copy);
    this.notify();
    return true;
  }

  cut(): void {
    if (this.copy()) this.deleteSelection();
  }

  /** Float a copy of the current selection next to it. */
  duplicate(): void {
    const s = this.selection;
    if (!s) return;
    const copy = createCanvas(s.width, s.height);
    context(copy).drawImage(s.canvas, 0, 0);
    this.commitSelection();
    this.snapshot();
    this.selection = { canvas: copy, x: s.x + DUPLICATE_OFFSET, y: s.y + DUPLICATE_OFFSET, width: s.width, height: s.height, outline: s.outline };
    this.setTool('selection');
    this.contentChanged();
  }

  /** Float pasted pixels at `at` (the viewport's top-left, so they are visible). */
  paste(image: CanvasImageSource & { width: number; height: number }, at: Point): void {
    this.commitSelection();
    this.snapshot();
    const canvas = createCanvas(image.width, image.height);
    context(canvas).drawImage(image, 0, 0);
    this.selection = { canvas, x: Math.round(at.x), y: Math.round(at.y), width: canvas.width, height: canvas.height, outline: null };
    this.setTool('selection');
    this.contentChanged();
  }

  pasteFromClipboard(at: Point): boolean {
    if (!this.clipboard) return false;
    this.paste(this.clipboard, at);
    return true;
  }

  /** Shrink the board to the floating selection. */
  crop(): void {
    const s = this.selection;
    if (!s) return;
    this.selection = null;
    this.snapshot();
    this.setSize(s.width, s.height);
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, this.doc.width, this.doc.height);
    this.ctx.drawImage(s.canvas, 0, 0);
    this.documentChanged();
  }

  selectionContains(p: Point): boolean {
    const s = this.selection;
    if (!s) return false;
    if (p.x < s.x || p.y < s.y || p.x >= s.x + s.width || p.y >= s.y + s.height) return false;
    if (!s.outline) return true;
    return pointInPolygon({ x: p.x - s.x, y: p.y - s.y }, s.outline);
  }

  // ── Text ──

  beginText(rect: Rect): void {
    this.commitText();
    this.textBox = { rect, text: '' };
    if (this.options.text.opaque) this.contentChanged();
    else this.notify();
  }

  updateText(text: string): void {
    if (!this.textBox || this.textBox.text === text) return;
    this.textBox.text = text;
    this.contentChanged();
  }

  /** Render the text box onto the board (Ctrl+Enter, clicking away, switching tools). */
  commitText(): void {
    const box = this.textBox;
    if (!box) return;
    this.textBox = null;
    if (!box.text.trim()) {
      if (this.options.text.opaque || box.text) this.contentChanged();
      else this.notify();
      return;
    }
    this.snapshot();
    drawTextBox(this.ctx, box, this.options);
    this.documentChanged();
  }

  // ── Persistence ──

  /**
   * Freeze exactly the visible document content without committing selection/text,
   * changing history, notifying autosave, or drawing editor UI into the image.
   * Bounds are checked before allocating the extra canvas; PNG encoding occurs
   * only on this explicit action, never during a pointer move.
   */
  capturePreviewSnapshot(): WhiteboardPreviewSnapshot {
    const blocked = this.previewBlockedReason;
    if (blocked) throw new Error(blocked);
    const { width, height, contentRevision: revision } = this;
    const limits = WHITEBOARD_PREVIEW_SNAPSHOT_LIMITS;
    if (width > limits.maxDimension || height > limits.maxDimension || width * height > limits.maxPixels) {
      throw new Error('Preview images must be at most 8192 pixels per side and 16 million pixels in total. Resize the whiteboard first.');
    }
    const canvas = createCanvas(width, height);
    try {
      const ctx = context(canvas);
      ctx.drawImage(this.doc, 0, 0);
      if (this.selection) ctx.drawImage(this.selection.canvas, this.selection.x, this.selection.y);
      if (this.textBox) drawTextBox(ctx, this.textBox, this.options);
      let image: string;
      try {
        image = canvas.toDataURL('image/png');
      } catch {
        throw new Error('The whiteboard could not be captured. Imported images must allow canvas export.');
      }
      const prefix = 'data:image/png;base64,';
      if (!image.startsWith(prefix)) throw new Error('The browser could not encode the whiteboard as PNG.');
      const padding = image.endsWith('==') ? 2 : image.endsWith('=') ? 1 : 0;
      const pngBytes = ((image.length - prefix.length) * 3) / 4 - padding;
      if (pngBytes > limits.maxPngBytes) throw new Error('The preview PNG exceeds 4 MiB. Reduce the whiteboard size or image detail first.');
      return { width, height, image, revision };
    } finally {
      // Release the temporary backing buffer; never resize either engine canvas.
      canvas.width = 0;
      canvas.height = 0;
    }
  }

  toDocument(): WhiteboardDocumentV1 {
    const doc = createEmptyWhiteboardDocument({ width: this.doc.width, height: this.doc.height });
    doc.image = this.doc.toDataURL('image/png');
    return doc;
  }

  /** Adopt a stored document; resolves once its image (if any) is on the board. */
  async loadDocument(doc: WhiteboardDocumentV1): Promise<void> {
    this.pointerActive = false;
    this.handler.cancel?.();
    this.clearPreview();
    this.selection = null;
    this.textBox = null;
    this.history.clear();
    this.setSize(doc.width, doc.height);
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, this.doc.width, this.doc.height);
    if (doc.image) {
      const image = await loadImageElement(doc.image);
      this.ctx.drawImage(image, 0, 0);
    }
    this.contentChanged();
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────

function clampRect(rect: Rect, width: number, height: number): Rect {
  const x = Math.max(0, Math.floor(rect.x));
  const y = Math.max(0, Math.floor(rect.y));
  const right = Math.min(width, Math.ceil(rect.x + rect.width));
  const bottom = Math.min(height, Math.ceil(rect.y + rect.height));
  return { x, y, width: right - x, height: bottom - y };
}

export function tracePath(ctx: CanvasRenderingContext2D, points: Point[]): void {
  ctx.beginPath();
  points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.closePath();
}

function pointInPolygon(p: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!;
    const b = polygon[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function rotated(source: HTMLCanvasElement, direction: 'cw' | 'ccw'): HTMLCanvasElement {
  const out = createCanvas(source.height, source.width);
  const c = context(out);
  c.translate(out.width / 2, out.height / 2);
  c.rotate(direction === 'cw' ? Math.PI / 2 : -Math.PI / 2);
  c.drawImage(source, -source.width / 2, -source.height / 2);
  return out;
}

function flipped(source: HTMLCanvasElement, axis: 'horizontal' | 'vertical'): HTMLCanvasElement {
  const out = createCanvas(source.width, source.height);
  const c = context(out);
  if (axis === 'horizontal') {
    c.translate(source.width, 0);
    c.scale(-1, 1);
  } else {
    c.translate(0, source.height);
    c.scale(1, -1);
  }
  c.drawImage(source, 0, 0);
  return out;
}

export function fontOf(text: TextStyle): string {
  return `${text.italic ? 'italic ' : ''}${text.bold ? 'bold ' : ''}${text.fontSize}px ${text.fontFamily}`;
}

/** Word-wraps `text` to `maxWidth` using the context's current font. */
export function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(' ')) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(candidate).width > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    lines.push(line);
  }
  return lines;
}

function drawTextBox(ctx: CanvasRenderingContext2D, box: TextBox, options: DrawOptions): void {
  const { rect } = box;
  const style = options.text;
  ctx.save();
  if (style.opaque) {
    ctx.fillStyle = options.fillColor;
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  }
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.width, rect.height);
  ctx.clip();
  ctx.font = fontOf(style);
  ctx.textBaseline = 'top';
  ctx.fillStyle = options.lineColor;
  ctx.strokeStyle = options.lineColor;
  ctx.lineWidth = Math.max(1, style.fontSize / 14);
  const lineHeight = Math.round(style.fontSize * 1.25);
  const padding = 4;
  let y = rect.y + padding;
  for (const line of wrapLines(ctx, box.text, Math.max(1, rect.width - padding * 2))) {
    ctx.fillText(line, rect.x + padding, y);
    const width = ctx.measureText(line).width;
    if (style.underline) {
      ctx.beginPath();
      ctx.moveTo(rect.x + padding, y + style.fontSize + 1);
      ctx.lineTo(rect.x + padding + width, y + style.fontSize + 1);
      ctx.stroke();
    }
    if (style.strike) {
      ctx.beginPath();
      ctx.moveTo(rect.x + padding, y + style.fontSize * 0.55);
      ctx.lineTo(rect.x + padding + width, y + style.fontSize * 0.55);
      ctx.stroke();
    }
    y += lineHeight;
  }
  ctx.restore();
}

export function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('The image could not be decoded.'));
    image.src = src;
  });
}

async function offerToSystemClipboard(canvas: HTMLCanvasElement): Promise<void> {
  try {
    if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) return;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (blob) await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
  } catch {
    // The internal clipboard still works; the system one needs a permission we may not have.
  }
}
