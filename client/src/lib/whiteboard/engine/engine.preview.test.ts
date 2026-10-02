import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCanvas, WhiteboardEngine } from './engine';
import { WHITEBOARD_PREVIEW_SNAPSHOT_LIMITS, type ToolId, type ToolPointer } from './types';

const PNG = 'data:image/png;base64,iVBORw==';
const pointer: ToolPointer = { secondary: false, shift: false, alt: false };

/** Call-recording surface, not a raster implementation; pixel fidelity is browser-tested. */
class CanvasStub {
  width = 0;
  height = 0;
  readonly context = {
    drawImage: vi.fn(), fillRect: vi.fn(), clearRect: vi.fn(),
    save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), closePath: vi.fn(),
    rect: vi.fn(), clip: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(),
    fill: vi.fn(), stroke: vi.fn(), arc: vi.fn(), ellipse: vi.fn(),
    roundRect: vi.fn(), setLineDash: vi.fn(), strokeRect: vi.fn(),
    quadraticCurveTo: vi.fn(), bezierCurveTo: vi.fn(),
    translate: vi.fn(), rotate: vi.fn(), scale: vi.fn(),
    fillText: vi.fn(), measureText: vi.fn((text: string) => ({ width: text.length * 8 })),
    getImageData: vi.fn((_x: number, _y: number, width: number, height: number) => ({
      width, height, data: new Uint8ClampedArray(4),
    })),
    putImageData: vi.fn(),
  };
  getContext = vi.fn(() => this.context);
  toDataURL = vi.fn(() => PNG);
}

let canvases: CanvasStub[];

beforeEach(() => {
  canvases = [];
  vi.stubGlobal('document', {
    createElement: vi.fn((tag: string) => {
      if (tag !== 'canvas') throw new Error(`Unexpected element: ${tag}`);
      const canvas = new CanvasStub();
      canvases.push(canvas);
      return canvas;
    }),
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('whiteboard document origin', () => {
  it('carries a built-in sample id through load and save, and only then', async () => {
    const engine = new WhiteboardEngine(10, 10);
    await engine.loadDocument({ version: 1, pack: 'whiteboard', width: 10, height: 10, image: null, sample: 'data-centre-whiteboard' });
    expect(engine.toDocument()).toEqual({ version: 1, pack: 'whiteboard', width: 10, height: 10, image: PNG, sample: 'data-centre-whiteboard' });
    await engine.loadDocument({ version: 1, pack: 'whiteboard', width: 10, height: 10, image: null });
    expect(engine.toDocument()).not.toHaveProperty('sample');
  });
});

describe('whiteboard preview snapshot', () => {
  it('composites board, floating selection and uncommitted text in order without mutating the engine', () => {
    const engine = new WhiteboardEngine(400, 240);
    engine.liftRect({ x: 10, y: 20, width: 80, height: 60 });
    engine.moveSelection(20, 30);
    engine.beginText({ x: 140, y: 70, width: 160, height: 50 });
    engine.updateText('Auth API');
    const selection = engine.selection;
    const textBox = engine.textBox;
    const before = {
      width: engine.width, height: engine.height, revision: engine.contentRevision,
      undo: engine.canUndo, redo: engine.canRedo,
    };
    const changed = vi.fn();
    const notified = vi.fn();
    engine.onDocumentChange = changed;
    engine.subscribe(notified);
    const doc = engine.doc as unknown as CanvasStub;
    const reads = doc.context.getImageData.mock.calls.length;
    const writes = doc.context.drawImage.mock.calls.length;
    const snapshot = engine.capturePreviewSnapshot();
    const composite = canvases.at(-1)!;

    expect(snapshot).toEqual({ width: 400, height: 240, image: PNG, revision: before.revision });
    expect(composite.context.drawImage.mock.calls).toEqual([
      [engine.doc, 0, 0], [selection!.canvas, 30, 50],
    ]);
    expect(composite.context.fillText).toHaveBeenCalledWith('Auth API', 144, 74);
    expect(composite.context.drawImage.mock.invocationCallOrder.at(-1))
      .toBeLessThan(composite.context.fillText.mock.invocationCallOrder[0]!);
    expect(composite.context.drawImage.mock.calls.some(([source]) => source === engine.preview)).toBe(false);
    expect(engine.selection).toBe(selection);
    expect(engine.textBox).toBe(textBox);
    expect({ width: engine.width, height: engine.height, revision: engine.contentRevision, undo: engine.canUndo, redo: engine.canRedo }).toEqual(before);
    expect(doc.context.getImageData).toHaveBeenCalledTimes(reads);
    expect(doc.context.drawImage).toHaveBeenCalledTimes(writes);
    expect(changed).not.toHaveBeenCalled();
    expect(notified).not.toHaveBeenCalled();
    expect(composite.width).toBe(0);
    expect(composite.height).toBe(0);
  });

  it.each(['curve', 'polygon'] as const)('blocks a pending %s between gestures until explicitly finished or cancelled', (tool) => {
    const engine = new WhiteboardEngine(200, 100);
    engine.setTool(tool);
    engine.pointerDown({ x: 10, y: 10 }, pointer);
    expect(() => engine.capturePreviewSnapshot()).toThrow(/gesture/);
    engine.pointerUp({ x: 80, y: 50 }, pointer);
    expect(engine.previewBlockedReason).toContain(tool);
    expect(() => engine.capturePreviewSnapshot()).toThrow(`Finish or cancel the ${tool}`);
    engine.finish();
    expect(engine.previewBlockedReason).toBeNull();
    expect(() => engine.capturePreviewSnapshot()).not.toThrow();

    engine.pointerDown({ x: 10, y: 10 }, pointer);
    engine.pointerUp({ x: 80, y: 50 }, pointer);
    engine.pointerCancel();
    expect(engine.previewBlockedReason).toBeNull();
    expect(() => engine.capturePreviewSnapshot()).not.toThrow();
  });

  it.each(['pencil', 'brush', 'eraser', 'line', 'rectangle', 'selection', 'text'] as const)(
    'releases an interrupted %s gesture and ignores a subsequent stray pointerUp', (tool) => {
      const engine = new WhiteboardEngine(200, 100);
      engine.setTool(tool);
      engine.pointerDown({ x: 10, y: 10 }, pointer);
      engine.pointerMove({ x: 40, y: 30 }, pointer);
      expect(engine.previewBlockedReason).not.toBeNull();
      engine.pointerCancel();
      expect(engine.previewBlockedReason).toBeNull();
      const revision = engine.contentRevision;
      engine.pointerUp({ x: 40, y: 30 }, pointer);
      expect(engine.contentRevision).toBe(revision);
      expect(() => engine.capturePreviewSnapshot()).not.toThrow();
    },
  );

  it('stops airbrush timers on cancellation and reports the already-painted stroke for autosave', () => {
    vi.useFakeTimers();
    const engine = new WhiteboardEngine(200, 100);
    engine.setTool('airbrush');
    const changed = vi.fn();
    engine.onDocumentChange = changed;
    engine.pointerDown({ x: 30, y: 30 }, pointer);
    vi.advanceTimersByTime(60);
    engine.pointerCancel();
    const revision = engine.contentRevision;
    vi.advanceTimersByTime(300);
    expect(engine.contentRevision).toBe(revision);
    expect(changed).toHaveBeenCalledTimes(1);
    expect(engine.previewBlockedReason).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps a ready text box and floating selection when blur has no active gesture to cancel', () => {
    const engine = new WhiteboardEngine(200, 100);
    engine.paste(createCanvas(30, 20), { x: 10, y: 10 });
    engine.setTool('text');
    engine.beginText({ x: 50, y: 10, width: 130, height: 40 });
    engine.updateText('Pending text');
    const revision = engine.contentRevision;
    const selection = engine.selection;
    const textBox = engine.textBox;
    engine.pointerCancel();
    expect(engine.selection).toBe(selection);
    expect(engine.textBox).toBe(textBox);
    expect(engine.contentRevision).toBe(revision);
  });

  it.each([[8193, 1], [1, 8193], [4001, 4000]])('rejects oversized %i × %i images before allocating a composite', (width, height) => {
    const engine = new WhiteboardEngine(width, height);
    const count = canvases.length;
    expect(() => engine.capturePreviewSnapshot()).toThrow(/8192 pixels.*16 million pixels/);
    expect(canvases).toHaveLength(count);
  });

  it('applies the PNG byte limit after Base64 decoding, including padding', () => {
    const engine = new WhiteboardEngine(100, 100);
    const create = document.createElement as ReturnType<typeof vi.fn>;
    const composite = new CanvasStub();
    const limit = WHITEBOARD_PREVIEW_SNAPSHOT_LIMITS.maxPngBytes;
    composite.toDataURL.mockReturnValue(`data:image/png;base64,${Buffer.alloc(limit).toString('base64')}`);
    create.mockReturnValueOnce(composite);
    expect(() => engine.capturePreviewSnapshot()).not.toThrow();
    composite.toDataURL.mockReturnValue(`data:image/png;base64,${Buffer.alloc(limit + 1).toString('base64')}`);
    create.mockReturnValueOnce(composite);
    expect(() => engine.capturePreviewSnapshot()).toThrow(/exceeds 4 MiB/);
    expect(engine.width).toBe(100);
    expect(engine.height).toBe(100);
  });
});

describe('whiteboard content revision', () => {
  it('tracks text edits and active text style without treating inactive settings as content', () => {
    const engine = new WhiteboardEngine(300, 200);
    const initial = engine.contentRevision;
    engine.setOptions({ lineColor: '#ff0000', text: { bold: true } });
    engine.setTool('pan');
    engine.notify();
    engine.render();
    expect(engine.contentRevision).toBe(initial);
    engine.beginText({ x: 10, y: 10, width: 100, height: 40 });
    engine.updateText('Hello');
    const typed = engine.contentRevision;
    expect(typed).toBeGreaterThan(initial);
    engine.updateText('Hello');
    engine.setOptions({ lineWidth: 10, outlineMode: 'fill', text: { bold: true } });
    expect(engine.contentRevision).toBe(typed);
    engine.setOptions({ text: { italic: true } });
    expect(engine.contentRevision).toBeGreaterThan(typed);
    const styled = engine.contentRevision;
    engine.setOptions({ lineColor: '#00ff00' });
    expect(engine.contentRevision).toBeGreaterThan(styled);
    const coloured = engine.contentRevision;
    engine.cancel();
    expect(engine.contentRevision).toBeGreaterThan(coloured);
  });

  it('tracks floating selection movement and transforms without encoding or reading board pixels per move', () => {
    const engine = new WhiteboardEngine(300, 200);
    engine.paste(createCanvas(40, 20), { x: 20, y: 20 });
    const revision = engine.contentRevision;
    const doc = engine.doc as unknown as CanvasStub;
    const reads = doc.context.getImageData.mock.calls.length;
    engine.moveSelection(5, 5);
    expect(engine.contentRevision).toBeGreaterThan(revision);
    const moved = engine.contentRevision;
    engine.moveSelection(0, 0);
    expect(engine.contentRevision).toBe(moved);
    engine.rotate('cw');
    expect(engine.contentRevision).toBeGreaterThan(moved);
    const rotated = engine.contentRevision;
    engine.flip('horizontal');
    expect(engine.contentRevision).toBeGreaterThan(rotated);
    expect(doc.context.getImageData).toHaveBeenCalledTimes(reads);
    for (const canvas of canvases) expect(canvas.toDataURL).not.toHaveBeenCalled();
  });

  it.each(['pencil', 'brush', 'eraser'] as ToolId[])('updates revision during %s strokes without another image read on move', (tool) => {
    const engine = new WhiteboardEngine(300, 200);
    engine.setTool(tool);
    engine.pointerDown({ x: 20, y: 20 }, pointer);
    const doc = engine.doc as unknown as CanvasStub;
    const reads = doc.context.getImageData.mock.calls.length;
    const revision = engine.contentRevision;
    engine.pointerMove({ x: 40, y: 30 }, pointer);
    expect(engine.contentRevision).toBeGreaterThan(revision);
    expect(doc.context.getImageData).toHaveBeenCalledTimes(reads);
    expect(doc.toDataURL).not.toHaveBeenCalled();
    engine.pointerUp({ x: 40, y: 30 }, pointer);
    expect(engine.previewBlockedReason).toBeNull();
  });
});
