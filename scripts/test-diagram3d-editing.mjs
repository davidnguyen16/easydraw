import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDiagramScene } from '../client/src/lib/diagram3d/scene-model.ts';
import { transformDiagramNodes, diagramPositionFromWorld } from '../client/src/lib/diagram3d/editing-actions.ts';
import { editableEdgeLabels } from '../client/src/lib/diagram3d/edge-editing.ts';

const node = (id, extra = {}) => ({ id, type: 'RectangleNode', position: { x: 100, y: 200 }, width: 100, height: 100, selected: false, data: { label: id }, ...extra });
const freeze = (value) => {
  if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(freeze); }
  return value;
};
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
const offset = (a, b) => a.map((value, index) => value + b[index]);

test('legacy edge labels get the same stable editing IDs as their scene projection', () => {
  const original = freeze({ id: 'request', source: 'a', target: 'b', label: 'Legacy text', data: {
    labels: [{ text: 'No ID', t: 0.3 }, { id: 'named', text: 'Named label', t: 0.7 }],
  } });
  const expected = buildDiagramScene([node('a'), node('b')], [original]).edges[0].labels;
  assert.deepEqual(editableEdgeLabels(original), expected);
  assert.equal(original.data.labels[0].id, undefined);
  assert.equal(original.label, 'Legacy text');
});

test('edge label normalization deduplicates legacy text and ignores corrupt payloads', () => {
  const edge = { id: 'e', source: 'a', target: 'b', label: 'Once', data: { labels: [null, {}, { id: 'l', text: 'Once', t: Infinity }, { text: 'End', t: 9 }] } };
  assert.deepEqual(editableEdgeLabels(edge), [{ id: 'l', text: 'Once', t: 0.5 }, { id: 'e:label:3', text: 'End', t: 1 }]);
});

test('world projection restores diagram coordinates using a stable scene origin', () => {
  assert.deepEqual(diagramPositionFromWorld([2, 15, -1], [3, 0, 4]), { x: 500, y: 300 });
  const scene = buildDiagramScene([node('a')], []);
  assert.deepEqual(diagramPositionFromWorld(scene.nodes[0].position, scene.origin), { x: 150, y: 250 });
});

test('XZ translation updates shared diagram positions without changing elevation or size', () => {
  const nodes = freeze([node('a')]);
  const scene = buildDiagramScene(nodes, []);
  const result = transformDiagramNodes(nodes, scene, 'a', { position: offset(scene.nodes[0].position, [2, 0, -0.5]) });
  assert.deepEqual(result[0].position, { x: 300, y: 150 });
  assert.equal(result[0].width, 100);
  assert.equal(result[0].height, 100);
  const after = buildDiagramScene(result, [], { origin: scene.origin });
  near(after.nodes[0].position[1], scene.nodes[0].position[1]);
  assert.deepEqual(nodes[0].position, { x: 100, y: 200 });
  assert.equal(nodes[0].data.spatial3d, undefined);
});

test('elevation movement is persisted in world units while 2D coordinates remain unchanged', () => {
  const nodes = freeze([node('a', { data: { spatial3d: { elevation: 2, depth: 1 } } })]);
  const scene = buildDiagramScene(nodes, []);
  const result = transformDiagramNodes(nodes, scene, 'a', { position: offset(scene.nodes[0].position, [0, 3, 0]) });
  assert.deepEqual(result[0].position, nodes[0].position);
  assert.equal(result[0].data.spatial3d.elevation, 5);
  assert.equal(result[0].data.spatial3d.depth, 1);
});

test('resize preserves the object center and writes explicit dimensions for both renderers', () => {
  const nodes = freeze([node('a', { style: { border: '1px solid red' }, data: { spatial3d: { elevation: 2, depth: 1 } } })]);
  const scene = buildDiagramScene(nodes, []);
  const result = transformDiagramNodes(nodes, scene, 'a', { size: [2, 2, 3] });
  assert.equal(result[0].width, 200);
  assert.equal(result[0].height, 300);
  assert.deepEqual(result[0].position, { x: 50, y: 100 });
  assert.deepEqual(result[0].measured, { width: 200, height: 300 });
  assert.equal(result[0].style.border, '1px solid red');
  assert.equal(result[0].data.spatial3d.depth, 2);
  const after = buildDiagramScene(result, [], { origin: scene.origin });
  after.nodes[0].position.forEach((value, index) => near(value, scene.nodes[0].position[index]));
});

test('center-based node origins remain stable during resize', () => {
  const nodes = freeze([node('a', { origin: [0.5, 0.5] })]);
  const scene = buildDiagramScene(nodes, []);
  const result = transformDiagramNodes(nodes, scene, 'a', { size: [2, scene.nodes[0].size[1], 2] });
  assert.deepEqual(result[0].position, nodes[0].position);
});

test('vector depth scaling preserves one-pixel axes and the original numeric drawing', () => {
  for (const [width, height] of [[1, 300], [300, 1]]) {
    const nodes = freeze([node('axis', { type: 'VectorPathNode', width, height,
      data: { vector: { version: 1, commands: [{ op: 'M', values: [0, 0] }, { op: 'L', values: [1000, 1000] }] } },
    })]);
    const scene = buildDiagramScene(nodes, []);
    const size = [...scene.nodes[0].size];
    size[1] *= 2;
    const result = transformDiagramNodes(nodes, scene, 'axis', { size });
    assert.equal(result[0].width, width);
    assert.equal(result[0].height, height);
    assert.deepEqual(result[0].position, nodes[0].position);
    assert.deepEqual(result[0].data.vector, nodes[0].data.vector);
    assert.equal(result[0].data.spatial3d.depth, 0.16);
    const after = buildDiagramScene(result, [], { origin: scene.origin });
    after.nodes[0].position.forEach((value, index) => near(value, scene.nodes[0].position[index]));
  }
});

test('rotation persists Y as shared 2D degrees and X/Z as spatial radians', () => {
  const nodes = freeze([node('a')]);
  const scene = buildDiagramScene(nodes, []);
  const result = transformDiagramNodes(nodes, scene, 'a', { rotation: [0.2, -Math.PI / 2, 0.3] });
  near(result[0].data.rotation, 90);
  near(result[0].data.spatial3d.rotationX, 0.2);
  near(result[0].data.spatial3d.rotationZ, 0.3);
  assert.deepEqual(result[0].position, nodes[0].position);
});

test('multi-selection applies one delta from immutable gesture snapshots', () => {
  const nodes = freeze([node('a', { selected: true }), node('b', { selected: true, position: { x: 500, y: 700 } }), node('unselected')]);
  const scene = buildDiagramScene(nodes, []);
  const patch = { position: offset(scene.nodes[0].position, [1, 2, 3]) };
  const first = transformDiagramNodes(nodes, scene, 'a', patch);
  const repeat = transformDiagramNodes(nodes, scene, 'a', patch);
  assert.deepEqual(first, repeat);
  assert.deepEqual(first[0].position, { x: 200, y: 500 });
  assert.deepEqual(first[1].position, { x: 600, y: 1000 });
  assert.equal(first[2], nodes[2]);
});

test('selected children do not receive a second delta when their parent moves', () => {
  const nodes = freeze([
    node('parent', { type: 'group', selected: true, data: { spatial3d: { elevation: 2 } } }),
    node('child', { parentId: 'parent', selected: true, position: { x: 20, y: 40 } }),
  ]);
  const scene = buildDiagramScene(nodes, []);
  const result = transformDiagramNodes(nodes, scene, 'parent', { position: offset(scene.nodes[0].position, [1, 1, 2]) });
  assert.equal(result[1], nodes[1]);
  assert.deepEqual(result[0].position, { x: 200, y: 400 });
  const after = buildDiagramScene(result, [], { origin: scene.origin });
  after.nodes[1].position.forEach((value, index) => near(value, scene.nodes[1].position[index] + [1, 1, 2][index]));
});

test('moving a child alone preserves local coordinates and inherited elevation', () => {
  const nodes = freeze([
    node('parent', { type: 'group', data: { spatial3d: { elevation: 2 } } }),
    node('child', { parentId: 'parent', selected: true, position: { x: 20, y: 40 } }),
  ]);
  const scene = buildDiagramScene(nodes, []);
  const result = transformDiagramNodes(nodes, scene, 'child', { position: offset(scene.nodes[1].position, [0.5, 1, 0]) });
  assert.equal(result[0], nodes[0]);
  assert.deepEqual(result[1].position, { x: 70, y: 40 });
  assert.equal(result[1].data.spatial3d.elevation, 1);
  const after = buildDiagramScene(result, [], { origin: scene.origin });
  near(after.nodes[1].position[1], scene.nodes[1].position[1] + 1);
});

test('locked and non-draggable selections are never edited by another selected node', () => {
  const nodes = freeze([
    node('a', { selected: true }),
    node('locked', { selected: true, data: { locked: true } }),
    node('fixed', { selected: true, draggable: false }),
  ]);
  const scene = buildDiagramScene(nodes, []);
  const result = transformDiagramNodes(nodes, scene, 'a', { position: offset(scene.nodes[0].position, [1, 0, 0]) });
  assert.equal(result[1], nodes[1]);
  assert.equal(result[2], nodes[2]);
  assert.deepEqual(transformDiagramNodes(nodes, scene, 'locked', { position: [1, 1, 1] }), nodes);
  assert.deepEqual(transformDiagramNodes(nodes, scene, 'missing', { position: [1, 1, 1] }), nodes);
});

test('snap uses the editor 20px grid without snapping vertical elevation', () => {
  const nodes = [node('a', { position: { x: 103, y: 207 }, data: { spatial3d: { elevation: 1 } } })];
  const scene = buildDiagramScene(nodes, []);
  const result = transformDiagramNodes(nodes, scene, 'a', { position: offset(scene.nodes[0].position, [0.11, 0.15, 0.04]) }, true);
  assert.deepEqual(result[0].position, { x: 120, y: 220 });
  near(result[0].data.spatial3d.elevation, 1.15);
});

test('invalid and absent vectors are harmless no-ops, not NaN or added document data', () => {
  const nodes = freeze([node('a')]);
  const scene = buildDiagramScene(nodes, []);
  for (const patch of [{}, { position: [NaN, 0, 0] }, { size: [1, Infinity, 1] }, { rotation: [0, 0, NaN] }, { position: [] }, { position: [1, 2] }, { position: [1, 2, 3, 4] }, { position: new Array(3) }]) {
    const result = transformDiagramNodes(nodes, scene, 'a', patch);
    assert.equal(result[0], nodes[0], JSON.stringify(patch));
  }
});

test('extreme finite transforms are bounded before being persisted', () => {
  const nodes = [node('a')];
  const scene = buildDiagramScene(nodes, []);
  const result = transformDiagramNodes(nodes, scene, 'a', { position: [1e308, 1e308, -1e308], size: [1e308, 1e308, 1e308], rotation: [1e308, 1e308, -1e308] });
  for (const value of [result[0].position.x, result[0].position.y, result[0].width, result[0].height, result[0].data.rotation, ...Object.values(result[0].data.spatial3d)]) assert.ok(Number.isFinite(value));
  assert.ok(Math.abs(result[0].position.x) <= 100_000);
  assert.ok(result[0].data.spatial3d.depth <= 1_000);
});
