import { describe, expect, it } from 'vitest';
import { createPaletteNode } from './palette-node';
import type { CustomNodeDragPayload } from './dnd';

const payload: CustomNodeDragPayload = { kind: 'custom-node', definitionId: 'custom-robot', assetId: 'asset-robot', label: 'Robot', intrinsicWidth: 600, intrinsicHeight: 400, defaultWidth: 150, defaultHeight: 100 };

describe('shared 2D / 3D palette creation', () => {
  it('keeps built-in palette drops working', () => {
    expect(createPaletteNode('RectangleNode', { x: 10, y: 20 }, 'rectangle')).toMatchObject({ id: 'rectangle', type: 'RectangleNode', position: { x: 10, y: 20 }, selected: true });
    expect(createPaletteNode('UnknownNode', { x: 0, y: 0 }, 'unknown')).toBeNull();
  });

  it('creates the same stable custom snapshot in either view without mutating the payload', () => {
    const source = Object.freeze({ ...payload });
    const position = { x: 20, y: 30 };
    const node = createPaletteNode(source, position, 'robot')!;
    expect(node).toEqual({ id: 'robot', type: 'CustomImageNode', position, width: 150, height: 100, selected: true, data: { definitionId: 'custom-robot', assetId: 'asset-robot', label: 'Robot', intrinsicWidth: 600, intrinsicHeight: 400, fit: 'contain' } });
    expect(node.position).not.toBe(position);
    expect(node.data).not.toBe(source);
    node.data.label = 'Canvas name';
    expect(source.label).toBe('Robot');
  });

  it('rejects incomplete IDs and invalid dimensions', () => {
    expect(createPaletteNode({ ...payload, assetId: '' }, { x: 0, y: 0 }, 'x')).toBeNull();
    expect(createPaletteNode({ ...payload, intrinsicWidth: NaN }, { x: 0, y: 0 }, 'x')).toBeNull();
    expect(createPaletteNode({ ...payload, defaultWidth: 0 }, { x: 0, y: 0 }, 'x')).toBeNull();
  });
});
