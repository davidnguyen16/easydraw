/**
 * Pure pixel operations on `ImageData`. Nothing here touches a canvas, so
 * these run under Vitest and are the parts of a paint program worth
 * testing exactly: the flood fill's reach and colour matching, inversion,
 * colour parsing.
 */
import type { Point } from './types';

export type Rgba = [number, number, number, number];

export function hexToRgba(hex: string): Rgba {
  let v = hex.trim().replace(/^#/, '');
  if (v.length === 3 || v.length === 4) v = v.split('').map((c) => c + c).join('');
  const n = parseInt(v.slice(0, 6), 16);
  const alpha = v.length === 8 ? parseInt(v.slice(6, 8), 16) : 255;
  if (!Number.isFinite(n)) return [0, 0, 0, 255];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, Number.isFinite(alpha) ? alpha : 255];
}

export function rgbaToHex([r, g, b]: Rgba): string {
  return '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('');
}

/**
 * Scanline flood fill from `start`, replacing the contiguous run of pixels
 * that exactly match the start pixel with `color`. Returns false when the
 * start pixel already has that colour (nothing to do), so callers can skip
 * an undo entry.
 */
export function floodFill(image: ImageData, start: Point, color: Rgba): boolean {
  const { width, height, data } = image;
  const sx = Math.floor(start.x);
  const sy = Math.floor(start.y);
  if (sx < 0 || sy < 0 || sx >= width || sy >= height) return false;
  const pixels = new Uint32Array(data.buffer, data.byteOffset, width * height);
  const target = pixels[sy * width + sx]!;
  const replacement = packRgba(color);
  if (target === replacement) return false;

  const stack: number[] = [sx, sy];
  while (stack.length) {
    const y = stack.pop()!;
    let x = stack.pop()!;
    const row = y * width;
    // Walk left to the start of this run.
    while (x > 0 && pixels[row + x - 1] === target) x -= 1;
    let spanAbove = false;
    let spanBelow = false;
    while (x < width && pixels[row + x] === target) {
      pixels[row + x] = replacement;
      if (y > 0) {
        const above = pixels[row - width + x] === target;
        if (above && !spanAbove) {
          stack.push(x, y - 1);
          spanAbove = true;
        } else if (!above) spanAbove = false;
      }
      if (y < height - 1) {
        const below = pixels[row + width + x] === target;
        if (below && !spanBelow) {
          stack.push(x, y + 1);
          spanBelow = true;
        } else if (!below) spanBelow = false;
      }
      x += 1;
    }
  }
  return true;
}

/** Packs RGBA into the platform's native Uint32 byte order (little-endian on every browser we ship to). */
function packRgba([r, g, b, a]: Rgba): number {
  return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

export function invertColors(image: ImageData): void {
  const { data } = image;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255 - data[i]!;
    data[i + 1] = 255 - data[i + 1]!;
    data[i + 2] = 255 - data[i + 2]!;
  }
}

export function pixelAt(image: ImageData, p: Point): Rgba | null {
  const x = Math.floor(p.x);
  const y = Math.floor(p.y);
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return null;
  const i = (y * image.width + x) * 4;
  return [image.data[i]!, image.data[i + 1]!, image.data[i + 2]!, image.data[i + 3]!];
}

/** Integer pixel cells between two points (Bresenham), inclusive of both ends. */
export function bresenham(from: Point, to: Point): Point[] {
  let x0 = Math.round(from.x);
  let y0 = Math.round(from.y);
  const x1 = Math.round(to.x);
  const y1 = Math.round(to.y);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  const out: Point[] = [];
  for (let guard = 0; guard < 1_000_000; guard += 1) {
    out.push({ x: x0, y: y0 });
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
  return out;
}

/** Normalises a drag into a rectangle with non-negative size; Shift makes it square. */
export function dragRect(from: Point, to: Point, square = false): { x: number; y: number; width: number; height: number } {
  let dx = to.x - from.x;
  let dy = to.y - from.y;
  if (square) {
    const side = Math.max(Math.abs(dx), Math.abs(dy));
    dx = Math.sign(dx || 1) * side;
    dy = Math.sign(dy || 1) * side;
  }
  return {
    x: Math.min(from.x, from.x + dx),
    y: Math.min(from.y, from.y + dy),
    width: Math.abs(dx),
    height: Math.abs(dy),
  };
}

/** Snaps a line end to the nearest 45° from `from` (Shift-drag lines). */
export function snapAngle(from: Point, to: Point): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return to;
  const step = Math.PI / 4;
  const angle = Math.round(Math.atan2(dy, dx) / step) * step;
  return { x: from.x + Math.cos(angle) * length, y: from.y + Math.sin(angle) * length };
}
