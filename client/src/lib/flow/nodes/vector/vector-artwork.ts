import { isVectorGeometry, type VectorGeometry } from '@easydraw/diagram-schema';

/** Never allow SVG paint servers, external URLs, or arbitrary CSS from data. */
export function safeArtworkColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^(?:#[\da-f]{6}|none|transparent)$/i.test(value) ? value : fallback;
}

export function artworkOpacity(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(100, value)) / 100 : 1;
}

export function artworkDimension(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.min(100_000, value) : fallback;
}

export function vectorArrowSize(strokeWidth: number): number { return Math.max(7, strokeWidth * 4); }

export function resolveVectorAppearance(geometry: VectorGeometry, data: Record<string, unknown>) {
  const strokeWidth = typeof data.borderWidth === 'number' && Number.isFinite(data.borderWidth)
    ? Math.max(0, Math.min(12, data.borderWidth)) : geometry.strokeWidth;
  const dash = geometry.dash;
  return {
    stroke: safeArtworkColor(data.borderColor, geometry.stroke),
    fill: safeArtworkColor(data.fillColor, geometry.fill),
    strokeWidth,
    dashArray: dash === 'dashed' ? '8 5' : dash === 'dotted' ? '1 5' : undefined,
    opacity: artworkOpacity(data.opacity),
  };
}

/** Scale only validated numeric coordinates, not raw SVG strings. Stroke width
 * stays in display pixels, including when a node is resized. */
export function vectorCommandsInBox(geometry: unknown, width: number, height: number): VectorGeometry['commands'] {
  if (!isVectorGeometry(geometry)) return [];
  const w = artworkDimension(width, 160);
  const h = artworkDimension(height, 80);
  return geometry.commands.map((command) => ({ ...command,
    values: command.values.map((value, index) => value * (index % 2 === 0 ? w : h) / 1000),
  }));
}

export function vectorPathInBox(geometry: unknown, width: number, height: number): string {
  return vectorCommandsInBox(geometry, width, height)
    .map((command) => `${command.op}${command.values.join(' ')}`).join(' ');
}
