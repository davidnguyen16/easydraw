import type { Edge, Node } from '@xyflow/react';

export type Vec3 = [number, number, number];

export interface DiagramSceneNode {
  id: string;
  type: string;
  data: Record<string, unknown>;
  selected: boolean;
  locked: boolean;
  label: string;
  details: string[];
  kind: 'box' | 'cylinder' | 'sphere' | 'diamond' | 'cone' | 'actor' | 'plane';
  position: Vec3;
  rotation: Vec3;
  size: Vec3;
  color: string;
  textColor: string;
}

export interface DiagramSceneEdge {
  id: string;
  data: Record<string, unknown>;
  selected: boolean;
  points: Vec3[];
  bendPoints: Vec3[];
  labels: { id: string; text: string; t: number }[];
  color: string;
  width: number;
  dashed: boolean;
  lineStyle: 'solid' | 'dashed' | 'dotted' | 'double';
  markerStart: string;
  markerEnd: string;
}

export interface DiagramSceneModel {
  nodes: DiagramSceneNode[];
  edges: DiagramSceneEdge[];
  center: Vec3;
  /** Diagram-world offset subtracted from positions; freeze per page while editing. */
  origin: Vec3;
  radius: number;
  warnings: string[];
}

type RecordData = Record<string, unknown>;
type Point = { x: number; y: number; z?: number };
type Bounds = { left: number; top: number; width: number; depth: number; elevation: number; hidden: boolean };

const SCALE = 100;
const MAX_COORDINATE = 10_000_000;
const ANCHOR_TYPES = new Set(['connection-anchor', 'ConnectionAnchorNode']);
const PLANES = new Set([
  'group', 'TextNode', 'CustomImageNode', 'VectorPathNode', 'SourceImageNode', 'UmlSystemBoundaryNode',
  'UmlCombinedFragmentNode', 'UmlActivityPartitionNode',
]);

function record(value: unknown): RecordData {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as RecordData : {};
}

/** Editor callbacks can exist in data, so structuredClone is not safe here. */
function copyData(value: RecordData): RecordData {
  const seen = new WeakMap<object, unknown>();
  function copy(item: unknown): unknown {
    if (!item || typeof item !== 'object') return item;
    if (seen.has(item)) return seen.get(item);
    if (Array.isArray(item)) {
      const result: unknown[] = [];
      seen.set(item, result);
      for (const child of item) result.push(copy(child));
      return result;
    }
    const result: RecordData = {};
    seen.set(item, result);
    for (const [key, child] of Object.entries(item)) {
      Object.defineProperty(result, key, { value: copy(child), enumerable: true, writable: true, configurable: true });
    }
    return result;
  }
  return copy(value) as RecordData;
}

function finite(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Visible vector caps/markers extend beyond their editable 2D box. Include
 * that ink in fit bounds without changing the actual node size or coordinates.
 * The conservative pixel padding matches the numeric artwork renderer. */
export function sceneNodeHalfExtents(node: DiagramSceneNode): Vec3 {
  const half = node.size.map((size) => size / 2) as Vec3;
  if (node.type !== 'VectorPathNode') return half;
  const vector = record(node.data.vector);
  const strokeWidth = Math.max(0, Math.min(12, finite(node.data.borderWidth, finite(vector.strokeWidth))));
  const arrow = vector.startArrow === true || vector.endArrow === true ? Math.max(7, strokeWidth * 4) : 0;
  const padding = Math.ceil(strokeWidth / 2 + arrow + 2) / SCALE;
  half[0] += padding;
  half[2] += padding;
  return half;
}

function coordinate(value: unknown): number {
  return Math.max(-MAX_COORDINATE, Math.min(MAX_COORDINATE, finite(value)));
}

function dimension(...values: unknown[]): number {
  return dimensionAtLeast(2, ...values);
}

function dimensionAtLeast(minimum: number, ...values: unknown[]): number {
  for (const value of values) {
    const number = typeof value === 'string' && /^\d+(\.\d+)?(px)?$/.test(value)
      ? Number.parseFloat(value) : finite(value);
    if (number > 0) return Math.max(minimum, Math.min(100_000, number));
  }
  return 100;
}

function text(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
}

function color(value: unknown, fallback: string): string {
  // CSS variables/currentColor need the DOM and cannot be interpreted by Three.Color.
  return typeof value === 'string' && /^(#[\da-f]{3,8}|[a-z]+|(?:rgb|hsl)a?\([\d\s.,%+-]+\))$/i.test(value)
    && !['transparent', 'none', 'currentcolor', 'inherit'].includes(value.toLowerCase()) ? value : fallback;
}

function kindFor(type = ''): DiagramSceneNode['kind'] {
  if (PLANES.has(type)) return 'plane';
  if (type === 'ActorNode') return 'actor';
  if (/Database|Storage/.test(type)) return 'cylinder';
  if (/Diamond|Decision/.test(type)) return 'diamond';
  if (/Triangle/.test(type)) return 'cone';
  if (/Circle|Ellipse|Donut|Cloud|Internet|UmlInitial|UmlFinal|UseCase/.test(type)) return 'sphere';
  return 'box';
}

function defaultDimensions(node: Node, data: RecordData): [number, number] {
  const type = node.type ?? '';
  if (ANCHOR_TYPES.has(type)) return [12, 12];
  if (type === 'TextNode') return [160, 40];
  if (type === 'CustomImageNode') {
    const imageWidth = dimension(data.intrinsicWidth);
    const imageHeight = dimension(data.intrinsicHeight);
    const scale = Math.min(1, 180 / Math.max(imageWidth, imageHeight));
    return [Math.max(24, imageWidth * scale), Math.max(24, imageHeight * scale)];
  }
  if (PLANES.has(type)) return [320, 220];
  if (/EntityNode$/.test(type)) return [200, 50 + (Array.isArray(data.fields) ? data.fields.length : 3) * 28];
  if (type === 'ActorNode') return [80, 120];
  if (type === 'DatabaseNode') return [150, 180];
  if (type === 'EllipseNode') return [180, 100];
  if (type === 'HalfCircleNode') return [160, 90];
  if (type === 'TriangleNode') return [140, 120];
  if (type === 'DonutNode') return [140, 140];
  if (type === 'DropNode') return [120, 150];
  if (type === 'PolygonNode') return [160, 100];
  if (type === 'StarNode' || type === 'PentagonNode') return [130, 125];
  if (type === 'ParallelogramNode') return [200, 100];
  if (/Circle|Diamond|Square|Triangle|Octagon/.test(type)) return [120, 120];
  if (type === 'CubeNode') return [165, 165];
  return [180, 100];
}

function fieldDetails(data: RecordData): string[] {
  if (!Array.isArray(data.fields)) return [];
  return data.fields.map((value) => {
    const field = record(value);
    const key = text(field.key) ?? (field.isPK ? 'PK' : field.isFK ? 'FK' : '');
    const optional = text(field.optionalKey);
    const keys = [key, optional].filter(Boolean).join(', ');
    const name = text(field.name) ?? '';
    const fieldType = data.showDataTypes === true ? text(field.type) : undefined;
    return `${keys ? `[${keys}] ` : ''}${name}${fieldType ? `: ${fieldType}` : ''}`;
  });
}

/** Matches Three's default Euler XYZ order without loading Three into the model. */
function rotate(point: Vec3, rotation: Vec3, inverse = false): Vec3 {
  let [x, y, z] = point;
  const axes = inverse ? [0, 1, 2] : [2, 1, 0];
  for (const axis of axes) {
    const angle = rotation[axis] * (inverse ? -1 : 1);
    const c = Math.cos(angle), s = Math.sin(angle);
    if (axis === 0) [y, z] = [y * c - z * s, y * s + z * c];
    else if (axis === 1) [x, z] = [x * c + z * s, -x * s + z * c];
    else [x, y] = [x * c - y * s, x * s + y * c];
  }
  return [x, y, z];
}

function endpoint(node: DiagramSceneNode, handle: string | null | undefined, toward: Vec3, anchor: boolean): Vec3 {
  const [x, y, z] = node.position;
  if (anchor) return [x, y, z];
  const halfWidth = node.size[0] / 2;
  const halfDepth = node.size[2] / 2;
  let local: Vec3;
  if (handle === 'top') local = [0, 0, -halfDepth];
  else if (handle === 'bottom') local = [0, 0, halfDepth];
  else if (handle === 'left') local = [-halfWidth, 0, 0];
  else if (handle === 'right') local = [halfWidth, 0, 0];
  else {
    const [dx, , dz] = rotate([toward[0] - x, toward[1] - y, toward[2] - z], node.rotation, true);
    const ratio = Math.abs(dx) + Math.abs(dz) < 1e-8 ? 0 : 1 / Math.max(Math.abs(dx) / halfWidth, Math.abs(dz) / halfDepth);
    local = ratio ? [dx * ratio, 0, dz * ratio] : [halfWidth, 0, 0];
  }
  const rotated = rotate(local, node.rotation);
  return [x + rotated[0], y + rotated[1], z + rotated[2]];
}

function marker(value: unknown): string {
  const raw = typeof value === 'string' ? value : text(record(value).type);
  return raw === 'arrowclosed' ? 'triangle' : raw ?? 'none';
}

function orthogonalPoints(points: Vec3[], horizontal: boolean): Vec3[] {
  const result: Vec3[] = [points[0]];
  for (const next of points.slice(1)) {
    let previous = result[result.length - 1];
    if (Math.abs(previous[0] - next[0]) > 1e-8 && Math.abs(previous[2] - next[2]) > 1e-8) {
      const corner: Vec3 = horizontal ? [next[0], previous[1], previous[2]] : [previous[0], previous[1], next[2]];
      result.push(corner);
      previous = corner;
      horizontal = !horizontal;
    }
    if (Math.abs(previous[1] - next[1]) > 1e-8 && (Math.abs(previous[0] - next[0]) > 1e-8 || Math.abs(previous[2] - next[2]) > 1e-8)) {
      result.push([previous[0], next[1], previous[2]]);
    }
    result.push(next);
  }
  const compact: Vec3[] = [];
  for (const point of result) {
    const previous = compact[compact.length - 1];
    if (previous && point.every((value, index) => Math.abs(value - previous[index]) < 1e-8)) continue;
    if (compact.length >= 2) {
      const earlier = compact[compact.length - 2];
      const a = previous.map((value, index) => value - earlier[index]);
      const b = point.map((value, index) => value - previous[index]);
      const cross = Math.hypot(a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]);
      if (cross < 1e-8 && a.reduce((dot, value, index) => dot + value * b[index], 0) >= 0) compact.pop();
    }
    compact.push(point);
  }
  return compact;
}

function labelsFor(edge: Edge, data: RecordData): DiagramSceneEdge['labels'] {
  const labels: DiagramSceneEdge['labels'] = [];
  if (Array.isArray(data.labels)) {
    for (const [index, value] of data.labels.entries()) {
      const label = record(value);
      const labelText = text(label.text);
      if (labelText) labels.push({ id: text(label.id) ?? `${edge.id}:label:${index}`, text: labelText, t: Math.max(0, Math.min(1, finite(label.t, 0.5))) });
    }
  }
  const legacyLabel = text(edge.label) ?? text(data.label);
  if (legacyLabel && !labels.some((label) => label.text === legacyLabel)) labels.push({ id: `${edge.id}:legacy`, text: legacyLabel, t: 0.5 });
  return labels;
}

/**
 * A derived view, never a persisted conversion: 100 diagram pixels = 1 world unit,
 * diagram X/Y map to world X/Z, and world Y is height. Unknown shapes keep their
 * identity/content as boxes. This module deliberately has no UI or browser imports.
 */
export function buildDiagramScene(nodes: readonly Node[], edges: readonly Edge[], options: { origin?: Vec3 } = {}): DiagramSceneModel {
  const warnings: string[] = [];
  const sourceById = new Map(nodes.map((node) => [node.id, node]));
  const boundsById = new Map<string, Bounds>();
  const resolving = new Set<string>();

  function boundsFor(node: Node): Bounds {
    const cached = boundsById.get(node.id);
    if (cached) return cached;
    const data = record(node.data);
    const [defaultWidth, defaultHeight] = defaultDimensions(node, data);
    const minimum = node.type === 'VectorPathNode' || node.type === 'SourceImageNode' ? 1 : 2;
    const width = dimensionAtLeast(minimum, node.width, node.style?.width, node.measured?.width, node.initialWidth, defaultWidth);
    const depth = dimensionAtLeast(minimum, node.height, node.style?.height, node.measured?.height, node.initialHeight, defaultHeight);
    const origin = node.origin ?? [0, 0];
    const result: Bounds = {
      left: coordinate(node.position?.x) - width * finite(origin[0]),
      top: coordinate(node.position?.y) - depth * finite(origin[1]),
      width,
      depth,
      elevation: Math.max(-100_000, Math.min(100_000, finite(record(data.spatial3d).elevation, node.parentId ? 0 : 0.04))),
      hidden: node.hidden === true,
    };
    if (resolving.has(node.id) || resolving.size > 500) {
      warnings.push(`Invalid parent chain for node ${node.id}; using its local position.`);
      return result;
    }
    resolving.add(node.id);
    if (node.parentId) {
      const parent = sourceById.get(node.parentId);
      if (parent) {
        const parentBounds = boundsFor(parent);
        result.left = coordinate(result.left + parentBounds.left);
        result.top = coordinate(result.top + parentBounds.top);
        result.hidden ||= parentBounds.hidden;
        result.elevation += parentBounds.elevation;
      } else warnings.push(`Missing parent ${node.parentId} for node ${node.id}.`);
    }
    resolving.delete(node.id);
    boundsById.set(node.id, result);
    return result;
  }

  const sceneNodes: DiagramSceneNode[] = [];
  const sceneById = new Map<string, DiagramSceneNode>();
  for (const node of nodes) {
    const bounds = boundsFor(node);
    if (bounds.hidden) continue;
    const data = record(node.data);
    const anchor = ANCHOR_TYPES.has(node.type ?? '');
    const kind = kindFor(node.type);
    const width = bounds.width / SCALE;
    const depth = bounds.depth / SCALE;
    const defaultHeight = node.type === 'VectorPathNode' ? 0.08 : anchor ? 0.6 : kind === 'plane' ? 0.06 : kind === 'actor' ? 1.6
      : Math.max(0.35, Math.min(1.5, Math.min(width, depth) * (kind === 'cylinder' ? 1.2 : 0.65)));
    const spatial = record(data.spatial3d);
    // Numeric paths have a genuine, adjustable thickness, without inventing
    // hidden geometry. Raster source crops still have no reconstructible volume.
    const height = node.type === 'SourceImageNode' ? 0.02 : Math.max(0.02, Math.min(1000, finite(spatial.depth, defaultHeight)));
    const model: DiagramSceneNode = {
      id: node.id,
      type: node.type ?? '',
      data: copyData(data),
      selected: node.selected === true,
      locked: data.locked === true || node.draggable === false,
      label: text(data.label) ?? text(data.title) ?? text(data.name) ?? '',
      details: fieldDetails(data),
      kind,
      position: [(bounds.left + bounds.width / 2) / SCALE, height / 2 + bounds.elevation, (bounds.top + bounds.depth / 2) / SCALE],
      rotation: [finite(spatial.rotationX) % (Math.PI * 2), -(finite(data.rotation) % 360) * Math.PI / 180, finite(spatial.rotationZ) % (Math.PI * 2)],
      size: [width, height, depth],
      color: color(data.fillColor, '#ffffff'),
      textColor: color(data.textColor, '#2c2c2a'),
    };
    sceneById.set(node.id, model);
    if (!anchor) sceneNodes.push(model);
  }

  const sceneEdges: DiagramSceneEdge[] = [];
  for (const edge of edges) {
    if (edge.hidden) continue;
    const source = sceneById.get(edge.source);
    const target = sceneById.get(edge.target);
    if (!source || !target) {
      if (!sourceById.has(edge.source) || !sourceById.has(edge.target)) warnings.push(`Connection ${edge.id} has a missing endpoint.`);
      continue;
    }
    const data = record(edge.data);
    const sourceAnchor = ANCHOR_TYPES.has(sourceById.get(edge.source)?.type ?? '');
    const targetAnchor = ANCHOR_TYPES.has(sourceById.get(edge.target)?.type ?? '');
    // The 2D editor retains old bends when changing routing modes, but only
    // orthogonal routing displays them. Do not resurrect those hidden detours.
    const usesBends = data.routing === undefined || data.routing === 'orthogonal';
    const bends: Point[] = usesBends && Array.isArray(data.bendPoints) ? data.bendPoints.flatMap((value) => {
      const point = record(value);
      return typeof point.x === 'number' && Number.isFinite(point.x) && typeof point.y === 'number' && Number.isFinite(point.y)
        ? [{ x: coordinate(point.x), y: coordinate(point.y), ...(typeof point.z === 'number' && Number.isFinite(point.z) ? { z: Math.max(-100_000, Math.min(100_000, point.z)) } : {}) }] : [];
    }) : [];
    const firstToward: Vec3 = bends.length ? [bends[0].x / SCALE, bends[0].z ?? source.position[1], bends[0].y / SCALE] : target.position;
    const lastToward: Vec3 = bends.length ? [bends[bends.length - 1].x / SCALE, bends[bends.length - 1].z ?? target.position[1], bends[bends.length - 1].y / SCALE] : source.position;
    const selfLoop = source.id === target.id;
    const start = endpoint(source, edge.sourceHandle ?? (selfLoop ? 'right' : undefined), firstToward, sourceAnchor);
    const end = endpoint(target, edge.targetHandle ?? (selfLoop ? 'left' : undefined), lastToward, targetAnchor);
    const lift = Math.max(start[1], end[1]);
    let points: Vec3[];
    if (selfLoop && !bends.length) {
      const reach = Math.max(source.size[0], source.size[2]) / 2 + 0.6;
      const [x, , z] = source.position;
      points = [start, [x + reach, lift, z], [x + reach, lift, z - reach], [x - reach, lift, z - reach], [x - reach, lift, z], end];
    } else {
      points = [start, ...bends.map((point): Vec3 => [point.x / SCALE, point.z ?? lift, point.y / SCALE]), end];
      if (usesBends && !selfLoop) {
        const horizontal = edge.sourceHandle === 'left' || edge.sourceHandle === 'right'
          || (!edge.sourceHandle && Math.abs(end[0] - start[0]) >= Math.abs(end[2] - start[2]));
        const mid = horizontal ? (start[0] + end[0]) / 2 : (start[2] + end[2]) / 2;
        if (!bends.length) points = horizontal
          ? [start, [mid, start[1], start[2]], [mid, end[1], end[2]], end]
          : [start, [start[0], start[1], mid], [end[0], end[1], mid], end];
        points = orthogonalPoints(points, horizontal);
      } else if (!bends.length && data.routing === 'curved' && !selfLoop) {
        const distance = Math.max(0.3, Math.hypot(end[0] - start[0], end[2] - start[2]) * 0.4);
        function control(node: DiagramSceneNode, point: Vec3, other: Vec3, handle: string | null | undefined): Vec3 {
          let direction: Vec3;
          if (handle === 'top') direction = [0, 0, -1];
          else if (handle === 'bottom') direction = [0, 0, 1];
          else if (handle === 'left') direction = [-1, 0, 0];
          else if (handle === 'right') direction = [1, 0, 0];
          else {
            const length = Math.hypot(other[0] - point[0], other[1] - point[1], other[2] - point[2]) || 1;
            return point.map((value, index) => value + (other[index] - value) / length * distance) as Vec3;
          }
          direction = rotate(direction, node.rotation);
          return point.map((value, index) => value + direction[index] * distance) as Vec3;
        }
        const first = control(source, start, end, edge.sourceHandle);
        const second = control(target, end, start, edge.targetHandle);
        points = Array.from({ length: 25 }, (_, index) => {
          const t = index / 24, u = 1 - t;
          return start.map((value, axis) => u ** 3 * value + 3 * u ** 2 * t * first[axis] + 3 * u * t ** 2 * second[axis] + t ** 3 * end[axis]) as Vec3;
        });
      }
      // Coincident floating endpoints still need a visible, non-degenerate line.
      if (points.every((point) => Math.hypot(point[0] - start[0], point[1] - start[1], point[2] - start[2]) < 1e-8)) {
        points = [start, [start[0] + 0.4, lift + 0.4, start[2]], [start[0], lift + 0.8, start[2]], end];
      }
    }
    sceneEdges.push({
      id: edge.id,
      data: copyData(data),
      selected: edge.selected === true,
      points,
      bendPoints: bends.map((point): Vec3 => [point.x / SCALE, point.z ?? lift, point.y / SCALE]),
      labels: labelsFor(edge, data),
      color: color(data.strokeColor, color(edge.style?.stroke, '#B4B2A9')),
      width: Math.max(0.5, Math.min(10, finite(data.strokeWidth, finite(edge.style?.strokeWidth, 1.5)))),
      dashed: data.lineStyle === 'dashed' || data.lineStyle === 'dotted' || Boolean(edge.style?.strokeDasharray),
      lineStyle: data.lineStyle === 'dotted' || data.lineStyle === 'double' || data.lineStyle === 'dashed'
        ? data.lineStyle : edge.style?.strokeDasharray ? 'dashed' : 'solid',
      // Double rails suppress endpoint markers in the existing 2D renderer.
      markerStart: data.lineStyle === 'double' ? 'none' : marker(data.markerStart ?? edge.markerStart),
      markerEnd: data.lineStyle === 'double' ? 'none' : marker(data.markerEnd ?? edge.markerEnd),
    });
  }

  // Recenter only the newly allocated scene arrays, never the diagram's positions.
  const minimum: Vec3 = [Infinity, Infinity, Infinity];
  const maximum: Vec3 = [-Infinity, -Infinity, -Infinity];
  function include(point: Vec3, halfSize: Vec3 = [0, 0, 0]) {
    for (let axis = 0; axis < 3; axis++) {
      minimum[axis] = Math.min(minimum[axis], point[axis] - halfSize[axis]);
      maximum[axis] = Math.max(maximum[axis], point[axis] + halfSize[axis]);
    }
  }
  for (const node of sceneNodes) {
    const half = sceneNodeHalfExtents(node);
    for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {
      const corner = rotate([x * half[0], y * half[1], z * half[2]], node.rotation);
      include(corner.map((value, index) => value + node.position[index]) as Vec3);
    }
  }
  for (const edge of sceneEdges) for (const point of edge.points) include(point);
  if (!sceneNodes.length && !sceneEdges.length) return { nodes: [], edges: [], center: [0, 0, 0], origin: options.origin?.map((value) => finite(value)) as Vec3 ?? [0, 0, 0], radius: 2, warnings };
  const origin: Vec3 = options.origin
    ? options.origin.map((value) => finite(value)) as Vec3
    : [(minimum[0] + maximum[0]) / 2, 0, (minimum[2] + maximum[2]) / 2];
  const center = minimum.map((value, index) => (value + maximum[index]) / 2 - origin[index]) as Vec3;
  for (const node of sceneNodes) {
    node.position = node.position.map((value, index) => value - origin[index]) as Vec3;
  }
  for (const edge of sceneEdges) {
    edge.points = edge.points.map((point) => point.map((value, index) => value - origin[index]) as Vec3);
    edge.bendPoints = edge.bendPoints.map((point) => point.map((value, index) => value - origin[index]) as Vec3);
  }
  const radius = Math.max(2, Math.hypot(maximum[0] - minimum[0], maximum[1] - minimum[1], maximum[2] - minimum[2]) / 2);
  return { nodes: sceneNodes, edges: sceneEdges, center, origin, radius, warnings };
}
