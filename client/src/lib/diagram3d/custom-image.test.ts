import { describe, expect, it } from 'vitest';
import { buildDiagramScene } from './scene-model';
import { containImageSize } from './custom-image-geometry';
import { getNodeLabelLayout } from './node-label-layout';
import { getNodeVisualDefinition, SUPPORTED_3D_NODE_TYPES } from './visual-catalog';

describe('custom image in the shared 3D scene', () => {
  it('keeps wide and tall images inside resized node bounds without distortion', () => {
    expect(containImageSize(2, 2, 400, 100)).toEqual([2, 0.5]);
    expect(containImageSize(2, 2, 100, 400)).toEqual([0.5, 2]);
    expect(containImageSize(3, 2, 300, 200)).toEqual([3, 2]);
    expect(containImageSize(2, 1, NaN, 0)).toEqual([2, 1]);
  });

  it('uses a thin image tile and keeps the caption outside artwork', () => {
    const data = { assetId: 'asset-1', definitionId: 'removed-library-item', label: 'Custom router', intrinsicWidth: 400, intrinsicHeight: 200, fit: 'contain' };
    const scene = buildDiagramScene([{ id: 'node-1', type: 'CustomImageNode', position: { x: 50, y: 30 }, width: 200, height: 100, data }], []);
    const node = scene.nodes[0];
    expect(node.kind).toBe('plane');
    expect(node.size).toEqual([2, 0.06, 1]);
    expect(node.data).toEqual(data);
    expect(getNodeVisualDefinition(node.type).kind).toBe('image');
    expect(SUPPORTED_3D_NODE_TYPES).toContain('CustomImageNode');
    const label = getNodeLabelLayout(node)!;
    expect(label.surface).toBe('top');
    expect(label.position[2] - label.height / 200).toBeGreaterThan(node.size[2] / 2);
  });

  it('retains asset identity while applying persisted object-space transforms', () => {
    const data = { assetId: 'asset-1', label: '', intrinsicWidth: 100, intrinsicHeight: 100, spatial3d: { depth: 0.12, elevation: 1, rotationX: 0.3, rotationZ: 0.4 }, rotation: 90 };
    const source = { id: 'custom-1', type: 'CustomImageNode', position: { x: 0, y: 0 }, width: 100, height: 100, data };
    const snapshot = JSON.stringify(source);
    const node = buildDiagramScene([source], [], { origin: [0, 0, 0] }).nodes[0];
    expect(node.size[1]).toBe(0.12);
    expect(node.position[1]).toBeCloseTo(1.06);
    expect(node.rotation).toEqual([0.3, -Math.PI / 2, 0.4]);
    expect(getNodeLabelLayout(node)).toBeNull();
    expect(JSON.stringify(source)).toBe(snapshot);
  });
});
