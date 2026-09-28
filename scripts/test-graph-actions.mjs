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
const { copySelection, pasteSnapshot, duplicateSelectedNodes, deleteSelectedGraph, groupSelectedNodes, ungroupSelectedNodes, selectAllGraph } = await import('../client/src/lib/flow/graph-actions.ts');
const node = (id, extra = {}) => ({ id, type: 'RectangleNode', position: { x: 100, y: 200 }, width: 100, height: 100, selected: false, data: { label: id }, ...extra });
const edge = (id, source, target, extra = {}) => ({ id, source, target, ...extra });
const freeze = (value) => {
  if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(freeze); }
  return value;
};
const positions = (nodes) => new Map(buildDiagramScene(nodes, [], { origin: [0, 0, 0] }).nodes.map((node) => [node.id, node.position]));
const near = (actual, expected) => actual.forEach((value, index) => assert.ok(Math.abs(value - expected[index]) < 1e-8, `${actual} != ${expected}`));
const createOnEdit = () => () => {};

test('delete removes selected nodes, descendants and incident edges without dangling references', () => {
  const nodes = freeze([node('group', { type: 'group', selected: true }), node('child', { parentId: 'group' }), node('grandchild', { parentId: 'child' }), node('keep')]);
  const edges = freeze([edge('inside', 'child', 'grandchild'), edge('outgoing', 'group', 'keep'), edge('incoming', 'keep', 'grandchild'), edge('survivor', 'keep', 'keep')]);
  const result = deleteSelectedGraph(nodes, edges);
  assert.equal(result.changed, true);
  assert.deepEqual(result.nodes.map((node) => node.id), ['keep']);
  assert.deepEqual(result.edges.map((edge) => edge.id), ['survivor']);
  assert.equal(nodes.length, 4);
  assert.equal(edges.length, 4);
});

test('delete protects locked descendants and ancestors while still deleting unrelated selections', () => {
  const nodes = freeze([node('group', { type: 'group', selected: true }), node('inner', { type: 'group', parentId: 'group' }), node('locked', { parentId: 'inner', data: { locked: true } }), node('remove', { selected: true }), node('fixed', { selected: true, deletable: false })]);
  const result = deleteSelectedGraph(nodes, []);
  assert.deepEqual(result.nodes.map((node) => node.id), ['group', 'inner', 'locked', 'fixed']);
});

test('edge deletion honors locks and cleans floating endpoints only after the last reference', () => {
  const nodes = freeze([node('a'), node('float', { type: 'connection-anchor', draggable: false }), node('orphan-locked', { type: 'connection-anchor', data: { locked: true } })]);
  const edges = freeze([edge('remove', 'a', 'float', { selected: true }), edge('keep', 'a', 'float', { selected: true, deletable: false }), edge('data-lock', 'a', 'a', { selected: true, data: { locked: true } })]);
  const result = deleteSelectedGraph(nodes, edges);
  assert.deepEqual(result.edges.map((edge) => edge.id), ['keep', 'data-lock']);
  assert.ok(result.nodes.some((node) => node.id === 'float'));
  assert.ok(result.nodes.some((node) => node.id === 'orphan-locked'));
  const afterLastEdge = deleteSelectedGraph(result.nodes, [edge('last', 'a', 'float', { selected: true })]);
  assert.ok(!afterLastEdge.nodes.some((node) => node.id === 'float'));
});

test('group then ungroup preserves every node world position including implicit ground elevation', () => {
  const nodes = freeze([node('a', { selected: true }), node('b', { selected: true, position: { x: 400, y: 300 }, data: { spatial3d: { elevation: 3, depth: 2 } } }), node('keep')]);
  const before = positions(nodes);
  const grouped = groupSelectedNodes(nodes);
  assert.equal(grouped.grouped, true);
  const group = grouped.nodes.find((node) => node.type === 'group');
  assert.equal(group.data.spatial3d.elevation, 0);
  assert.equal(grouped.nodes.find((node) => node.id === 'a').data.spatial3d.elevation, 0.04);
  for (const [id, position] of before) near(positions(grouped.nodes).get(id), position);
  const ungrouped = ungroupSelectedNodes(grouped.nodes);
  assert.equal(ungrouped.ungrouped, true);
  assert.deepEqual(new Set(ungrouped.nodes.map((node) => node.id)), new Set(nodes.map((node) => node.id)));
  for (const [id, position] of before) near(positions(ungrouped.nodes).get(id), position);
});

test('group bounds account for center origins and groups with style-only dimensions', () => {
  const nodes = [node('center', { selected: true, origin: [0.5, 0.5], position: { x: 100, y: 100 } }), node('existing-group', { type: 'group', selected: true, position: { x: 400, y: 100 }, width: undefined, height: undefined, style: { width: '300px', height: 200 } })];
  const result = groupSelectedNodes(nodes);
  const group = result.nodes[0];
  assert.deepEqual(group.position, { x: 26, y: 26 });
  assert.deepEqual(group.style, { width: 698, height: 298 });
  const before = positions(nodes);
  for (const [id, position] of before) near(positions(result.nodes).get(id), position);
});

test('group ignores locked/fixed nodes and is a no-op when fewer than two roots are eligible', () => {
  const nodes = freeze([node('a', { selected: true }), node('locked', { selected: true, data: { locked: true } }), node('fixed', { selected: true, draggable: false }), node('child', { selected: true, parentId: 'a' })]);
  assert.equal(groupSelectedNodes(nodes).grouped, false);
  assert.equal(groupSelectedNodes(nodes).nodes, nodes);
});

test('nested selected groups ungroup in one pass without stale parents or losing elevation', () => {
  const nodes = freeze([
    node('outer', { type: 'group', selected: true, origin: [0.5, 0.5], width: 400, height: 300, position: { x: 300, y: 300 }, data: { spatial3d: { elevation: 2 } } }),
    node('inner', { type: 'group', selected: true, parentId: 'outer', position: { x: 30, y: 40 }, data: { spatial3d: { elevation: 3 } } }),
    node('child', { parentId: 'inner', position: { x: 10, y: 20 }, data: { spatial3d: { elevation: 4 } } }),
  ]);
  const before = positions(nodes).get('child');
  const result = ungroupSelectedNodes(nodes);
  assert.deepEqual(result.nodes.map((node) => node.id), ['child']);
  assert.equal(result.nodes[0].parentId, undefined);
  assert.deepEqual(result.nodes[0].position, { x: 140, y: 210 });
  assert.equal(result.nodes[0].data.spatial3d.elevation, 9);
  near(positions(result.nodes).get('child'), before);
});

test('ungrouping only an inner group reattaches children to the retained parent', () => {
  const nodes = freeze([
    node('outer', { type: 'group', data: { spatial3d: { elevation: 2 } } }),
    node('inner', { type: 'group', selected: true, parentId: 'outer', position: { x: 30, y: 40 }, data: { spatial3d: { elevation: 3 } } }),
    node('child', { parentId: 'inner', position: { x: 10, y: 20 }, extent: 'parent' }),
  ]);
  const result = ungroupSelectedNodes(nodes);
  const child = result.nodes.find((node) => node.id === 'child');
  assert.equal(child.parentId, 'outer');
  assert.equal(child.extent, 'parent');
  assert.deepEqual(child.position, { x: 40, y: 60 });
  near(positions(result.nodes).get('child'), positions(nodes).get('child'));
});

test('ungroup does not bypass a locked child by removing its parent', () => {
  const nodes = freeze([node('group', { type: 'group', selected: true }), node('locked', { parentId: 'group', data: { locked: true } })]);
  const result = ungroupSelectedNodes(nodes);
  assert.equal(result.ungrouped, false);
  assert.equal(result.nodes, nodes);
});

test('copy/paste includes group descendants, remaps parents/edges and offsets only roots', () => {
  const nodes = freeze([node('group', { type: 'group', selected: true, position: { x: 0, y: 0 } }), node('a', { parentId: 'group', position: { x: 20, y: 30 } }), node('b', { parentId: 'group', position: { x: 80, y: 100 } })]);
  const edges = freeze([edge('inside', 'a', 'b', { data: { bendPoints: [{ x: 50, y: 80, z: 3 }], labels: [{ id: 'label', text: 'saved' }] } })]);
  const snapshot = freeze(copySelection(nodes, edges));
  assert.equal(snapshot.nodes.length, 3);
  assert.equal(snapshot.edges.length, 1);
  const result = pasteSnapshot(nodes, edges, snapshot, 1, createOnEdit);
  const copies = result.nodes.slice(nodes.length);
  const group = copies.find((node) => node.type === 'group');
  assert.notEqual(group.id, 'group');
  assert.deepEqual(group.position, { x: 32, y: 32 });
  for (const child of copies.filter((node) => node !== group)) {
    assert.equal(child.parentId, group.id);
    assert.equal(child.selected, false);
    assert.deepEqual(child.position, nodes.find((original) => original.data.label === child.data.label).position);
  }
  const copiedEdge = result.edges.at(-1);
  assert.ok(copies.some((node) => node.id === copiedEdge.source));
  assert.ok(copies.some((node) => node.id === copiedEdge.target));
  assert.deepEqual(copiedEdge.data.bendPoints, [{ x: 82, y: 112, z: 3 }]);
});

test('copying a child alone flattens ancestors, including origins and default elevations', () => {
  const nodes = freeze([
    node('outer', { type: 'group', origin: [0.5, 0.5], width: 400, height: 300, position: { x: 300, y: 300 } }),
    node('inner', { type: 'group', parentId: 'outer', position: { x: 30, y: 40 }, data: { spatial3d: { elevation: 2 } } }),
    node('child', { selected: true, parentId: 'inner', position: { x: 10, y: 20 }, extent: 'parent' }),
  ]);
  const snapshot = copySelection(nodes, []);
  assert.equal(snapshot.nodes.length, 1);
  assert.equal(snapshot.nodes[0].parentId, undefined);
  assert.equal(snapshot.nodes[0].extent, undefined);
  assert.deepEqual(snapshot.nodes[0].position, { x: 140, y: 210 });
  near(positions(snapshot.nodes).get('child'), positions(nodes).get('child'));
});

test('clipboard and repeated pastes do not share nested fields, spatial metadata or styles', () => {
  const nodes = [node('a', { selected: true, style: { width: 100 }, data: { fields: [{ name: 'id' }], spatial3d: { depth: 2 } } })];
  const snapshot = copySelection(nodes, []);
  const one = pasteSnapshot(nodes, [], snapshot, 1, createOnEdit).nodes.at(-1);
  const two = pasteSnapshot(nodes, [], snapshot, 2, createOnEdit).nodes.at(-1);
  one.data.fields[0].name = 'changed'; one.data.spatial3d.depth = 9; one.style.width = 777;
  assert.equal(two.data.fields[0].name, 'id');
  assert.equal(two.data.spatial3d.depth, 2);
  assert.equal(two.style.width, 100);
  assert.equal(snapshot.nodes[0].data.fields[0].name, 'id');
  assert.equal(nodes[0].data.fields[0].name, 'id');
});

test('edge-only paste preserves valid existing endpoints and rejects missing endpoints', () => {
  const nodes = freeze([node('a'), node('b')]);
  const edges = freeze([edge('e', 'a', 'b', { selected: true, data: { bendPoints: [{ x: 10, y: 20 }] } })]);
  const snapshot = freeze(copySelection(nodes, edges));
  assert.equal(snapshot.nodes.length, 0);
  const result = pasteSnapshot(nodes, edges, snapshot, 1, createOnEdit);
  assert.equal(result.nodes.length, 2);
  assert.equal(result.edges.length, 2);
  assert.notEqual(result.edges[1].id, 'e');
  assert.equal(result.edges[1].source, 'a');
  assert.equal(result.edges[1].target, 'b');
  assert.deepEqual(result.edges[1].data.bendPoints, [{ x: 10, y: 20 }]);
  assert.equal(pasteSnapshot([nodes[0]], [], snapshot, 1, createOnEdit).edges.length, 0);
});

test('floating-edge copying includes anchors, remaps endpoints and does not select hidden anchors', () => {
  const nodes = freeze([node('a', { type: 'connection-anchor', draggable: false }), node('b', { type: 'connection-anchor', draggable: false })]);
  const edges = freeze([edge('floating', 'a', 'b', { selected: true })]);
  const snapshot = copySelection(nodes, edges);
  assert.equal(snapshot.nodes.length, 2);
  const result = pasteSnapshot(nodes, edges, snapshot, 1, createOnEdit);
  assert.ok(result.nodes.slice(2).every((node) => !node.selected));
  assert.ok(result.nodes.slice(2).some((node) => node.id === result.edges[1].source));
  assert.ok(result.nodes.slice(2).some((node) => node.id === result.edges[1].target));
});

test('legacy duplicate-node action now copies descendants and independent data', () => {
  const nodes = freeze([node('group', { type: 'group', selected: true }), node('child', { parentId: 'group', data: { fields: [{ name: 'id' }] } })]);
  const result = duplicateSelectedNodes(nodes, createOnEdit);
  assert.equal(result.length, 4);
  const group = result[2], child = result[3];
  assert.equal(child.parentId, group.id);
  assert.deepEqual(group.position, { x: 130, y: 230 });
  assert.deepEqual(child.position, nodes[1].position);
  child.data.fields[0].name = 'changed';
  assert.equal(nodes[1].data.fields[0].name, 'id');
});

test('empty selection is a no-op and select-all omits hidden anchor nodes', () => {
  const nodes = [node('a'), node('hidden', { type: 'connection-anchor' })];
  assert.equal(copySelection(nodes, []), null);
  assert.equal(duplicateSelectedNodes(nodes, createOnEdit), nodes);
  const selection = selectAllGraph(nodes, [edge('e', 'a', 'hidden')]);
  assert.equal(selection.nodes[0].selected, true);
  assert.equal(selection.nodes[1].selected, false);
  assert.equal(selection.edges[0].selected, true);
});
