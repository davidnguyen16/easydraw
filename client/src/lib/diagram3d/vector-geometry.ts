import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { FlatArtworkPlan } from './flat-artwork';

export type VectorArtworkPlan = Extract<FlatArtworkPlan, { kind: 'vector' }>;
export interface VectorGeometryPart {
  geometry: THREE.BufferGeometry;
  paint: 'fill' | 'stroke';
}
export interface VectorGeometryResult {
  parts: VectorGeometryPart[];
  stats: { sampledPoints: number; strokePieces: number; shapes: number; holes: number; vertices: number };
  /** Keep unusual/over-budget artwork faithful using the existing planar renderer. */
  fallbackReason?: string;
}

export const VECTOR_3D_LIMITS = Object.freeze({
  curveSegments: 24,
  maxSampledPoints: 1536,
  maxStrokePieces: 256,
  maxVertices: 65_536,
  radialSegments: 8,
});

interface Subpath { points: THREE.Vector2[]; closed: boolean; drawn: boolean }
const EPSILON = 1e-9;
const visible = (paint: string) => !['none', 'transparent'].includes(paint.toLowerCase());

function samplePaths(plan: VectorArtworkPlan): Subpath[] {
  const paths: Subpath[] = [];
  let current: Subpath | undefined;
  const append = (point: THREE.Vector2) => {
    if (current && (!current.points.length || current.points.at(-1)!.distanceToSquared(point) > EPSILON ** 2)) {
      current.points.push(point);
    }
  };
  for (const { op, values: v } of plan.commands) {
    if (op === 'M') {
      current = { points: [new THREE.Vector2(v[0], v[1])], closed: false, drawn: false };
      paths.push(current);
      continue;
    }
    if (!current) continue;
    current.drawn = true;
    if (op === 'Z') {
      current.closed = true;
      append(current.points[0].clone());
      continue;
    }
    const start = current.points.at(-1)!;
    if (op === 'L') append(new THREE.Vector2(v[0], v[1]));
    else {
      const curve = op === 'Q'
        ? new THREE.QuadraticBezierCurve(start, new THREE.Vector2(v[0], v[1]), new THREE.Vector2(v[2], v[3]))
        : new THREE.CubicBezierCurve(start, new THREE.Vector2(v[0], v[1]), new THREE.Vector2(v[2], v[3]), new THREE.Vector2(v[4], v[5]));
      for (let index = 1; index <= VECTOR_3D_LIMITS.curveSegments; index++) {
        append(curve.getPoint(index / VECTOR_3D_LIMITS.curveSegments));
      }
    }
  }
  return paths.filter((path) => path.drawn);
}

/** Dash phase continues across segments of one subpath, but restarts at each M,
 * matching the 2D canvas. Never silently truncate a long dashed illustration. */
function dashPaths(paths: Subpath[], dashArray: string | undefined): Subpath[] | null {
  if (!dashArray) return paths;
  let pattern = dashArray.split(/[ ,]+/).map(Number);
  if (!pattern.length || pattern.some((length) => !Number.isFinite(length) || length <= 0)) return null;
  if (pattern.length % 2) pattern = pattern.concat(pattern);
  const result: Subpath[] = [];
  for (const path of paths) {
    if (path.points.length === 1) { result.push(path); continue; }
    let patternIndex = 0, remaining = pattern[0];
    let piece: Subpath | undefined;
    for (let index = 1; index < path.points.length; index++) {
      let cursor = path.points[index - 1].clone();
      const target = path.points[index];
      let distance = cursor.distanceTo(target);
      while (distance > EPSILON) {
        const step = Math.min(remaining, distance);
        const next = cursor.clone().lerp(target, step / distance);
        if (patternIndex % 2 === 0) {
          if (!piece) {
            if (result.length >= VECTOR_3D_LIMITS.maxStrokePieces) return null;
            piece = { points: [cursor], closed: false, drawn: true };
            result.push(piece);
          }
          piece.points.push(next);
        }
        remaining -= step;
        cursor = next;
        distance = cursor.distanceTo(target);
        if (remaining <= EPSILON) {
          piece = undefined;
          patternIndex = (patternIndex + 1) % pattern.length;
          remaining = pattern[patternIndex];
        }
      }
    }
  }
  return result;
}

/** A Frenet frame is undefined at a 180-degree reversal and a long straight
 * segment must not taper toward the averaged tangent at a sharp corner. Split
 * there and join the independently framed tube runs with round end caps. */
function splitSharpPaths(paths: Subpath[]): Subpath[] | null {
  const result: Subpath[] = [];
  for (const path of paths) {
    const points = path.points;
    const count = path.closed && points.length > 1 ? points.length - 1 : points.length;
    if (count < 2) { result.push(path); continue; }
    const corners: number[] = [];
    for (let index = path.closed ? 0 : 1; index < (path.closed ? count : count - 1); index++) {
      const before = points[(index + count - 1) % count];
      const current = points[index], after = points[(index + 1) % count];
      const incoming = current.clone().sub(before).normalize();
      const outgoing = after.clone().sub(current).normalize();
      if (incoming.dot(outgoing) < 0.85) corners.push(index);
    }
    if (!corners.length) result.push(path);
    else if (!path.closed) {
      const boundaries = [0, ...corners, count - 1];
      for (let index = 1; index < boundaries.length; index++) result.push({
        points: points.slice(boundaries[index - 1], boundaries[index] + 1), closed: false, drawn: true,
      });
    } else {
      for (let index = 0; index < corners.length; index++) {
        const start = corners[index], end = corners[(index + 1) % corners.length];
        const length = (end - start + count) % count || count;
        result.push({ points: Array.from({ length: length + 1 }, (_, offset) => points[(start + offset) % count]),
          closed: false, drawn: true });
      }
    }
    if (result.length > VECTOR_3D_LIMITS.maxStrokePieces) return null;
  }
  return result;
}

/** ShapePath handles nested contours and nonzero winding, but its triangulator
 * does not resolve self-intersections/partially overlapping filled contours.
 * Preserve such artwork as a plane instead of inventing an incorrect solid. */
function hasCrossingFills(paths: Subpath[]): boolean {
  const segments = paths.flatMap((path, pathIndex) => {
    const points = path.points;
    const count = points.length > 1 && points[0].distanceToSquared(points.at(-1)!) < EPSILON ** 2
      ? points.length - 1 : points.length;
    if (count < 3) return [];
    return Array.from({ length: count }, (_, index) => ({
      a: points[index], b: points[(index + 1) % count], pathIndex, index, count,
    }));
  });
  const cross = (a: THREE.Vector2, b: THREE.Vector2, c: THREE.Vector2) =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  for (let i = 0; i < segments.length; i++) for (let j = i + 1; j < segments.length; j++) {
    const first = segments[i], second = segments[j];
    if (first.pathIndex === second.pathIndex && (Math.abs(first.index - second.index) === 1 ||
      Math.abs(first.index - second.index) === first.count - 1)) continue;
    const { a, b } = first, { a: c, b: d } = second;
    if (Math.max(a.x, b.x) < Math.min(c.x, d.x) || Math.max(c.x, d.x) < Math.min(a.x, b.x) ||
      Math.max(a.y, b.y) < Math.min(c.y, d.y) || Math.max(c.y, d.y) < Math.min(a.y, b.y)) continue;
    if (cross(a, b, c) * cross(a, b, d) <= 0 && cross(c, d, a) * cross(c, d, b) <= 0) return true;
  }
  return false;
}

/** Index-based interpolation ensures TubeGeometry samples every authored corner
 * exactly. Its default arc-length sampling could skip a short corner entirely. */
class SampledPath extends THREE.Curve<THREE.Vector3> {
  constructor(private readonly points: THREE.Vector3[]) { super(); }
  getPoint(t: number, target = new THREE.Vector3()) {
    const offset = Math.max(0, Math.min(1, t)) * (this.points.length - 1);
    const index = Math.min(this.points.length - 2, Math.floor(offset));
    return target.copy(this.points[index]).lerp(this.points[index + 1], offset - index);
  }
  getPointAt(t: number, target = new THREE.Vector3()) { return this.getPoint(t, target); }
  getTangentAt(t: number, target = new THREE.Vector3()) { return this.getTangent(t, target); }
}

function extrude(shape: THREE.Shape, depth: number, centerY = 0): THREE.BufferGeometry {
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, steps: 1, bevelEnabled: false, curveSegments: 1 });
  // Shape coordinates are x/-z. Rotation produces the same x/z footprint as 2D.
  geometry.translate(0, 0, -depth / 2);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, centerY, 0);
  return geometry;
}

/** All input commands have already passed diagram-schema validation. Nothing is
 * executed, parsed as markup, fetched, or written back to the stored document.
 * Width stays in 2D pixels / 100; depth only scales the rounded vertical section. */
export function buildVectorArtworkGeometry(plan: VectorArtworkPlan, requestedDepth: number): VectorGeometryResult {
  const stats = { sampledPoints: 0, strokePieces: 0, shapes: 0, holes: 0, vertices: 0 };
  const buckets: Record<'fill' | 'stroke', THREE.BufferGeometry[]> = { fill: [], stroke: [] };
  const fallback = (reason: string): VectorGeometryResult => {
    for (const geometry of [...buckets.fill, ...buckets.stroke]) geometry.dispose();
    return { parts: [], stats, fallbackReason: reason };
  };
  const depth = Number.isFinite(requestedDepth) ? Math.max(0.02, Math.min(1000, requestedDepth)) : 0.08;
  const paths = samplePaths(plan);
  stats.sampledPoints = paths.reduce((sum, path) => sum + path.points.length, 0);
  if (stats.sampledPoints > VECTOR_3D_LIMITS.maxSampledPoints) return fallback('Path detail exceeds the solid geometry budget.');
  const world = (point: THREE.Vector2) => new THREE.Vector3((point.x - plan.width / 2) / 100, 0, (point.y - plan.height / 2) / 100);
  const shapePoint = (point: THREE.Vector2) => new THREE.Vector2((point.x - plan.width / 2) / 100, -(point.y - plan.height / 2) / 100);
  const append = (source: THREE.BufferGeometry, paint: 'fill' | 'stroke') => {
    // One material per paint, regardless of how many subpaths/dashes it contains.
    const geometry = source.index ? source.toNonIndexed() : source;
    if (geometry !== source) source.dispose();
    stats.vertices += geometry.getAttribute('position').count;
    buckets[paint].push(geometry);
    return stats.vertices <= VECTOR_3D_LIMITS.maxVertices;
  };
  const fill = visible(plan.appearance.fill);
  const stroke = visible(plan.appearance.stroke) && plan.appearance.strokeWidth > 0;
  if (fill) {
    if (hasCrossingFills(paths)) return fallback('Overlapping filled contours are preserved as planar artwork.');
    const shapePath = new THREE.ShapePath();
    for (const path of paths) {
      if (path.points.length < 3) continue;
      const points = path.points.map(shapePoint);
      shapePath.moveTo(points[0].x, points[0].y);
      for (const point of points.slice(1)) shapePath.lineTo(point.x, point.y);
      // Canvas fill implicitly closes even an open subpath; its stroke stays open.
      shapePath.currentPath!.closePath();
    }
    for (const shape of shapePath.toShapes()) {
      stats.shapes++;
      stats.holes += shape.holes.length;
      // Leave the top quarter for the border, avoiding a coplanar stroke/fill.
      if (!append(extrude(shape, stroke ? depth * 0.75 : depth, stroke ? -depth * 0.125 : 0), 'fill')) {
        return fallback('Filled geometry exceeds the solid geometry budget.');
      }
    }
  }
  if (stroke) {
    const dashed = dashPaths(paths, plan.appearance.dashArray);
    const pieces = dashed && splitSharpPaths(dashed);
    if (!pieces || pieces.length > VECTOR_3D_LIMITS.maxStrokePieces) return fallback('Dash detail exceeds the solid geometry budget.');
    stats.strokePieces = pieces.length;
    const radius = plan.appearance.strokeWidth / 200;
    const strokeDepth = stats.shapes > 0 ? depth * 0.25 : depth;
    const centerY = stats.shapes > 0 ? depth * 0.375 : 0;
    const capped = new Set<string>();
    const cap = (point: THREE.Vector3) => {
      const key = `${point.x},${point.z}`;
      // Adjacent runs share one join, including the seam of a closed contour.
      if (capped.has(key)) return true;
      capped.add(key);
      const geometry = new THREE.SphereGeometry(radius, VECTOR_3D_LIMITS.radialSegments, 4);
      geometry.scale(1, strokeDepth / (2 * radius), 1);
      geometry.translate(point.x, centerY, point.z);
      return append(geometry, 'stroke');
    };
    for (const piece of pieces) {
      const points = piece.points.map(world);
      if (points.length > 1) {
        const geometry = new THREE.TubeGeometry(new SampledPath(points), points.length - 1, radius, VECTOR_3D_LIMITS.radialSegments, piece.closed);
        geometry.scale(1, strokeDepth / (2 * radius), 1);
        geometry.translate(0, centerY, 0);
        if (!append(geometry, 'stroke')) return fallback('Stroke geometry exceeds the solid geometry budget.');
      }
      if (!piece.closed && (!cap(points[0]) || points.length > 1 && !cap(points.at(-1)!))) {
        return fallback('Stroke caps exceed the solid geometry budget.');
      }
    }
    for (const triangle of plan.arrows) {
      const shape = new THREE.Shape(triangle.map(([x, y]) => shapePoint(new THREE.Vector2(x, y))));
      if (!append(extrude(shape, strokeDepth, centerY), 'stroke')) return fallback('Arrow geometry exceeds the solid geometry budget.');
    }
  }
  const parts: VectorGeometryPart[] = [];
  for (const paint of ['fill', 'stroke'] as const) {
    if (!buckets[paint].length) continue;
    const geometry = mergeGeometries(buckets[paint], false);
    for (const source of buckets[paint]) source.dispose();
    geometry.computeBoundingBox();
    parts.push({ geometry, paint });
  }
  return { parts, stats };
}
