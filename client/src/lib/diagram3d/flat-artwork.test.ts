import { describe, expect, it, vi } from 'vitest';
import type { VectorGeometry } from '@easydraw/diagram-schema';
import { buildDiagramScene, sceneNodeHalfExtents } from './scene-model';
import { getFlatArtworkPlan, paintVectorArtwork, vectorArrowTriangles } from './flat-artwork';
import { getNodeLabelLayout } from './node-label-layout';
import { getNodeVisualDefinition, SUPPORTED_3D_NODE_TYPES } from './visual-catalog';
import { canCarryRecipe, getVisual3DRecipe } from './visual3d';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jzIoAAAAASUVORK5CYII=';
const vector = (patch: Partial<VectorGeometry> = {}): VectorGeometry => ({
  version: 1,
  commands: [{ op: 'M', values: [0, 500] }, { op: 'L', values: [1000, 500] }],
  stroke: '#326496', fill: 'none', strokeWidth: 2, dash: 'solid', startArrow: false, endArrow: true,
  ...patch,
});
const sourceImage = () => ({ version: 1, dataUrl: PNG, width: 1, height: 1, reason: 'Preserve unrecognized artwork' });
const sourceNode = (type: string, data: Record<string, unknown>) => ({
  id: 'artwork-1', type, position: { x: 75, y: 120 }, width: 400, height: 200, data,
});
const sceneNode = (type: string, data: Record<string, unknown>) =>
  buildDiagramScene([sourceNode(type, data)], [], { origin: [0, 0, 0] }).nodes[0];

describe('generic AI artwork in the shared 3D scene', () => {
  it('preserves artwork footprint and source content; only numeric vectors acquire depth', () => {
    for (const [type, payload] of [
      ['VectorPathNode', { vector: vector() }],
      ['SourceImageNode', { image: sourceImage() }],
    ] as const) {
      const source = sourceNode(type, { ...payload, label: 'Semantic description',
        spatial3d: { elevation: 1, depth: 999, rotationX: 0.2, rotationZ: 0.3 }, rotation: 90 });
      const before = JSON.stringify(source);
      const result = buildDiagramScene([source], [], { origin: [0, 0, 0] });
      const rendered = result.nodes[0];
      expect(rendered.kind).toBe('plane');
      const height = type === 'VectorPathNode' ? 999 : 0.02;
      expect(rendered.size).toEqual([4, height, 2]);
      expect(rendered.position).toEqual([2.75, 1 + height / 2, 2.2]);
      expect(rendered.rotation).toEqual([0.2, -Math.PI / 2, 0.3]);
      expect(rendered.data).toEqual(source.data);
      expect(rendered.data).not.toBe(source.data);
      expect(getNodeVisualDefinition(type)).toEqual({ kind: type === 'VectorPathNode' ? 'vector-artwork' : 'flat-artwork' });
      expect(SUPPORTED_3D_NODE_TYPES).toContain(type);
      expect(canCarryRecipe(type)).toBe(false);
      expect(getVisual3DRecipe(type, { visual3d: { version: 1, parts: [] } })).toBeNull();
      expect(getNodeLabelLayout(rendered)).toBeNull();
      expect(JSON.stringify(source)).toBe(before);
      expect(buildDiagramScene([source], [], { origin: [0, 0, 0] })).toEqual(result);
    }
  });

  it('keeps semantic names without duplicate captions and preserves separate visible TextNodes', () => {
    const scene = buildDiagramScene([
      sourceNode('VectorPathNode', { vector: vector(), label: 'Arrow connector', title: 'Do not print' }),
      { ...sourceNode('SourceImageNode', { image: sourceImage(), label: 'Source crop' }), id: 'crop' },
      { ...sourceNode('TextNode', { label: 'Actual recognized label' }), id: 'text' },
    ], []);
    expect(scene.nodes.map((node) => node.label)).toEqual(['Arrow connector', 'Source crop', 'Actual recognized label']);
    expect(getNodeLabelLayout(scene.nodes[0])).toBeNull();
    expect(getNodeLabelLayout(scene.nodes[1])).toBeNull();
    expect(getNodeLabelLayout(scene.nodes[2])?.commands).toContainEqual(expect.objectContaining({ text: 'Actual recognized label' }));
  });

  it('retains one-pixel artwork axes without changing legacy shape minimum dimensions', () => {
    for (const type of ['VectorPathNode', 'SourceImageNode']) {
      for (const [width, height] of [[1, 300], [250, 1]]) {
        const source = { ...sourceNode(type, { vector: vector(), image: sourceImage() }), width, height };
        const node = buildDiagramScene([source], [], { origin: [0, 0, 0] }).nodes[0];
        expect(node.size).toEqual([width / 100, type === 'VectorPathNode' ? 0.08 : 0.02, height / 100]);
        expect(getFlatArtworkPlan(node)).toMatchObject({ width, height });
        expect(node.position[0]).toBe((75 + width / 2) / 100);
        expect(node.position[2]).toBe((120 + height / 2) / 100);
      }
    }
    const legacy = buildDiagramScene([{ ...sourceNode('RectangleNode', {}), width: 1, height: 1 }], []).nodes[0];
    expect(legacy.size[0]).toBe(0.02);
    expect(legacy.size[2]).toBe(0.02);
  });

  it('scales normalized commands into the same non-square 2D drawing box without scaling stroke width', () => {
    const geometry = vector({ commands: [
      { op: 'M', values: [0, 100] },
      { op: 'L', values: [1000, 100] },
      { op: 'Q', values: [1000, 500, 500, 1000] },
      { op: 'C', values: [250, 1000, 0, 750, 0, 100] },
      { op: 'Z', values: [] },
    ], fill: '#ffeecc', dash: 'dashed', startArrow: true });
    const before = JSON.stringify(geometry);
    const plan = getFlatArtworkPlan(sceneNode('VectorPathNode', { vector: geometry }));
    if (plan.kind !== 'vector') throw new Error('Expected a valid vector plan');
    expect(plan.commands).toEqual([
      { op: 'M', values: [0, 20] }, { op: 'L', values: [400, 20] },
      { op: 'Q', values: [400, 100, 200, 200] },
      { op: 'C', values: [100, 200, 0, 150, 0, 20] }, { op: 'Z', values: [] },
    ]);
    expect(plan.appearance).toMatchObject({ stroke: '#326496', fill: '#ffeecc', strokeWidth: 2, dashArray: '8 5' });
    expect(plan.padding).toBeGreaterThan(8);
    expect(plan.arrows).toHaveLength(2);
    expect(JSON.stringify(geometry)).toBe(before);
    plan.commands[0].values[0] = 123;
    expect(geometry.commands[0].values[0]).toBe(0);
  });

  it('includes wide strokes and arrowheads in fit bounds without expanding the editable footprint', () => {
    const node = sceneNode('VectorPathNode', { vector: vector({ strokeWidth: 12, startArrow: true }) });
    node.size = [0.01, 0.08, 0.01];
    const before = structuredClone(node);
    const plan = getFlatArtworkPlan(node);
    const half = sceneNodeHalfExtents(node);
    expect(half).toEqual([0.005 + plan.padding / 100, 0.04, 0.005 + plan.padding / 100]);
    expect(half[0]).toBeGreaterThan(0.5);
    expect(node).toEqual(before);
    const image = sceneNode('SourceImageNode', { image: sourceImage() });
    expect(sceneNodeHalfExtents(image)).toEqual(image.size.map((size) => size / 2));
  });

  it('uses safe shared style overrides, dash, opacity and bounded texture memory', () => {
    const rendered = sceneNode('VectorPathNode', {
      vector: vector({ dash: 'dotted' }), borderColor: '#abcdef', fillColor: '#123456', borderWidth: 50, opacity: 35,
    });
    rendered.size = [1000, 0.02, 1000];
    const plan = getFlatArtworkPlan(rendered);
    if (plan.kind !== 'vector') throw new Error('Expected a vector plan');
    expect(plan.appearance).toMatchObject({ stroke: '#abcdef', fill: '#123456', strokeWidth: 12, dashArray: '1 5', opacity: 0.35 });
    expect(plan.opacity).toBe(0.35);
    expect(plan.textureWidth).toBeLessThanOrEqual(1024);
    expect(plan.textureHeight).toBeLessThanOrEqual(1024);
    expect(plan.textureWidth * plan.textureHeight).toBeLessThanOrEqual(262_144);
    const rejectedPaint = getFlatArtworkPlan(sceneNode('VectorPathNode', {
      vector: vector(), borderColor: 'url(https://example.invalid/paint)', fillColor: '<svg onload=alert(1)>', opacity: NaN,
    }));
    if (rejectedPaint.kind !== 'vector') throw new Error('Expected the valid underlying vector');
    expect(rejectedPaint.appearance).toMatchObject({ stroke: '#326496', fill: 'none', opacity: 1 });
  });

  it('matches both SVG arrow directions and marker refX at straight or repeated-control curve endpoints', () => {
    const straight = vectorArrowTriangles(vector().commands, 2, true, true);
    expect(straight).toEqual([
      [[-0.8, 500], [7.2, 504], [7.2, 496]],
      [[1000.8, 500], [992.8, 496], [992.8, 504]],
    ]);
    const curves = vectorArrowTriangles([
      { op: 'M', values: [0, 0] }, { op: 'C', values: [0, 0, 100, 100, 100, 100] },
    ], 1, true, true);
    expect(curves).toHaveLength(2);
    expect(curves[0][0][0]).toBeLessThan(0);
    expect(curves[0][0][1]).toBeLessThan(0);
    expect(curves[1][0][0]).toBeGreaterThan(100);
    expect(curves[1][0][1]).toBeGreaterThan(100);
    expect(curves.flat(2).every(Number.isFinite)).toBe(true);
    expect(vectorArrowTriangles([{ op: 'M', values: [0, 0] }, { op: 'L', values: [0, 0] }], 2, true, true)).toEqual([]);
  });

  it('does not invent arrows for none/transparent/zero-width lines', () => {
    for (const extra of [{ borderColor: 'none' }, { borderColor: 'transparent' }, { borderWidth: 0 }]) {
      const plan = getFlatArtworkPlan(sceneNode('VectorPathNode', { vector: vector({ startArrow: true }), ...extra }));
      if (plan.kind !== 'vector') throw new Error('Expected a valid vector plan');
      expect(plan.arrows).toEqual([]);
    }
  });

  it('paints local numeric paths, curves, fills, dashes and arrowheads without SVG/HTML parsing', () => {
    const plan = getFlatArtworkPlan(sceneNode('VectorPathNode', { vector: vector({
      commands: [{ op: 'M', values: [0, 500] }, { op: 'Q', values: [250, 0, 500, 500] },
        { op: 'C', values: [600, 600, 900, 200, 1000, 500] }],
      fill: '#ffeecc', dash: 'dashed', startArrow: true,
    }) }));
    if (plan.kind !== 'vector') throw new Error('Expected a valid vector plan');
    const context = { save: vi.fn(), restore: vi.fn(), scale: vi.fn(), translate: vi.fn(), beginPath: vi.fn(),
      moveTo: vi.fn(), lineTo: vi.fn(), quadraticCurveTo: vi.fn(), bezierCurveTo: vi.fn(), closePath: vi.fn(),
      fill: vi.fn(), stroke: vi.fn(), setLineDash: vi.fn() };
    paintVectorArtwork(context as unknown as CanvasRenderingContext2D, plan);
    expect(context.quadraticCurveTo).toHaveBeenCalledWith(100, 0, 200, 100);
    expect(context.bezierCurveTo).toHaveBeenCalledWith(240, 120, 360, 40, 400, 100);
    expect(context.setLineDash).toHaveBeenCalledWith([8, 5]);
    expect(context.stroke).toHaveBeenCalledOnce();
    expect(context.fill).toHaveBeenCalledTimes(3);
    expect(context.restore).toHaveBeenCalledOnce();
  });

  it('keeps bounded source PNG bytes and full node footprint without resolving a remote asset', () => {
    const image = sourceImage();
    const before = JSON.stringify(image);
    const plan = getFlatArtworkPlan(sceneNode('SourceImageNode', { image, label: 'Do not duplicate text inside the crop', opacity: 50 }));
    expect(plan).toMatchObject({ kind: 'image', width: 400, height: 200, padding: 0, opacity: 0.5,
      image: { dataUrl: PNG, width: 1, height: 1, reason: image.reason } });
    expect(plan.textureWidth * plan.textureHeight).toBeLessThanOrEqual(262_144);
    expect(JSON.stringify(image)).toBe(before);
  });

  it('rejects malformed commands, raw SVG, remote images and forged PNG dimensions as flat unavailable artwork', () => {
    const cases = [
      ['VectorPathNode', { vector: { ...vector(), commands: [{ op: 'M', values: [0, 0] }, { op: 'L', values: [Infinity, 2] }] } }],
      ['VectorPathNode', { vector: { ...vector(), commands: [{ op: 'M', values: [0, 0] }, { op: 'SCRIPT', values: [] }] } }],
      ['VectorPathNode', { vector: '<svg><script>run()</script></svg>' }],
      ['SourceImageNode', { image: { ...sourceImage(), dataUrl: 'https://example.invalid/crop.png' } }],
      ['SourceImageNode', { image: { ...sourceImage(), dataUrl: 'data:image/svg+xml,<svg onload="run()"/>' } }],
      ['SourceImageNode', { image: { ...sourceImage(), width: 1024 } }],
      ['SourceImageNode', { image: { ...sourceImage(), width: 1025 } }],
    ] as const;
    for (const [type, data] of cases) {
      const node = sceneNode(type, data);
      expect(node.kind).toBe('plane');
      expect(getNodeVisualDefinition(type).kind).toBe(type === 'VectorPathNode' ? 'vector-artwork' : 'flat-artwork');
      expect(getFlatArtworkPlan(node).kind).toBe('invalid');
      expect(getNodeLabelLayout(node)).toBeNull();
    }
  });
});
