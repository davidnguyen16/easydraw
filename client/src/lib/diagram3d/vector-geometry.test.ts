import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import type { VectorGeometry } from '@easydraw/diagram-schema';
import { buildDiagramScene } from './scene-model';
import { getFlatArtworkPlan } from './flat-artwork';
import { buildVectorArtworkGeometry, VECTOR_3D_LIMITS, type VectorArtworkPlan, type VectorGeometryResult } from './vector-geometry';

const vector = (patch: Partial<VectorGeometry> = {}): VectorGeometry => ({
  version: 1, commands: [{ op: 'M', values: [0, 500] }, { op: 'L', values: [1000, 500] }],
  stroke: '#326496', fill: 'none', strokeWidth: 2, dash: 'solid', startArrow: false, endArrow: false, ...patch,
});
function plan(geometry: VectorGeometry, data: Record<string, unknown> = {}, width = 400, height = 200): VectorArtworkPlan {
  const node = buildDiagramScene([{ id: 'art', type: 'VectorPathNode', position: { x: 75, y: 100 }, width, height,
    data: { vector: geometry, ...data } }], []).nodes[0];
  const result = getFlatArtworkPlan(node);
  if (result.kind !== 'vector') throw new Error('Expected a validated vector fixture');
  return result;
}
function bounds(result: VectorGeometryResult) {
  const box = new THREE.Box3();
  for (const part of result.parts) {
    part.geometry.computeBoundingBox();
    box.union(part.geometry.boundingBox!);
  }
  return box;
}
function dispose(result: VectorGeometryResult) { for (const part of result.parts) part.geometry.dispose(); }
function intersects(result: VectorGeometryResult, x: number, z: number, paint?: 'fill' | 'stroke') {
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const ray = new THREE.Raycaster(new THREE.Vector3(x, 2000, z), new THREE.Vector3(0, -1, 0));
  const hits = result.parts.filter((part) => !paint || part.paint === paint).some((part) =>
    ray.intersectObject(new THREE.Mesh(part.geometry, material)).length > 0);
  material.dispose();
  return hits;
}
const rectangle = (left: number, top: number, right: number, bottom: number, reverse = false): VectorGeometry['commands'] => [
  { op: 'M', values: [left, top] },
  ...((reverse ? [[left, bottom], [right, bottom], [right, top]] : [[right, top], [right, bottom], [left, bottom]])
    .map((values) => ({ op: 'L' as const, values }))),
  { op: 'Z', values: [] },
];

describe('generic solid vector artwork', () => {
  it('keeps the 2D footprint but gives straight strokes real bounded depth and rounded ends', () => {
    const result = buildVectorArtworkGeometry(plan(vector()), 0.08);
    expect(result.fallbackReason).toBeUndefined();
    expect(result.parts.map((part) => part.paint)).toEqual(['stroke']);
    const box = bounds(result);
    expect(box.min.x).toBeCloseTo(-2.01);
    expect(box.max.x).toBeCloseTo(2.01);
    expect(box.min.z).toBeCloseTo(-0.01);
    expect(box.max.z).toBeCloseTo(0.01);
    expect(box.min.y).toBeCloseTo(-0.04);
    expect(box.max.y).toBeCloseTo(0.04);
    expect(intersects(result, 0, 0)).toBe(true);
    expect(intersects(result, 0, 0.03)).toBe(false);
    dispose(result);
  });

  it('samples quadratic and cubic geometry without replacing it with domain-specific shapes', () => {
    const quadratic = buildVectorArtworkGeometry(plan(vector({ commands: [
      { op: 'M', values: [0, 500] }, { op: 'Q', values: [500, 0, 1000, 500] },
    ] })), 0.2);
    expect(quadratic.stats.sampledPoints).toBe(25);
    expect(bounds(quadratic).min.z).toBeCloseTo(-0.51, 2);
    expect(intersects(quadratic, 0, -0.5)).toBe(true);
    expect(intersects(quadratic, 0, 0)).toBe(false);
    const cubic = buildVectorArtworkGeometry(plan(vector({ commands: [
      { op: 'M', values: [0, 500] }, { op: 'C', values: [250, 0, 750, 1000, 1000, 500] },
    ] })), 0.08);
    expect(cubic.stats.sampledPoints).toBe(25);
    expect(bounds(cubic).min.z).toBeLessThan(-0.25);
    expect(bounds(cubic).max.z).toBeGreaterThan(0.25);
    expect(bounds(cubic).min.y).toBeCloseTo(-0.04);
    for (const result of [quadratic, cubic]) dispose(result);
  });

  it('does not connect separate move subpaths or duplicate the semantic label', () => {
    const result = buildVectorArtworkGeometry(plan(vector({ commands: [
      { op: 'M', values: [0, 500] }, { op: 'L', values: [250, 500] },
      { op: 'M', values: [750, 500] }, { op: 'L', values: [1000, 500] },
    ] }), { label: 'Description only' }), 0.08);
    expect(result.stats.strokePieces).toBe(2);
    expect(result.parts).toHaveLength(1);
    expect(intersects(result, 0, 0)).toBe(false);
    expect(intersects(result, -1.5, 0)).toBe(true);
    dispose(result);
  });

  it('retains the corner and both legs of an elbow with bounded round stroke thickness', () => {
    const result = buildVectorArtworkGeometry(plan(vector({ commands: [
      { op: 'M', values: [0, 0] }, { op: 'L', values: [1000, 0] }, { op: 'L', values: [1000, 1000] },
    ] })), 0.08);
    expect(result.fallbackReason).toBeUndefined();
    expect(intersects(result, 0, -1)).toBe(true);
    expect(intersects(result, 2, 0)).toBe(true);
    expect(intersects(result, 2, -1)).toBe(true);
    expect(intersects(result, 0, 0)).toBe(false);
    expect(bounds(result).max.x).toBeLessThanOrEqual(2.011);
    expect(bounds(result).min.z).toBeGreaterThanOrEqual(-1.011);
    expect(bounds(result).max.y - bounds(result).min.y).toBeCloseTo(0.08);
    dispose(result);
  });

  it('does not pinch or taper a retraced stroke at a 180-degree cusp', () => {
    const result = buildVectorArtworkGeometry(plan(vector({ commands: [
      { op: 'M', values: [0, 500] }, { op: 'L', values: [1000, 500] }, { op: 'L', values: [0, 500] },
    ] })), 0.08);
    expect(result.fallbackReason).toBeUndefined();
    expect(result.stats.strokePieces).toBe(2);
    for (const x of [-1.8, 0, 1, 1.99]) {
      expect(intersects(result, x, 0.007)).toBe(true);
      expect(intersects(result, x, -0.007)).toBe(true);
    }
    expect(intersects(result, 2.005, 0)).toBe(true);
    expect(intersects(result, 2.02, 0)).toBe(false);
    expect(bounds(result).max.y - bounds(result).min.y).toBeCloseTo(0.08);
    for (const part of result.parts) {
      for (const value of part.geometry.getAttribute('normal').array) expect(Number.isFinite(value)).toBe(true);
    }
    dispose(result);
  });

  it('keeps round outer corners and a seamless closed outline without filling its interior', () => {
    const result = buildVectorArtworkGeometry(plan(vector({ commands: rectangle(0, 0, 1000, 1000) })), 0.08);
    expect(result.fallbackReason).toBeUndefined();
    expect(result.stats.strokePieces).toBe(4);
    for (const [x, z] of [[-2.005, -1.005], [2.005, -1.005], [2.005, 1.005], [-2.005, 1.005]]) {
      expect(intersects(result, x, z)).toBe(true);
    }
    expect(intersects(result, 0, 0)).toBe(false);
    expect(bounds(result).min.x).toBeCloseTo(-2.01);
    expect(bounds(result).max.z).toBeCloseTo(1.01);
    dispose(result);
  });

  it('extrudes closed fills and preserves a counter-wound hole with nonzero fill semantics', () => {
    const result = buildVectorArtworkGeometry(plan(vector({ stroke: 'none', fill: '#f0cc33', commands: [
      ...rectangle(0, 0, 1000, 1000), ...rectangle(250, 250, 750, 750, true),
    ] })), 0.4);
    expect(result.fallbackReason).toBeUndefined();
    expect(result.stats).toMatchObject({ shapes: 1, holes: 1 });
    expect(bounds(result).min.y).toBeCloseTo(-0.2);
    expect(bounds(result).max.y).toBeCloseTo(0.2);
    expect(intersects(result, 0, 0)).toBe(false);
    expect(intersects(result, 1.5, 0)).toBe(true);
    dispose(result);
  });

  it('keeps equally wound nested contours filled, including independent outer islands', () => {
    const nested = buildVectorArtworkGeometry(plan(vector({ stroke: 'none', fill: '#f0cc33', commands: [
      ...rectangle(0, 0, 1000, 1000), ...rectangle(250, 250, 750, 750),
    ] })), 0.1);
    expect(nested.stats).toMatchObject({ shapes: 1, holes: 0 });
    expect(intersects(nested, 0, 0)).toBe(true);
    const islands = buildVectorArtworkGeometry(plan(vector({ stroke: 'none', fill: '#f0cc33', commands: [
      ...rectangle(0, 0, 250, 1000), ...rectangle(750, 0, 1000, 1000),
    ] })), 0.1);
    expect(islands.stats.shapes).toBe(2);
    expect(intersects(islands, 0, 0)).toBe(false);
    dispose(nested); dispose(islands);
  });

  it('implicitly closes fill contours without closing their open stroke', () => {
    const result = buildVectorArtworkGeometry(plan(vector({ fill: '#f0cc33', commands: [
      { op: 'M', values: [0, 0] }, { op: 'L', values: [1000, 0] }, { op: 'L', values: [1000, 1000] },
    ] })), 0.08);
    expect(result.parts.map((part) => part.paint)).toEqual(['fill', 'stroke']);
    expect(intersects(result, 1, -0.5, 'fill')).toBe(true);
    expect(intersects(result, 0, 0, 'stroke')).toBe(false);
    expect(bounds(result).min.y).toBeCloseTo(-0.04);
    expect(bounds(result).max.y).toBeCloseTo(0.04);
    dispose(result);
  });

  it('preserves arrow direction, filled tips and the original 2D marker footprint', () => {
    const source = plan(vector({ startArrow: true, endArrow: true }));
    const result = buildVectorArtworkGeometry(source, 0.08);
    expect(source.arrows).toHaveLength(2);
    // Round line caps extend 1 px; the arrow tip extends only 0.8 px.
    expect(bounds(result).min.x).toBeCloseTo(-2.01);
    expect(bounds(result).max.x).toBeCloseTo(2.01);
    expect(intersects(result, 1.94, 0.025)).toBe(true);
    expect(intersects(result, -1.94, 0.025)).toBe(true);
    expect(intersects(result, 1.8, 0.025)).toBe(false);
    dispose(result);
  });

  it('retains dashed/dotted lines with phase continuous over line segments and reset at moves', () => {
    for (const dash of ['dashed', 'dotted'] as const) {
      const source = plan(vector({ dash, commands: [
        { op: 'M', values: [0, 250] }, { op: 'L', values: [10, 250] }, { op: 'L', values: [1000, 250] },
        { op: 'M', values: [0, 750] }, { op: 'L', values: [1000, 750] },
      ] }));
      const result = buildVectorArtworkGeometry(source, 0.08);
      expect(result.fallbackReason).toBeUndefined();
      expect(result.stats.strokePieces).toBeGreaterThan(10);
      expect(intersects(result, -1.995, -0.5)).toBe(true);
      expect(intersects(result, -1.995, 0.5)).toBe(true);
      // Gap after the first dash: 8..13 px or 1..6 px, allowing round caps.
      const gap = dash === 'dashed' ? 10.5 : 3.5;
      expect(intersects(result, -2 + gap / 100, -0.5)).toBe(false);
      expect(intersects(result, -2 + gap / 100, 0.5)).toBe(false);
      dispose(result);
    }
  });

  it('renders repeated/degenerate controls safely and leaves invisible paint invisible', () => {
    const source = plan(vector({ commands: [
      { op: 'M', values: [500, 500] }, { op: 'C', values: [500, 500, 500, 500, 500, 500] },
    ] }));
    const dot = buildVectorArtworkGeometry(source, 0.08);
    expect(dot.stats.sampledPoints).toBe(1);
    expect(dot.parts).toHaveLength(1);
    expect(intersects(dot, 0, 0)).toBe(true);
    for (const value of dot.parts[0].geometry.getAttribute('position').array) expect(Number.isFinite(value)).toBe(true);
    const closedDot = buildVectorArtworkGeometry(plan(vector({ commands: [
      { op: 'M', values: [500, 500] }, { op: 'L', values: [500, 500] }, { op: 'Z', values: [] },
    ] })), 0.08);
    expect(closedDot.fallbackReason).toBeUndefined();
    expect(closedDot.parts).toHaveLength(0);
    for (const data of [{ borderColor: 'none' }, { borderColor: 'transparent' }, { borderWidth: 0 }]) {
      const empty = buildVectorArtworkGeometry(plan(vector({ startArrow: true, endArrow: true }), data), 0.08);
      expect(empty.parts).toHaveLength(0);
    }
    dispose(dot);
  });

  it('honors explicit depth independently from a one-pixel horizontal/vertical drawing axis', () => {
    for (const [width, height] of [[1, 300], [300, 1]]) {
      const source = plan(vector(), {}, width, height);
      const result = buildVectorArtworkGeometry(source, 3);
      expect(bounds(result).max.x - bounds(result).min.x).toBeCloseTo(width / 100 + 0.02);
      expect(bounds(result).max.y - bounds(result).min.y).toBeCloseTo(3);
      dispose(result);
    }
  });

  it('keeps complex crossing fills planar instead of creating incorrect overlapping solids', () => {
    const result = buildVectorArtworkGeometry(plan(vector({ fill: '#f0cc33', commands: [
      { op: 'M', values: [0, 0] }, { op: 'L', values: [1000, 1000] },
      { op: 'L', values: [1000, 0] }, { op: 'L', values: [0, 1000] }, { op: 'Z', values: [] },
    ] })), 0.08);
    expect(result.parts).toHaveLength(0);
    expect(result.fallbackReason).toMatch(/contours/);
    const overlap = buildVectorArtworkGeometry(plan(vector({ fill: '#f0cc33', commands: [
      ...rectangle(0, 0, 700, 700), ...rectangle(300, 300, 1000, 1000),
    ] })), 0.08);
    expect(overlap.fallbackReason).toMatch(/contours/);
  });

  it('bounds dash/vertex work and disposes partial geometry before planar fallback', () => {
    const disposeSpy = vi.spyOn(THREE.BufferGeometry.prototype, 'dispose');
    const dashed = buildVectorArtworkGeometry(plan(vector({ dash: 'dotted', fill: '#f0cc33',
      commands: rectangle(0, 0, 1000, 1000) }), {}, 100_000, 100_000), 0.08);
    expect(dashed.parts).toHaveLength(0);
    expect(dashed.fallbackReason).toMatch(/budget/);
    expect(disposeSpy).toHaveBeenCalled();
    disposeSpy.mockRestore();
    const commands: VectorGeometry['commands'] = [{ op: 'M', values: [0, 0] }];
    for (let index = 1; index < 64; index++) commands.push({ op: 'C', values: [0, 1000, 1000, 0, index % 2 ? 1000 : 0, 1000] });
    const detailed = buildVectorArtworkGeometry(plan(vector({ commands })), 0.08);
    expect(detailed.stats.sampledPoints).toBeLessThanOrEqual(VECTOR_3D_LIMITS.maxSampledPoints);
    expect(detailed.fallbackReason).toMatch(/budget/);
    expect(detailed.parts).toHaveLength(0);
  });

  it('does not mutate source commands/style and produces deterministic geometry', () => {
    const geometry = vector({ fill: '#ffeecc', startArrow: true, endArrow: true, commands: [
      { op: 'M', values: [0, 500] }, { op: 'Q', values: [500, 0, 1000, 500] },
    ] });
    const source = plan(geometry, { borderColor: '#abcdef', opacity: 35 });
    const before = JSON.stringify({ geometry, source });
    const first = buildVectorArtworkGeometry(source, 0.08);
    const second = buildVectorArtworkGeometry(source, 0.08);
    expect(JSON.stringify({ geometry, source })).toBe(before);
    expect(first.stats).toEqual(second.stats);
    expect(first.parts.map((part) => [...part.geometry.getAttribute('position').array]))
      .toEqual(second.parts.map((part) => [...part.geometry.getAttribute('position').array]));
    expect(first.parts.map((part) => part.paint)).toEqual(['fill', 'stroke']);
    dispose(first); dispose(second);
  });
});
