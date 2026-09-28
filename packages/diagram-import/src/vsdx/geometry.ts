/**
 * Recognises a Visio Geometry section as one of EasyDraw's shapes.
 *
 * Visio describes every outline as rows (MoveTo, LineTo, ArcTo, …) in the
 * shape's local inches, or `Rel*` rows in fractions of its width and height.
 * Everything is normalised to a unit box with y pointing down — EasyDraw's
 * frame — and then compared against the silhouettes the editor can draw.
 */
import type { Point } from '../document.js';

export interface GeometryRow {
  type: string;
  x: number;
  y: number;
}

export interface GeometrySection {
  rows: GeometryRow[];
  /** True when the rows are `Rel*` (already 0..1). */
  relative: boolean;
}

export interface GeometryMatch {
  type: string;
  approximate: boolean;
}

const TOLERANCE = 0.08;

/** A section that draws something: a path of two or more rows, or one ellipse. */
export function isOutline(section: GeometrySection): boolean {
  return section.rows.length > 1 || section.rows.some((r) => /Ellipse$/.test(r.type));
}

export function classifyGeometry(sections: GeometrySection[], width: number, height: number, rounded: boolean): GeometryMatch | null {
  const section = sections.find(isOutline);
  if (!section) return null;

  const kinds = new Set(section.rows.map((r) => r.type.replace(/^Rel/, '')));
  const lines = section.rows.filter((r) => /LineTo$/.test(r.type)).length;
  const arcs = section.rows.filter((r) => /(EllipticalArcTo|ArcTo)$/.test(r.type)).length;
  const curves = section.rows.filter((r) => /(NURBSTo|SplineKnot|SplineStart|PolylineTo)$/.test(r.type)).length;

  if (kinds.has('Ellipse')) return { type: nearlySquare(width, height) ? 'CircleNode' : 'EllipseNode', approximate: false };
  if (arcs > 0 && lines === 0) return { type: nearlySquare(width, height) ? 'CircleNode' : 'EllipseNode', approximate: false };
  if (arcs === 2 && lines === 2) return { type: 'TerminatorNode', approximate: false };
  if (curves > 0 && lines === 3) return { type: 'DocumentNode', approximate: false };
  if (arcs > 0 && lines >= 2 && lines <= 3) return { type: 'DatabaseNode', approximate: true };

  const points = polygonOf(section, width, height);
  if (!points) return null;
  const polygon = matchPolygon(points);
  if (!polygon) return null;
  if (polygon === 'RectangleNode' && rounded) return { type: 'RoundedRectangleNode', approximate: false };
  return { type: polygon, approximate: false };
}

function nearlySquare(width: number, height: number): boolean {
  return Math.abs(width - height) <= Math.max(width, height) * 0.02;
}

/** Unit-box vertices (y down), or null when the outline is not a polygon. */
function polygonOf(section: GeometrySection, width: number, height: number): Point[] | null {
  const raw: Point[] = [];
  for (const row of section.rows) {
    if (!/(MoveTo|LineTo)$/.test(row.type)) return null;
    const x = section.relative ? row.x : row.x / (width || 1);
    const y = section.relative ? row.y : row.y / (height || 1);
    raw.push({ x, y: 1 - y });
  }
  const points: Point[] = [];
  for (const p of raw) {
    const last = points[points.length - 1];
    if (!last || Math.hypot(last.x - p.x, last.y - p.y) > 1e-3) points.push(p);
  }
  const first = points[0];
  const last = points[points.length - 1];
  if (points.length > 2 && first && last && Math.hypot(first.x - last.x, first.y - last.y) < 1e-3) points.pop();
  return points.length >= 3 ? points : null;
}

const near = (a: number, b: number) => Math.abs(a - b) <= TOLERANCE;
const has = (points: Point[], x: number, y: number) => points.some((p) => near(p.x, x) && near(p.y, y));

function matchPolygon(points: Point[]): string | null {
  const n = points.length;
  const corners = [has(points, 0, 0), has(points, 1, 0), has(points, 1, 1), has(points, 0, 1)].filter(Boolean).length;
  const edgeMids = [has(points, 0.5, 0), has(points, 1, 0.5), has(points, 0.5, 1), has(points, 0, 0.5)].filter(Boolean).length;

  if (n === 4 && corners === 4) return 'RectangleNode';
  if (n === 4 && edgeMids === 4) return 'DiamondNode';
  if (n === 3) {
    if (has(points, 0.5, 0) && has(points, 0, 1) && has(points, 1, 1)) return 'TriangleNode';
    if (corners === 3) return 'OrthogonalTriangleNode';
    return 'TriangleNode';
  }
  if (n === 4) {
    const top = points.filter((p) => near(p.y, 0)).sort((a, b) => a.x - b.x);
    const bottom = points.filter((p) => near(p.y, 1)).sort((a, b) => a.x - b.x);
    if (top.length === 2 && bottom.length === 2) {
      const [t0, t1] = top as [Point, Point];
      const [b0, b1] = bottom as [Point, Point];
      const topInset = near(t0.x, 0) ? 0 : t0.x;
      const bottomInset = near(b0.x, 0) ? 0 : b0.x;
      const topRightInset = near(t1.x, 1) ? 0 : 1 - t1.x;
      const bottomRightInset = near(b1.x, 1) ? 0 : 1 - b1.x;
      // Both slanted sides lean the same way: parallelogram; opposite: trapezoid.
      if (near(topInset, bottomRightInset) && near(bottomInset, topRightInset) && topInset > TOLERANCE) return 'ParallelogramNode';
      if (near(topInset, topRightInset) && near(bottomInset, bottomRightInset) && !near(topInset, bottomInset)) return 'TrapezoidNode';
    }
    return null;
  }
  if (n === 5 && has(points, 0.5, 0)) return 'PentagonNode';
  if (n === 6 && has(points, 0, 0.5) && has(points, 1, 0.5)) return 'PolygonNode';
  if (n === 6 && has(points, 0, 0) && has(points, 0, 1) && has(points, 1, 0.5)) return 'ChevronNode';
  if (n === 8) return 'OctagonNode';
  if (n === 10 && edgeMids >= 1) return 'StarNode';
  return null;
}
