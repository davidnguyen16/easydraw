import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface GlyphGeometry {
  geometry: THREE.BufferGeometry;
  role: string;
  opacity: number;
  outline: boolean;
}

/** Turn the triangulated SVG ribbon into a closed solid. Stroke-only symbols
 * (constraints, swimlanes and system boundaries) must not disappear edge-on. */
function solidStroke(source: THREE.BufferGeometry, bottom: number, top: number): THREE.BufferGeometry {
  const flat = source.index ? source.toNonIndexed() : source;
  const sourcePositions = flat.getAttribute('position');
  const positions: number[] = [];
  const boundaries = new Map<string, { count: number; a: [number, number]; b: [number, number] }>();
  const key = (point: [number, number]) => `${Math.round(point[0] * 1e6)},${Math.round(point[1] * 1e6)}`;
  for (let index = 0; index < sourcePositions.count; index += 3) {
    const triangle = [0, 1, 2].map((offset) => [sourcePositions.getX(index + offset), sourcePositions.getY(index + offset)] as [number, number]);
    for (const point of triangle) positions.push(point[0], point[1], top);
    for (const point of [...triangle].reverse()) positions.push(point[0], point[1], bottom);
    for (let edge = 0; edge < 3; edge++) {
      const a = triangle[edge], b = triangle[(edge + 1) % 3];
      const edgeKey = [key(a), key(b)].sort().join('|');
      const boundary = boundaries.get(edgeKey);
      if (boundary) boundary.count++;
      else boundaries.set(edgeKey, { count: 1, a, b });
    }
  }
  for (const { count, a, b } of boundaries.values()) if (count === 1) {
    positions.push(a[0], a[1], top, a[0], a[1], bottom, b[0], b[1], bottom);
    positions.push(a[0], a[1], top, b[0], b[1], bottom, b[0], b[1], top);
  }
  const result = new THREE.BufferGeometry();
  result.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  result.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(positions.length / 3 * 2), 2));
  result.computeVertexNormals();
  if (flat !== source) flat.dispose();
  source.dispose();
  return result;
}

/** Extrudes the existing SVG catalog (including holes) into real solid meshes.
 * Similar paints are merged to avoid one draw call per glyph detail. Parsing is
 * client-only and accepts our generated catalog SVG, never user SVG/markup. */
export function buildGlyphGeometry(source: string, viewBox: [number, number, number, number], borderScale: number): GlyphGeometry[] {
  const parsed = new SVGLoader().parse(source);
  const strokeOnly = parsed.paths.every((path) => (path.userData.style as { fill?: string }).fill === 'none');
  const [left, top, width, height] = viewBox;
  const buckets = new Map<string, { role: string; opacity: number; outline: boolean; geometries: THREE.BufferGeometry[] }>();
  const append = (geometry: THREE.BufferGeometry, role: string, opacity: number, outline: boolean) => {
    geometry.translate(-left - width / 2, -top - height / 2, 0);
    geometry.scale(1 / width, 1 / height, 1);
    const key = `${role}:${opacity}:${outline}`;
    const bucket = buckets.get(key) ?? { role, opacity, outline, geometries: [] };
    bucket.geometries.push(geometry);
    buckets.set(key, bucket);
  };
  parsed.paths.forEach((path, index) => {
    const element = path.userData.node as Element;
    const style = path.userData.style as {
      opacity?: number; fill?: string; stroke?: string; strokeWidth?: number;
      strokeLineJoin?: string; strokeLineCap?: string; strokeMiterLimit?: number;
    };
    // Ordered details sit just above their body, preserving ports, folds,
    // lifelines and field separators without coplanar z-fighting.
    const surface = 0.4 + index / Math.max(1, parsed.paths.length) * 0.08;
    const opacity = Number.isFinite(Number(style.opacity)) ? Number(style.opacity) : 1;
    if (style.fill !== 'none') {
      for (const shape of path.toShapes()) {
        const geometry = new THREE.ExtrudeGeometry(shape, { depth: surface + 0.5, bevelEnabled: false, curveSegments: 12, steps: 1 });
        geometry.translate(0, 0, -0.5);
        append(geometry, element.getAttribute('data-fill') ?? 'surface', opacity, true);
      }
    }
    if (style.stroke !== 'none' && borderScale > 0) {
      const strokeStyle = SVGLoader.getStrokeStyle(Number(style.strokeWidth ?? 1.5) * borderScale, '#000000', style.strokeLineJoin, style.strokeLineCap, style.strokeMiterLimit);
      for (const subpath of path.subPaths) {
        const points = subpath.getPoints(24);
        const dash = (element.getAttribute('stroke-dasharray') ?? '').split(/[ ,]+/).map(Number).filter((value) => value > 0);
        const segments: THREE.Vector2[][] = [];
        if (!dash.length) segments.push(points);
        else {
          // Preserve sequence lifeline and container dash semantics in 3D.
          let dashIndex = 0, remaining = dash[0];
          for (let i = 1; i < points.length; i++) {
            let cursor = points[i - 1].clone();
            const finish = points[i];
            while (cursor.distanceTo(finish) > 1e-6) {
              const step = Math.min(remaining, cursor.distanceTo(finish));
              const next = cursor.clone().lerp(finish, step / cursor.distanceTo(finish));
              if (dashIndex % 2 === 0) segments.push([cursor, next]);
              remaining -= step;
              cursor = next;
              if (remaining < 1e-6) { dashIndex = (dashIndex + 1) % dash.length; remaining = dash[dashIndex]; }
            }
          }
        }
        for (const segment of segments) {
          if (segment.length < 2) continue;
          const geometry = SVGLoader.pointsToStroke(segment, strokeStyle, 6);
          if (!geometry) continue;
          const solid = solidStroke(geometry, strokeOnly ? -0.5 : surface, surface + 0.01);
          append(solid, element.getAttribute('data-stroke') ?? 'ink', opacity, false);
        }
      }
    }
  });
  return [...buckets.values()].map(({ geometries, ...paint }) => {
    const geometry = mergeGeometries(geometries, false);
    for (const source of geometries) source.dispose();
    return { ...paint, geometry };
  });
}
