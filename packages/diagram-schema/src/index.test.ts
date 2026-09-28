import assert from 'node:assert/strict';
import test from 'node:test';
import { isCustomImageNodeData, isDiagramCamera3D, isDiagramData, isDiagramView3D, validateDiagramData } from './index.js';

test('custom images persist stable references with dimensions, never runtime URLs', () => {
  const data = { assetId: 'asset-1', definitionId: 'template-1', label: 'Factory', intrinsicWidth: 400, intrinsicHeight: 200, fit: 'contain' };
  assert.equal(isCustomImageNodeData(data), true);
  assert.equal(isCustomImageNodeData({ ...data, definitionId: undefined, opacity: 80 }), true);
  for (const patch of [{ assetId: '' }, { assetId: 'https://s3.test/image' }, { intrinsicWidth: Infinity },
    { intrinsicHeight: 0 }, { fit: 'stretch' }, { src: 'blob:temp' }, { url: 'signed' }]) {
    assert.equal(isCustomImageNodeData({ ...data, ...patch }), false);
  }
  assert.deepEqual(JSON.parse(JSON.stringify(data)), data);
});

test('legacy paged diagram without schemaVersion remains valid', () => {
  const legacyDiagram = {
    pages: [
      {
        id: 'page-1',
        name: 'Page 1',
        nodes: [{ id: 'node-1', position: { x: 0, y: 0 }, data: {} }],
        edges: [],
      },
    ],
    activePageId: 'page-1',
  };

  assert.equal(isDiagramData(legacyDiagram), true);
  assert.deepEqual(validateDiagramData(legacyDiagram), { valid: true, issues: [] });
});

test('versioned flat diagram tolerates unknown legacy metadata', () => {
  assert.equal(
    isDiagramData({
      schemaVersion: 1,
      nodes: [],
      edges: [],
      legacyMetadata: { arbitrary: true },
    }),
    true,
  );
});

test('unsupported schema version is rejected', () => {
  const result = validateDiagramData({ schemaVersion: 2, nodes: [], edges: [] });
  assert.equal(result.valid, false);
  assert.equal(result.issues[0]?.code, 'diagram.invalid_document');
});

test('optional 3D camera round-trips without changing a legacy graph', () => {
  const diagram = {
    pages: [{
      id: 'page-1', name: 'Page 1',
      nodes: [{ id: 'a', position: { x: 100, y: 200 }, data: { label: 'API' } }],
      edges: [],
      view3d: { version: 1, camera: { position: [4, 5, 6], target: [0, 0, 0] } },
    }],
    activePageId: 'page-1',
  };
  const restored = JSON.parse(JSON.stringify(diagram));
  assert.equal(isDiagramData(restored), true);
  assert.equal(isDiagramView3D(restored.pages[0].view3d), true);
  assert.deepEqual(restored.pages[0].nodes, diagram.pages[0]!.nodes);
});

test('camera validation rejects corrupt views but the graph can still be loaded', () => {
  assert.equal(isDiagramView3D({ version: 1 }), true);
  assert.equal(isDiagramView3D({ version: 2 }), false);
  assert.equal(isDiagramCamera3D({ position: [0, 0, 0], target: [0, 0, 0] }), false);
  assert.equal(isDiagramCamera3D({ position: [Infinity, 1, 1], target: [0, 0, 0] }), false);
  assert.equal(isDiagramCamera3D({ position: [1, 2], target: [0, 0, 0] }), false);
  assert.equal(isDiagramCamera3D({ position: [1e9, 2, 3], target: [0, 0, 0] }), false);
  assert.equal(isDiagramCamera3D({ position: [1, 2, 3], target: [0, 0, 0] }), true);
  assert.equal(isDiagramData({
    pages: [{ id: 'p', name: 'Old graph', nodes: [], edges: [], view3d: { version: 99 } }],
    activePageId: 'p',
  }), true);
});

test('stable 3D origin is optional, finite and preserved with the camera', () => {
  const view = { version: 1, origin: [12, 0, -4], camera: { position: [4, 5, 6], target: [0, 0, 0] } };
  assert.equal(isDiagramView3D(JSON.parse(JSON.stringify(view))), true);
  for (const origin of [[1, 2], [1, 2, Infinity], [1, 2, 1e9], [1, 2, '3'], new Array(3)]) {
    assert.equal(isDiagramView3D({ ...view, origin }), false);
  }
  assert.equal(isDiagramCamera3D({ position: new Array(3), target: [0, 0, 0] }), false);
});

test('presentation orientation and grid are optional and validated independently of the graph', () => {
  for (const orientation of ['floor', 'upright']) {
    for (const showGrid of [true, false]) {
      const view = { version: 1, orientation, showGrid, origin: [12, 0, -4] };
      assert.equal(isDiagramView3D(JSON.parse(JSON.stringify(view))), true);
    }
  }
  for (const patch of [{ orientation: 'wave' }, { orientation: null }, { showGrid: 'false' }, { showGrid: 1 }]) {
    assert.equal(isDiagramView3D({ version: 1, ...patch }), false);
  }
  assert.equal(isDiagramView3D({ version: 1 }), true);
});
