import { describe, expect, it } from 'vitest';
import type { Edge } from '@xyflow/react';
import { isVisual3DRecipe } from '@easydraw/diagram-schema';
import { combineSceneNodes } from './combine-objects';
import type { DiagramSceneNode } from './scene-model';

function scene(id: string, kind: DiagramSceneNode['kind'], position: [number, number, number], size: [number, number, number], color = '#123456'): DiagramSceneNode {
  return { id, type: 'CubeNode', data: {}, selected: true, locked: false, label: id, details: [], kind, position, rotation: [0, 0, 0], size, color, textColor: '#000000' };
}

describe('combineSceneNodes', () => {
  // A 1×1×1 box at x=0 and a 1×2×1 cylinder at x=2, both standing on the floor.
  const box = scene('a', 'box', [0.5, 0.5, 0.5], [1, 1, 1], '#ff0000');
  const cylinder = scene('b', 'cylinder', [2.5, 1, 0.5], [1, 2, 1], '#00ff00');
  const edges: Edge[] = [
    { id: 'e1', source: 'a', target: 'b' },
    { id: 'e2', source: 'a', target: 'other' },
    { id: 'e3', source: 'x', target: 'y' },
  ];

  it('needs at least two solid objects', () => {
    expect(combineSceneNodes([box], edges, 'n')).toBeNull();
    expect(combineSceneNodes([box, scene('p', 'plane', [0, 0, 0], [1, 0.02, 1])], edges, 'n')).toBeNull();
  });

  it('places each object as a part inside the group box, keeping shape and colour', () => {
    const result = combineSceneNodes([box, cylinder], edges, 'n')!;
    const recipe = result.node.data.visual3d;
    expect(isVisual3DRecipe(recipe)).toBe(true);
    const parts = (recipe as { parts: unknown[] }).parts as { shape: string; color: string; size: number[]; position: number[] }[];
    // Group box: x 0..3, y 0..2, z 0..1.
    expect(parts[0]).toMatchObject({ shape: 'box', color: '#ff0000', size: [0.333, 0.5, 1], position: [-0.333, -0.25, 0] }); // values are rounded to 3 decimals
    expect(parts[1]).toMatchObject({ shape: 'cylinder', color: '#00ff00', size: [0.333, 1, 1], position: [0.333, 0, 0] });
  });

  it('gives the new cube the group footprint, elevation and depth', () => {
    const { node } = combineSceneNodes([box, cylinder], edges, 'n')!;
    expect(node.type).toBe('CubeNode');
    expect(node.position).toEqual({ x: 0, y: 0 });
    expect(node.width).toBe(300);
    expect(node.height).toBe(100);
    expect(node.data.spatial3d).toEqual({ elevation: 0, depth: 2 });
  });

  it('rewires connections to the new object and drops the ones inside it', () => {
    const result = combineSceneNodes([box, cylinder], edges, 'n')!;
    expect(result.removedIds).toEqual(['a', 'b']);
    expect(result.edges.map((e) => [e.id, e.source, e.target])).toEqual([
      ['e2', 'n', 'other'],
      ['e3', 'x', 'y'],
    ]);
  });
});
