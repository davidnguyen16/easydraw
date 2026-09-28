import type { Edge, Node } from '@xyflow/react';
import { MAX_VISUAL3D_PARTS, type Visual3DPart, type Visual3DVector } from '@easydraw/diagram-schema';
import type { DiagramSceneNode, Vec3 } from './scene-model';

/** World units per diagram pixel, as in scene-model. */
const SCALE = 100;
const COLOR = /^#[0-9a-f]{6}$/i;

export interface CombineResult {
  /** The new CubeNode carrying the combined recipe. */
  node: Node;
  /** Edges with the combined nodes' ends rewired to the new node (self-loops dropped). */
  edges: Edge[];
  removedIds: string[];
}

/**
 * Turns several objects in the 3D scene into one CubeNode whose recipe
 * reproduces them as parts: each object's box, cylinder or sphere becomes a
 * part sized and placed relative to the group's bounding box, in its own
 * colour. The group's box becomes the new node's footprint, elevation and
 * depth, so the combined object sits exactly where the pieces were.
 */
export function combineSceneNodes(selected: DiagramSceneNode[], edges: Edge[], newId: string): CombineResult | null {
  const members = selected.filter((node) => node.kind !== 'plane');
  if (members.length < 2 || members.length > MAX_VISUAL3D_PARTS) return null;

  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const node of members) {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis]!, node.position[axis]! - node.size[axis]! / 2);
      max[axis] = Math.max(max[axis]!, node.position[axis]! + node.size[axis]! / 2);
    }
  }
  const extent: Vec3 = [Math.max(max[0] - min[0], 0.01), Math.max(max[1] - min[1], 0.01), Math.max(max[2] - min[2], 0.01)];
  const centre: Vec3 = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];

  const parts: Visual3DPart[] = members.map((node) => {
    const size = node.size.map((v, axis) => clamp(v / extent[axis]!, 0.005, 2)) as Visual3DVector;
    const position = node.position.map((v, axis) => clamp((v - centre[axis]!) / extent[axis]!, -1, 1)) as Visual3DVector;
    const rotation = node.rotation.some((r) => Math.abs(r) > 1e-6) ? (node.rotation.map(round) as Visual3DVector) : undefined;
    return {
      shape: shapeFor(node.kind),
      material: 'custom',
      color: COLOR.test(node.color) ? node.color.toLowerCase() : '#ffffff',
      size: size.map(round) as Visual3DVector,
      position: position.map(round) as Visual3DVector,
      ...(rotation ? { rotation } : {}),
    };
  });

  const width = Math.round(extent[0] * SCALE);
  const height = Math.round(extent[2] * SCALE);
  const node: Node = {
    id: newId,
    type: 'CubeNode',
    position: { x: Math.round(min[0] * SCALE), y: Math.round(min[2] * SCALE) },
    width,
    height,
    style: { width, height },
    selected: true,
    data: {
      label: '',
      fillColor: '#ffffff',
      shadow: true,
      visual3d: { version: 2, parts },
      spatial3d: { elevation: round(min[1]), depth: round(extent[1]) },
    },
  };

  const removedIds = members.map((m) => m.id);
  const removed = new Set(removedIds);
  const rewired = edges
    .map((edge) => ({
      ...edge,
      source: removed.has(edge.source) ? newId : edge.source,
      target: removed.has(edge.target) ? newId : edge.target,
      selected: false,
    }))
    .filter((edge) => !(edge.source === newId && edge.target === newId));

  return { node, edges: rewired, removedIds };
}

function shapeFor(kind: DiagramSceneNode['kind']): Visual3DPart['shape'] {
  if (kind === 'cylinder') return 'cylinder';
  if (kind === 'sphere') return 'sphere';
  return 'box';
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
