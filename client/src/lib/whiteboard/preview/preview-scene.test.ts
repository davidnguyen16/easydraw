import { describe, expect, it, vi } from 'vitest';
import type { PagedDiagramData } from '@easydraw/diagram-schema';
import { createPreviewScene } from './preview-scene';

function document(): PagedDiagramData {
  return { schemaVersion: 1, activePageId: 'preview', pages: [{ id: 'preview', name: 'AI result', nodes: [
    { id: 'a', type: 'RectangleNode', position: { x: 50, y: 40 }, width: 160, height: 80, data: { label: 'Start', fillColor: '#ffeecc' } },
    { id: 'b', type: 'DatabaseNode', position: { x: 400, y: 40 }, width: 180, height: 120, data: { label: 'Store' } },
  ], edges: [{ id: 'ab', source: 'a', target: 'b', sourceHandle: 'right', targetHandle: 'left', data: {
    markerStart: 'triangle', markerEnd: 'triangle', labels: [{ id: 'label', text: 'Same relationship', t: 0.5 }],
  } }] }] };
}

describe('isolated preview 3D model', () => {
  it('projects the same reviewed objects/relationships without mutation, storage or fetch', () => {
    const input = document();
    const before = structuredClone(input);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('No network allowed'));
    try {
      const model = createPreviewScene(input);
      expect(model.nodes.map((node) => [node.id, node.label])).toEqual([['a', 'Start'], ['b', 'Store']]);
      expect(model.edges[0]).toMatchObject({ id: 'ab', markerStart: 'triangle', markerEnd: 'triangle',
        labels: [{ id: 'label', text: 'Same relationship', t: 0.5 }] });
      expect(model.nodes[0].size[0]).toBe(1.6);
      model.nodes[0].data.label = 'Renderer-owned clone';
      model.edges[0].data.markerEnd = 'none';
      expect(input).toEqual(before);
      expect(input.pages[0].view3d).toBeUndefined();
      expect(createPreviewScene(input)).toEqual(createPreviewScene(input));
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally { fetchSpy.mockRestore(); }
  });

  it('chooses the same active page as 2D and falls back safely when it is missing', () => {
    const input = document();
    input.pages.push({ id: 'other', name: 'Other', nodes: [{ id: 'text', type: 'TextNode', data: { label: 'Other page' } }], edges: [] });
    input.activePageId = 'other';
    expect(createPreviewScene(input).nodes.map((node) => node.id)).toEqual(['text']);
    input.activePageId = 'absent';
    expect(createPreviewScene(input).nodes.map((node) => node.id)).toEqual(['a', 'b']);
    input.pages = [];
    expect(createPreviewScene(input).nodes).toEqual([]);
    expect(createPreviewScene(input).edges).toEqual([]);
  });

  it('gives vector artwork depth while keeping one-pixel axes and source coordinates intact', () => {
    const input = document();
    input.pages[0].nodes = [{ id: 'line', type: 'VectorPathNode', position: { x: 3, y: 5 }, width: 1, height: 150, data: {
      label: 'Source vertical line', vector: { version: 1,
        commands: [{ op: 'M', values: [500, 0] }, { op: 'L', values: [500, 1000] }],
        stroke: '#123456', fill: 'none', strokeWidth: 1, dash: 'solid', startArrow: false, endArrow: true },
    } }];
    const before = structuredClone(input);
    const model = createPreviewScene(input);
    expect(model.nodes[0]).toMatchObject({ id: 'line', type: 'VectorPathNode', kind: 'plane', size: [0.01, 0.08, 1.5] });
    expect(model.nodes[0].data.vector).toEqual(input.pages[0].nodes[0].data?.vector);
    expect(model.edges).toEqual([]); // Invalid references cannot become stray connections.
    expect(input).toEqual(before);
  });

  it('renders CubeNode equipment only for a built-in sample result', () => {
    const input = document();
    input.pages[0].nodes = [{ id: 'rack', type: 'CubeNode', position: { x: 0, y: 0 }, width: 60, height: 100,
      data: { label: 'Rack A-01', spatial3d: { depth: 2, elevation: 0 } } }];
    expect(createPreviewScene(input).nodes[0].type).toBe('UnsupportedPreviewNode');
    const builtIn = createPreviewScene(input, 'built-in');
    expect(builtIn.nodes[0].type).toBe('CubeNode');
    expect(builtIn.warnings.some((warning) => warning.includes('Unsupported'))).toBe(false);
  });

  it('never resolves unsupported account-library node types and uses 2D fallback dimensions', () => {
    const input = document();
    input.pages[0].nodes = [{ id: 'asset', type: 'CustomImageNode', data: { label: 'Unsupported', assetId: 'private-asset' } }];
    const model = createPreviewScene(input);
    expect(model.nodes[0].type).toBe('UnsupportedPreviewNode');
    expect(model.nodes[0].size[0]).toBe(1.6);
    expect(model.nodes[0].size[2]).toBe(0.8);
    expect(model.warnings.length).toBeGreaterThan(0);
  });
});
