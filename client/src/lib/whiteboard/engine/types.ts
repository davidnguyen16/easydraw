/**
 * Shared vocabulary of the whiteboard engine. The engine is plain TypeScript
 * over the Canvas 2D API — no React — so tools stay testable and the editor
 * chrome only ever talks to `WhiteboardEngine`.
 */

export type ToolId =
  | 'selection'
  | 'freeform-selection'
  | 'pan'
  | 'pencil'
  | 'brush'
  | 'airbrush'
  | 'eraser'
  | 'flood-fill'
  | 'eyedropper'
  | 'line'
  | 'curve'
  | 'rectangle'
  | 'rounded-rectangle'
  | 'oval'
  | 'polygon'
  | 'text';

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A frozen, composited input for diagram preview generation, not an autosave. */
export interface WhiteboardPreviewSnapshot {
  width: number;
  height: number;
  /** PNG data URL of the whole board, without editor overlays. */
  image: string;
  /** Local content identity; never a substitute for a server-computed hash. */
  revision: number;
}

export const WHITEBOARD_PREVIEW_SNAPSHOT_LIMITS = Object.freeze({
  maxDimension: 8192,
  maxPixels: 16_000_000,
  /** Encoded PNG bytes after Base64 decoding, not the decoded RGBA buffer. */
  maxPngBytes: 4 * 1024 * 1024,
});

/** Which of outline (line colour) and fill (fill colour) a shape paints. */
export type OutlineMode = 'outline' | 'fill' | 'both';

export interface TextStyle {
  fontFamily: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  /** Paint the text box with the fill colour before the text. */
  opaque: boolean;
}

export interface DrawOptions {
  lineWidth: number;
  outlineMode: OutlineMode;
  /** Left-button colour; outlines, pencil, brush, text. */
  lineColor: string;
  /** Right-button colour; fills, eraser, the colour a lifted selection leaves behind. */
  fillColor: string;
  text: TextStyle;
}

/** Modifier state handed to tools with every pointer event. */
export interface ToolPointer {
  /** Right button: swaps line and fill colours, as in MS Paint. */
  secondary: boolean;
  shift: boolean;
  alt: boolean;
}

export interface ToolHandler {
  down(p: Point, pointer: ToolPointer): void;
  move(p: Point, pointer: ToolPointer): void;
  up(p: Point, pointer: ToolPointer): void;
  /** Commit any multi-step work in progress (polygon, curve, text). */
  finish?(): void;
  /** Discard work in progress. */
  cancel?(): void;
  /** A curve/polygon remains unfinished between separate pointer gestures. */
  hasPendingWork?(): boolean;
  /** Pointer hover without a button held (curve/polygon rubber-banding). */
  hover?(p: Point): void;
  cursor?: string;
}

export const ZOOM_LEVELS = [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8] as const;

export const LINE_WIDTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18, 20, 25, 30, 35, 40, 45, 50] as const;

export const FONT_SIZES = [6, 7, 8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 32, 36, 40, 48, 56, 64, 72, 96, 128, 160, 192] as const;

/** MS Paint's classic palette, as PaintZ lists it. */
export const PALETTE: { name: string; hex: string }[] = [
  { name: 'Black', hex: '#000000' },
  { name: 'Brown', hex: '#795548' },
  { name: 'Red', hex: '#f44336' },
  { name: 'Orange', hex: '#ff9800' },
  { name: 'Yellow', hex: '#ffeb3b' },
  { name: 'Lime', hex: '#cddc39' },
  { name: 'White', hex: '#ffffff' },
  { name: 'Gray', hex: '#9e9e9e' },
  { name: 'Green', hex: '#4caf50' },
  { name: 'Light blue', hex: '#03a9f4' },
  { name: 'Blue', hex: '#3f51b5' },
  { name: 'Purple', hex: '#9c27b0' },
];

export const DEFAULT_DRAW_OPTIONS: DrawOptions = {
  lineWidth: 2,
  outlineMode: 'outline',
  lineColor: '#000000',
  fillColor: '#ffffff',
  text: { fontFamily: 'Inter, system-ui, sans-serif', fontSize: 16, bold: false, italic: false, underline: false, strike: false, opaque: false },
};
