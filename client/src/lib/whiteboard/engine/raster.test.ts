import { describe, expect, it } from 'vitest';
import { bresenham, dragRect, floodFill, hexToRgba, invertColors, pixelAt, rgbaToHex, snapAngle } from './raster';

/** A tiny board from ASCII art: `.` white, `#` black. */
function board(rows: string[]): ImageData {
  const width = rows[0]!.length;
  const height = rows.length;
  const data = new Uint8ClampedArray(width * height * 4);
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const i = (y * width + x) * 4;
      const v = ch === '#' ? 0 : 255;
      data[i] = data[i + 1] = data[i + 2] = v;
      data[i + 3] = 255;
    });
  });
  return { width, height, data, colorSpace: 'srgb' } as ImageData;
}

function ascii(image: ImageData): string[] {
  const rows: string[] = [];
  for (let y = 0; y < image.height; y += 1) {
    let row = '';
    for (let x = 0; x < image.width; x += 1) {
      const [r, g, b] = pixelAt(image, { x, y })!;
      row += r === 0 && g === 0 && b === 0 ? '#' : r === 255 && g === 0 && b === 0 ? 'R' : '.';
    }
    rows.push(row);
  }
  return rows;
}

describe('floodFill', () => {
  it('fills the enclosed region and nothing beyond the wall', () => {
    const image = board(['.....', '.###.', '.#.#.', '.###.', '.....']);
    expect(floodFill(image, { x: 2, y: 2 }, [255, 0, 0, 255])).toBe(true);
    expect(ascii(image)).toEqual(['.....', '.###.', '.#R#.', '.###.', '.....']);
  });

  it('flows around corners and through gaps but not diagonally', () => {
    const image = board(['..#..', '.##..', '#....', '.....']);
    floodFill(image, { x: 0, y: 0 }, [255, 0, 0, 255]);
    // Reachable orthogonally: (0,0), (1,0) and (0,1). The open area past the
    // wall touches only at diagonals, so it stays white.
    expect(ascii(image)).toEqual(['RR#..', 'R##..', '#....', '.....']);
  });

  it('returns false when the start pixel already has the colour', () => {
    const image = board(['..', '..']);
    expect(floodFill(image, { x: 0, y: 0 }, [255, 255, 255, 255])).toBe(false);
    expect(floodFill(image, { x: 5, y: 0 }, [255, 0, 0, 255])).toBe(false);
  });
});

describe('colours', () => {
  it('parses short and long hex and round-trips', () => {
    expect(hexToRgba('#f00')).toEqual([255, 0, 0, 255]);
    expect(hexToRgba('#1a2b3c')).toEqual([26, 43, 60, 255]);
    expect(rgbaToHex([26, 43, 60, 255])).toBe('#1a2b3c');
  });

  it('inverts every channel but alpha', () => {
    const image = board(['#.']);
    invertColors(image);
    expect(pixelAt(image, { x: 0, y: 0 })).toEqual([255, 255, 255, 255]);
    expect(pixelAt(image, { x: 1, y: 0 })).toEqual([0, 0, 0, 255]);
  });
});

describe('geometry', () => {
  it('walks every cell of a diagonal line once', () => {
    expect(bresenham({ x: 0, y: 0 }, { x: 3, y: 3 })).toEqual([
      { x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 },
    ]);
    expect(bresenham({ x: 2, y: 0 }, { x: 0, y: 0 }).map((p) => p.x)).toEqual([2, 1, 0]);
  });

  it('normalises drags and squares them on Shift', () => {
    expect(dragRect({ x: 10, y: 10 }, { x: 4, y: 20 })).toEqual({ x: 4, y: 10, width: 6, height: 10 });
    expect(dragRect({ x: 10, y: 10 }, { x: 4, y: 20 }, true)).toEqual({ x: 0, y: 10, width: 10, height: 10 });
  });

  it('snaps a shift-line to 45° steps', () => {
    const end = snapAngle({ x: 0, y: 0 }, { x: 10, y: 1 });
    expect(end.x).toBeCloseTo(Math.hypot(10, 1));
    expect(end.y).toBeCloseTo(0);
  });
});
