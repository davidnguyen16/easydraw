import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildDiagramScene } from '../client/src/lib/diagram3d/scene-model.ts';

// Match TypeScript's bundler extension resolution for the pure shared catalog;
// no frontend bundle, browser shim, or dependencies are needed by these tests.
registerHooks({ resolve(specifier, context, nextResolve) {
  try { return nextResolve(specifier, context); }
  catch (error) {
    if (error.code !== 'ERR_MODULE_NOT_FOUND' || !specifier.startsWith('.') || !context.parentURL) throw error;
    const candidate = new URL(`${specifier}.ts`, context.parentURL);
    if (!existsSync(fileURLToPath(candidate))) throw error;
    return nextResolve(candidate.href, context);
  }
} });
const { getNodeVisualDefinition, SUPPORTED_3D_NODE_TYPES } = await import('../client/src/lib/diagram3d/visual-catalog.ts');
const { VARIANTS } = await import('../client/src/lib/flow/nodes/shape-geometry.ts');

const node = (id, x = 0, y = 0, extra = {}) => ({ id, type: 'RectangleNode', position: { x, y }, data: { label: id }, width: 100, height: 100, ...extra });
const edge = (id, source, target, extra = {}) => ({ id, source, target, ...extra });

function freeze(value) {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    Object.values(value).forEach(freeze);
  }
  return value;
}

function assertFinite(scene) {
  for (const value of [...scene.center, ...scene.origin, scene.radius, ...scene.nodes.flatMap((n) => [...n.position, ...n.rotation, ...n.size]), ...scene.edges.flatMap((e) => e.points.flat())]) assert.ok(Number.isFinite(value));
}

test('derives a deterministic 3D view without mutating persisted input', () => {
  const nodes = freeze([node('user'), node('db', 400, 200, { type: 'DatabaseNode', data: { label: 'Database' } })]);
  const edges = freeze([edge('request', 'user', 'db', { data: { markerEnd: 'triangle', labels: [{ text: 'Save', t: 0.3 }], bendPoints: [{ x: 250, y: 40 }] } })]);
  const before = JSON.stringify({ nodes, edges });
  const scene = buildDiagramScene(nodes, edges);
  assert.deepEqual(buildDiagramScene(nodes, edges), scene);
  assert.equal(JSON.stringify({ nodes, edges }), before);
  assert.deepEqual(scene.nodes.map((n) => n.id), ['user', 'db']);
  assert.equal(scene.nodes[1].kind, 'cylinder');
  assert.ok(scene.edges[0].points.length >= 3);
  assert.equal(scene.edges[0].bendPoints.length, 1);
  scene.nodes[0].position[0] = 900;
  assert.equal(nodes[0].position.x, 0);
  assert.notEqual(buildDiagramScene(nodes, edges).nodes[0].position[0], 900);
});

test('keeps unknown/legacy nodes, empty labels, entity fields and keys', () => {
  const scene = buildDiagramScene([
    node('legacy', 0, 0, { type: 'OldImportedWidget', data: { label: '' } }),
    node('entity', 300, 0, { type: 'EntityNode', data: { label: 'Accounts', showDataTypes: true, fields: [{ name: 'id', type: 'uuid', isPK: true }, { name: 'owner', key: 'FK', optionalKey: 'PI' }] } }),
  ], []);
  assert.equal(scene.nodes[0].kind, 'box');
  assert.equal(scene.nodes[0].label, '');
  assert.deepEqual(scene.nodes[1].details, ['[PK] id: uuid', '[FK, PI] owner']);
  // Entity's current component has a white card/header and dark title by default.
  assert.equal(scene.nodes[1].color, '#ffffff');
  assert.equal(scene.nodes[1].textColor, '#2c2c2a');
});

test('missing or intentionally empty labels never become object IDs or placeholder text', () => {
  const nodes = freeze([
    node('random-id-1', 0, 0, { data: {} }),
    node('random-id-2', 200, 0, { type: 'UmlInitialNode', data: { label: '' } }),
    node('random-id-3', 400, 0, { data: { title: 'Legacy title' } }),
    node('random-id-4', 600, 0, { data: { name: 'Legacy name' } }),
  ]);
  const before = JSON.stringify(nodes);
  assert.deepEqual(buildDiagramScene(nodes, []).nodes.map((item) => item.label), ['', '', 'Legacy title', 'Legacy name']);
  assert.equal(JSON.stringify(nodes), before);
});

test('resolves parent-local positions and non-default origins', () => {
  const scene = buildDiagramScene([
    node('parent', 400, 200, { width: 400, height: 300, type: 'group', origin: [0.5, 0.5] }),
    node('child', 20, 40, { parentId: 'parent' }),
    node('control', 220, 90),
  ], []);
  assert.deepEqual(scene.nodes[1].position, scene.nodes[2].position);
  assert.equal(scene.nodes[0].kind, 'plane');
});

test('excludes hidden nodes, descendants and their edges, preserving others', () => {
  const scene = buildDiagramScene([node('hidden', 0, 0, { hidden: true }), node('child', 20, 20, { parentId: 'hidden' }), node('visible', 300)], [edge('hidden-edge', 'child', 'visible')]);
  assert.deepEqual(scene.nodes.map((n) => n.id), ['visible']);
  assert.equal(scene.edges.length, 0);
  assert.equal(scene.warnings.length, 0);
});

test('floating connection anchors remain endpoints, not solids', () => {
  const anchors = [node('a', 100, 200, { type: 'connection-anchor', origin: [0.5, 0.5], width: 12, height: 12 }), node('b', 400, 200, { type: 'connection-anchor', origin: [0.5, 0.5], width: 12, height: 12 })];
  const scene = buildDiagramScene(anchors, [edge('floating', 'a', 'b')]);
  assert.equal(scene.nodes.length, 0);
  assert.equal(scene.edges.length, 1);
  assert.equal(scene.edges[0].points[1][0] - scene.edges[0].points[0][0], 3);
  assert.deepEqual(scene.edges[0].points.map((p) => p[2]), [0, 0]);
  assertFinite(scene);
});

test('keeps both marker directions and all labels without inventing arrows', () => {
  const scene = buildDiagramScene([node('a'), node('b', 400)], [
    edge('plain', 'a', 'b'),
    edge('both', 'a', 'b', { data: { markerStart: 'diamond-open', markerEnd: 'circle-crowfoot', labels: [{ text: '1', t: 0.1 }, { text: 'many', t: 0.9 }] } }),
    edge('legacy', 'a', 'b', { markerEnd: { type: 'arrowclosed' }, label: 'Legacy' }),
    edge('override', 'a', 'b', { markerEnd: { type: 'arrowclosed' }, data: { markerEnd: 'none' } }),
  ]);
  assert.equal(scene.edges[0].markerStart, 'none');
  assert.equal(scene.edges[0].markerEnd, 'none');
  assert.equal(scene.edges[1].markerStart, 'diamond-open');
  assert.equal(scene.edges[1].markerEnd, 'circle-crowfoot');
  assert.deepEqual(scene.edges[1].labels, [{ id: 'both:label:0', text: '1', t: 0.1 }, { id: 'both:label:1', text: 'many', t: 0.9 }]);
  assert.equal(scene.edges[2].markerEnd, 'triangle');
  assert.deepEqual(scene.edges[2].labels, [{ id: 'legacy:legacy', text: 'Legacy', t: 0.5 }]);
  assert.equal(scene.edges[3].markerEnd, 'none');
});

test('self loops remain visible with distinct endpoints outside the node', () => {
  const nodes = freeze([node('a')]);
  const edges = freeze([edge('loop', 'a', 'a', { data: { markerStart: 'none', markerEnd: 'triangle' } })]);
  const before = JSON.stringify({ nodes, edges });
  const scene = buildDiagramScene(nodes, edges);
  const points = scene.edges[0].points;
  assert.ok(points.length > 3);
  assert.notDeepEqual(points[0], points.at(-1));
  assert.equal(scene.edges[0].markerStart, 'none');
  assert.equal(scene.edges[0].markerEnd, 'triangle');
  assert.equal(JSON.stringify({ nodes, edges }), before);
  assertFinite(scene);
});

test('honors explicit sizes before stale measurements and existing default/custom CSS colors', () => {
  const scene = buildDiagramScene([
    node('plain'),
    node('custom', 200, 0, { width: 100, measured: { width: 240, height: 180 }, data: { label: 'Styled', fillColor: '#aabbcc', textColor: '#112233' } }),
  ], [edge('default', 'plain', 'custom'), edge('styled', 'custom', 'plain', { data: { strokeColor: '#123456', strokeWidth: 3, lineStyle: 'dashed' } })]);
  assert.equal(scene.nodes[0].color, '#ffffff');
  assert.equal(scene.nodes[0].textColor, '#2c2c2a');
  assert.equal(scene.nodes[1].color, '#aabbcc');
  assert.equal(scene.nodes[1].size[0], 1);
  assert.equal(scene.nodes[1].size[2], 1);
  assert.equal(scene.edges[0].color, '#B4B2A9');
  assert.equal(scene.edges[1].color, '#123456');
  assert.equal(scene.edges[1].width, 3);
  assert.equal(scene.edges[1].dashed, true);
});

test('uses selected handles for connection attachment', () => {
  const scene = buildDiagramScene([node('a'), node('b', 400)], [edge('e', 'a', 'b', { sourceHandle: 'top', targetHandle: 'bottom' })]);
  assert.equal(scene.edges[0].points[0][2], scene.nodes[0].position[2] - scene.nodes[0].size[2] / 2);
  assert.equal(scene.edges[0].points.at(-1)[2], scene.nodes[1].position[2] + scene.nodes[1].size[2] / 2);
});

test('straight and curved routing ignore retained orthogonal bends', () => {
  const nodes = freeze([node('a'), node('b', 400)]);
  const edges = freeze(['orthogonal', 'straight', 'curved'].map((routing) => edge(routing, 'a', 'b', {
    data: { routing, bendPoints: [{ x: 250, y: 1000 }] },
  })));
  const scene = buildDiagramScene(nodes, edges);
  assert.ok(scene.edges[0].points.length >= 3);
  assert.equal(scene.edges[1].points.length, 2);
  assert.equal(scene.edges[2].points.length, 25);
  assert.deepEqual(scene.edges.map((e) => e.bendPoints.length), [1, 0, 0]);
  assert.equal(edges[1].data.bendPoints[0].y, 1000);
});

test('double line style suppresses both markers like the 2D renderer', () => {
  const edges = freeze([edge('double', 'a', 'b', {
    markerEnd: { type: 'arrowclosed' },
    data: { lineStyle: 'double', markerStart: 'diamond', markerEnd: 'triangle' },
  })]);
  const scene = buildDiagramScene([node('a'), node('b', 400)], edges);
  assert.equal(scene.edges[0].markerStart, 'none');
  assert.equal(scene.edges[0].markerEnd, 'none');
  assert.equal(edges[0].data.markerEnd, 'triangle');
});

test('malformed geometry and parent cycles cannot produce NaN/infinite scenes', () => {
  const scene = buildDiagramScene([
    node('a', Infinity, NaN, { width: -10, height: Infinity, origin: [Infinity, NaN], measured: { width: 0, height: NaN }, parentId: 'b' }),
    node('b', 1e300, -1e300, { parentId: 'a', width: 1e300, height: 1e300 }),
  ], [edge('e', 'a', 'b', { data: { strokeWidth: Infinity, labels: [{ text: 'NaN t', t: NaN }], bendPoints: [{ x: NaN, y: 50 }, { x: Infinity, y: 2 }] } })]);
  assertFinite(scene);
  assert.ok(scene.nodes.every((n) => n.size.every((value) => value > 0)));
  assert.ok(scene.warnings.some((warning) => warning.includes('parent chain')));
  assert.equal(scene.edges[0].labels[0].t, 0.5);
});

test('empty diagrams and missing references degrade safely', () => {
  assert.deepEqual(buildDiagramScene([], []), { nodes: [], edges: [], center: [0, 0, 0], origin: [0, 0, 0], radius: 2, warnings: [] });
  const scene = buildDiagramScene([node('orphan', 0, 0, { parentId: 'missing' })], [edge('broken', 'orphan', 'missing')]);
  assert.equal(scene.nodes.length, 1);
  assert.equal(scene.edges.length, 0);
  assert.equal(scene.warnings.length, 2);
  assertFinite(scene);
});

test('scene editing origin stays fixed while nodes move and are inserted', () => {
  const initial = buildDiagramScene([node('a'), node('b', 500)], []);
  const before = structuredClone(initial.origin);
  const moved = buildDiagramScene([node('a', 100), node('b', 500), node('far', 2000)], [], { origin: initial.origin });
  assert.deepEqual(moved.origin, before);
  assert.deepEqual(initial.origin, before);
  assert.equal(moved.nodes[0].position[0] - initial.nodes[0].position[0], 1);
  assert.deepEqual(moved.nodes[1].position, initial.nodes[1].position);
  assert.notEqual(moved.center[0], 0);
});

test('spatial elevation, depth, and rotations use world units with hierarchy elevation', () => {
  const nodes = freeze([
    node('parent', 0, 0, { type: 'group', data: { spatial3d: { elevation: 2 } } }),
    node('child', 100, 200, { parentId: 'parent', selected: true, data: { locked: true, rotation: 90, spatial3d: { elevation: 3, depth: 4, rotationX: 0.2, rotationZ: -0.3 } } }),
  ]);
  const scene = buildDiagramScene(nodes, [], { origin: [0, 0, 0] });
  const child = scene.nodes[1];
  assert.deepEqual(child.position, [1.5, 7, 2.5]);
  assert.deepEqual(child.size, [1, 4, 1]);
  assert.deepEqual(child.rotation, [0.2, -Math.PI / 2, -0.3]);
  assert.equal(child.type, 'RectangleNode');
  assert.equal(child.selected, true);
  assert.equal(child.locked, true);
  assert.equal(nodes[1].data.spatial3d.depth, 4);
});

test('node and edge data snapshots do not alias persisted nested data', () => {
  const nodes = [node('a', 0, 0, { data: { fields: [{ name: 'id' }], spatial3d: { depth: 1 } } }), node('b', 300)];
  const edges = [edge('e', 'a', 'b', { selected: true, data: { labels: [{ id: 'label-1', text: 'Test', t: 0.4 }], bendPoints: [{ x: 200, y: 300, z: 4 }] } })];
  const scene = buildDiagramScene(nodes, edges, { origin: [0, 0, 0] });
  scene.nodes[0].data.fields[0].name = 'changed';
  scene.nodes[0].data.spatial3d.depth = 99;
  scene.edges[0].data.bendPoints[0].x = 999;
  assert.equal(nodes[0].data.fields[0].name, 'id');
  assert.equal(nodes[0].data.spatial3d.depth, 1);
  assert.equal(edges[0].data.bendPoints[0].x, 200);
  assert.deepEqual(scene.edges[0].bendPoints, [[2, 4, 3]]);
  assert.ok(scene.edges[0].points.some((point) => JSON.stringify(point) === JSON.stringify([2, 4, 3])));
  assert.equal(scene.edges[0].selected, true);
  assert.equal(scene.edges[0].labels[0].id, 'label-1');
});

test('connections follow rotated 3D handles instead of old 2D bounding sides', () => {
  const scene = buildDiagramScene([
    node('a', 0, 0, { data: { rotation: 90 } }), node('b', 500),
  ], [edge('e', 'a', 'b', { sourceHandle: 'right' })], { origin: [0, 0, 0] });
  assert.ok(Math.abs(scene.edges[0].points[0][0] - scene.nodes[0].position[0]) < 1e-8);
  assert.equal(scene.edges[0].points[0][2], scene.nodes[0].position[2] + 0.5);
  assertFinite(scene);
});

test('orthogonal and curved routes retain endpoints but derive distinct visible paths', () => {
  const nodes = [node('a'), node('b', 400, 200)];
  const scene = buildDiagramScene(nodes, ['straight', 'orthogonal', 'curved'].map((routing) => edge(routing, 'a', 'b', {
    sourceHandle: 'right', targetHandle: 'left', data: { routing, lineStyle: 'dotted' },
  })));
  assert.deepEqual(scene.edges.map((edge) => edge.points.length), [2, 4, 25]);
  for (const edge of scene.edges) {
    assert.deepEqual(edge.points[0], scene.edges[0].points[0]);
    assert.deepEqual(edge.points.at(-1), scene.edges[0].points.at(-1));
    assert.equal(edge.bendPoints.length, 0);
    assert.equal(edge.lineStyle, 'dotted');
  }
});

test('every registered user node has explicit 3D catalog coverage', () => {
  const registered = [...Object.keys(VARIANTS), 'EntityNode', 'WeakEntityNode', 'CustomImageNode', 'VectorPathNode', 'SourceImageNode', 'group'];
  assert.ok(registered.length > 50);
  assert.equal(new Set(SUPPORTED_3D_NODE_TYPES).size, registered.length);
  for (const type of registered) {
    assert.ok(SUPPORTED_3D_NODE_TYPES.includes(type), type);
    const visual = getNodeVisualDefinition(type);
    assert.notEqual(visual.kind, 'fallback', type);
    if (visual.kind === 'svg') assert.match(visual.svg, /<(path|rect|polygon|ellipse|circle|line)/, type);
  }
  assert.equal(getNodeVisualDefinition('UnknownImportedShape').kind, 'fallback');
});

test('3D silhouettes preserve donut holes, arrow shapes, and UML strokes', () => {
  assert.match(getNodeVisualDefinition('DonutNode').svg, /fill-rule="evenodd"/);
  assert.match(getNodeVisualDefinition('ArrowRightNode').svg, /points="1,30 60,30/);
  assert.match(getNodeVisualDefinition('UmlLifelineNode').svg, /stroke-dasharray="6 5"/);
  assert.match(getNodeVisualDefinition('WeakEntityNode').svg, /x="5" y="5" width="90"/);
});
