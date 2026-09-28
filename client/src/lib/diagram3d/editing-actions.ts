import type { Node } from '@xyflow/react';
import type { DiagramSceneModel, Vec3 } from './scene-model';
import type { NodeTransform3D } from './types';

const finite = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const bounded = (value: number) => Math.max(-100_000, Math.min(100_000, value));
const validVector = (value: Vec3 | undefined): value is Vec3 =>
  Array.isArray(value) && value.length === 3 && [0, 1, 2].every((index) => Number.isFinite(value[index]));
export const spatialData = (node: Node): Record<string, unknown> =>
  node.data.spatial3d && typeof node.data.spatial3d === 'object' && !Array.isArray(node.data.spatial3d)
    ? node.data.spatial3d as Record<string, unknown> : {};

/** Apply a gizmo gesture against its initial snapshot, not accumulated frames.
 * XY diagram coordinates become XZ world coordinates; depth/elevation stay in
 * optional node data, so the original 2D shape is still fully editable. */
export function transformDiagramNodes(
  nodes: readonly Node[],
  model: DiagramSceneModel,
  id: string,
  patch: NodeTransform3D,
  snap = false,
): Node[] {
  const anchor = model.nodes.find((node) => node.id === id);
  if (!anchor || anchor.locked) return [...nodes];
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const models = new Map(model.nodes.map((node) => [node.id, node]));
  const selected = new Set(nodes.filter((node) => (node.selected || node.id === id)
    && models.has(node.id) && !models.get(node.id)!.locked).map((node) => node.id));
  const hasSelectedParent = (node: Node) => {
    const seen = new Set<string>();
    let parent = node.parentId;
    while (parent && !seen.has(parent)) {
      if (selected.has(parent)) return true;
      seen.add(parent);
      parent = byId.get(parent)?.parentId;
    }
    return false;
  };
  const delta = validVector(patch.position)
    ? patch.position!.map((value, index) => value - anchor.position[index]) as Vec3 : [0, 0, 0] as Vec3;
  const artwork = (type: string) => type === 'VectorPathNode' || type === 'SourceImageNode';
  const ratios = validVector(patch.size)
    ? patch.size!.map((value, index) => {
      const minimum = index !== 1 && artwork(anchor.type) ? 0.01 : 0.02;
      return Math.max(minimum, value) / Math.max(minimum, anchor.size[index]);
    }) as Vec3
    : [1, 1, 1] as Vec3;
  const moves = validVector(patch.position) && delta.some((value) => Math.abs(value) > 1e-10);
  const resizes = validVector(patch.size) && ratios.some((value) => Math.abs(value - 1) > 1e-10);
  const rotates = validVector(patch.rotation) && patch.rotation.some((value, index) => Math.abs(value - anchor.rotation[index]) > 1e-10);
  if (!moves && !resizes && !rotates) return [...nodes];

  return nodes.map((node) => {
    if (!selected.has(node.id) || hasSelectedParent(node)) return node;
    const scene = models.get(node.id);
    if (!scene) return node;
    const spatial = { ...spatialData(node) };
    let x = node.position.x + delta[0] * 100;
    let y = node.position.y + delta[2] * 100;
    if (moves) {
      if (snap) { x = Math.round(x / 20) * 20; y = Math.round(y / 20) * 20; }
      spatial.elevation = bounded(finite(spatial.elevation, node.parentId ? 0 : 0.04) + delta[1]);
    }
    const minimumDimension = artwork(scene.type) ? 1 : 2;
    const width = Math.max(minimumDimension, Math.min(100_000, scene.size[0] * ratios[0] * 100));
    const height = Math.max(minimumDimension, Math.min(100_000, scene.size[2] * ratios[2] * 100));
    if (resizes) {
      // Resize around the existing center, respecting non-default node origins.
      const origin = node.origin ?? [0, 0];
      x -= (width - scene.size[0] * 100) * (0.5 - origin[0]);
      y -= (height - scene.size[2] * 100) * (0.5 - origin[1]);
      spatial.depth = Math.max(0.02, Math.min(1_000, scene.size[1] * ratios[1]));
      spatial.elevation = bounded(finite(spatial.elevation, node.parentId ? 0 : 0.04) - ((spatial.depth as number) - scene.size[1]) / 2);
    }
    const data: Record<string, unknown> = { ...node.data, spatial3d: spatial };
    if (rotates) {
      const rotation = scene.rotation.map((value, index) => (value + patch.rotation![index] - anchor.rotation[index]) % (Math.PI * 2)) as Vec3;
      spatial.rotationX = rotation[0];
      spatial.rotationZ = rotation[2];
      data.rotation = -rotation[1] * 180 / Math.PI;
    }
    return {
      ...node, position: { x: bounded(x), y: bounded(y) }, data,
      ...(resizes ? {
        width, height,
        measured: { width, height },
        style: { ...node.style, width, height },
      } : {}),
    };
  });
}

export function diagramPositionFromWorld(point: Vec3, origin: Vec3) {
  return { x: bounded((finite(point[0]) + finite(origin[0])) * 100), y: bounded((finite(point[2]) + finite(origin[2])) * 100) };
}
