import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildDiagramScene } from '../client/src/lib/diagram3d/scene-model.ts';

registerHooks({ resolve(specifier, context, nextResolve) {
  try { return nextResolve(specifier, context); }
  catch (error) {
    if (error.code !== 'ERR_MODULE_NOT_FOUND' || !specifier.startsWith('.') || !context.parentURL) throw error;
    const candidate = new URL(`${specifier}.ts`, context.parentURL);
    if (!existsSync(fileURLToPath(candidate))) throw error;
    return nextResolve(candidate.href, context);
  }
} });
const { ungroupSelectedGraph } = await import('../client/src/lib/flow/ungroup-graph.ts');
const node = (id, extra = {}) => ({ id, type: 'RectangleNode', position: { x: 100, y: 200 }, width: 100, height: 100, data: { label: id }, ...extra });
const edge = (id, source, target, extra = {}) => ({ id, source, target, ...extra });
const freeze = (value) => {
  if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(freeze); }
  return value;
};
const nextId = () => { let index = 0; return () => `floating-${++index}`; };
const near = (actual, expected) => actual.forEach((value, index) => assert.ok(Math.abs(value - expected[index]) < 1e-8, `${actual} != ${expected}`));
const scene = (nodes, edges = []) => buildDiagramScene(nodes, edges, { origin: [0, 0, 0] });
function assertReferences(result) {
  const ids = new Set(result.nodes.map((node) => node.id));
  for (const edge of result.edges) assert.ok(ids.has(edge.source) && ids.has(edge.target), edge.id);
}

test('ungroup keeps incoming and outgoing edges attached to one shared floating endpoint', () => {
  const nodes = freeze([node('group', { type: 'group', selected: true, width: 400, height: 200 }), node('child', { parentId: 'group' }), node('outside')]);
  const edges = freeze([
    edge('outgoing', 'group', 'outside', { sourceHandle: 'right', targetHandle: 'left', label: 'legacy', data: { labels: [{ id: 'label', text: 'request', t: 0.2 }], bendPoints: [{ x: 400, y: 500, z: 2 }], markerEnd: 'triangle' } }),
    edge('incoming', 'outside', 'group', { sourceHandle: 'bottom', targetHandle: 'top' }),
    edge('untouched', 'child', 'outside'),
  ]);
  const result = ungroupSelectedGraph(nodes, edges, nextId());
  assert.equal(result.ungrouped, true);
  assert.ok(!result.nodes.some((node) => node.id === 'group'));
  const anchors = result.nodes.filter((node) => node.type === 'connection-anchor');
  assert.equal(anchors.length, 1);
  assert.equal(result.edges[0].source, anchors[0].id);
  assert.equal(result.edges[0].sourceHandle, 'a');
  assert.equal(result.edges[0].targetHandle, 'left');
  assert.equal(result.edges[1].target, anchors[0].id);
  assert.equal(result.edges[1].targetHandle, 'a');
  assert.equal(result.edges[1].sourceHandle, 'bottom');
  assert.equal(result.edges[0].id, 'outgoing');
  assert.equal(result.edges[0].data, edges[0].data);
  assert.equal(result.edges[0].label, 'legacy');
  assert.equal(result.edges[2], edges[2]);
  assertReferences(result);
  const groupCenter = scene(nodes).nodes.find((node) => node.id === 'group').position;
  near(scene(result.nodes, result.edges).edges[0].points[0], groupCenter);
});

test('self loops and edges between two removed groups remain valid without multiplying anchors', () => {
  const nodes = freeze([node('one', { type: 'group', selected: true }), node('two', { type: 'group', selected: true, position: { x: 500, y: 600 } })]);
  const edges = freeze([edge('loop', 'one', 'one'), edge('between', 'one', 'two')]);
  const result = ungroupSelectedGraph(nodes, edges, nextId());
  assert.equal(result.nodes.length, 2);
  assert.ok(result.nodes.every((node) => node.type === 'connection-anchor'));
  assert.equal(result.edges[0].source, result.edges[0].target);
  assert.notEqual(result.edges[1].source, result.edges[1].target);
  assertReferences(result);
  assert.equal(scene(result.nodes, result.edges).edges.length, 2);
});

test('nested group origins, rotations and elevations are captured before ungrouping', () => {
  const nodes = freeze([
    node('outer', { type: 'group', selected: true, origin: [0.5, 0.5], position: { x: 400, y: 300 }, width: 500, height: 400, data: { spatial3d: { elevation: 2, depth: 0.2 } } }),
    node('inner', { type: 'group', parentId: 'outer', selected: true, origin: [0.5, 0.5], position: { x: 100, y: 100 }, width: 200, height: 160, data: { rotation: 90, spatial3d: { elevation: 3, depth: 0.4, rotationX: 0.1 } } }),
    node('child', { parentId: 'inner', position: { x: 20, y: 30 }, data: { spatial3d: { elevation: 1 } } }),
    node('outside', { position: { x: 900, y: 900 } }),
  ]);
  const edges = freeze([edge('outer-edge', 'outer', 'outside'), edge('inner-edge', 'inner', 'outside')]);
  const before = scene(nodes);
  const result = ungroupSelectedGraph(nodes, edges, nextId());
  const after = scene(result.nodes, result.edges);
  for (const [index, id] of ['outer', 'inner'].entries()) near(after.edges[index].points[0], before.nodes.find((node) => node.id === id).position);
  near(after.nodes.find((node) => node.id === 'child').position, before.nodes.find((node) => node.id === 'child').position);
  assert.equal(result.nodes.find((node) => node.id === 'child').parentId, undefined);
  assertReferences(result);
});

test('hidden groups and hidden ancestors still get accurate connection anchors', () => {
  const nodes = freeze([
    node('outer', { type: 'group', hidden: true, position: { x: 400, y: 300 }, data: { spatial3d: { elevation: 2 } } }),
    node('inner', { type: 'group', parentId: 'outer', selected: true, hidden: true, position: { x: 50, y: 70 }, data: { spatial3d: { elevation: 3 } } }),
    node('outside'),
  ]);
  const edges = freeze([edge('hidden-edge', 'inner', 'outside', { hidden: true })]);
  const result = ungroupSelectedGraph(nodes, edges, nextId());
  const anchor = result.nodes.find((node) => node.type === 'connection-anchor');
  assert.deepEqual(anchor.position, { x: 500, y: 420 });
  near([anchor.data.spatial3d.elevation], [5.02]);
  assert.equal(result.edges[0].hidden, true);
  assertReferences(result);
});

test('unconnected groups do not create unused anchors or replace unrelated edges', () => {
  const nodes = [node('group', { type: 'group', selected: true }), node('child', { parentId: 'group' }), node('outside')];
  const edges = [edge('unrelated', 'child', 'outside')];
  const result = ungroupSelectedGraph(nodes, edges, () => { throw new Error('must not request an ID'); });
  assert.equal(result.ungrouped, true);
  assert.equal(result.edges, edges);
  assert.ok(!result.nodes.some((node) => node.type === 'connection-anchor'));
  assertReferences(result);
});

test('locked groups and groups with locked descendants are graph-preserving no-ops', () => {
  const nodes = freeze([node('group', { type: 'group', selected: true }), node('locked-child', { parentId: 'group', data: { locked: true } }), node('outside')]);
  const edges = freeze([edge('attached', 'group', 'outside')]);
  const result = ungroupSelectedGraph(nodes, edges, nextId());
  assert.equal(result.ungrouped, false);
  assert.equal(result.nodes, nodes);
  assert.equal(result.edges, edges);
});

test('ID collisions fail atomically instead of corrupting graph references', () => {
  const nodes = freeze([node('group', { type: 'group', selected: true }), node('outside')]);
  const edges = freeze([edge('attached', 'group', 'outside')]);
  assert.throws(() => ungroupSelectedGraph(nodes, edges, () => 'outside'), /unique/);
  assert.throws(() => ungroupSelectedGraph(nodes, edges, () => ''), /non-empty/);
  assert.equal(nodes[0].id, 'group');
  assert.equal(edges[0].source, 'group');
});
