import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  WHITEBOARD_DIAGRAM_DRAFT_SCHEMA_V1,
  WHITEBOARD_DIAGRAM_DRAFT_LIMITS,
  WHITEBOARD_DIAGRAM_DRAFT_SHAPES,
  WHITEBOARD_DIAGRAM_DRAFT_DIRECTIONS,
  validateWhiteboardDiagramDraft,
  isWhiteboardDiagramDraft,
  isDiagramData,
  type WhiteboardDiagramDraftV1,
} from './index.js';

function fixture(name = 'flowchart'): WhiteboardDiagramDraftV1 {
  const value: unknown = JSON.parse(readFileSync(new URL(`../fixtures/whiteboard-generation-${name}.json`, import.meta.url), 'utf8'));
  assert.ok(isWhiteboardDiagramDraft(value), `${name} fixture must follow the public contract`);
  return value;
}

function invalid(value: unknown) {
  const result = validateWhiteboardDiagramDraft(value);
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.severity === 'error'));
  assert.ok(result.issues.every((issue) => issue.code && issue.message && issue.path));
  assert.equal(isWhiteboardDiagramDraft(value), false);
}

function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    Object.values(value).forEach(freeze);
  }
  return value;
}

test('public fixtures cover branches, uncertainty, multilingual labels and unrecognized input', () => {
  for (const name of ['flowchart', 'warnings', 'unrecognized']) {
    assert.deepEqual(validateWhiteboardDiagramDraft(fixture(name)), { valid: true, issues: [] });
  }
  assert.equal(fixture().nodes[0]!.label, 'Bắt đầu');
  const uncertain = fixture('warnings');
  assert.equal(uncertain.nodes.find((node) => node.id === 'service')!.label, '');
  assert.equal(uncertain.edges.find((edge) => edge.id === 'query')!.direction, 'none');
});

test('validation is deterministic and never mutates the draft or frozen fixtures', () => {
  const draft = freeze(fixture());
  const original = JSON.stringify(draft);
  const first = validateWhiteboardDiagramDraft(draft);
  const second = validateWhiteboardDiagramDraft(draft);
  assert.deepEqual(first, second);
  first.issues.push({ code: 'consumer', message: 'Consumer-owned result', severity: 'error' });
  assert.deepEqual(second.issues, []);
  assert.equal(JSON.stringify(draft), original);
});

test('invalid JSON shapes, unsupported versions and missing root fields are rejected', () => {
  for (const value of [null, undefined, false, 7, 'diagram', [], {}, { ...fixture(), version: 2 },
    { ...fixture(), outcome: 'success' }, { ...fixture(), nodes: null },
    { ...fixture(), edges: {} }, { ...fixture(), warnings: null }]) invalid(value);
  for (const key of Object.keys(fixture())) {
    const value: Record<string, unknown> = { ...fixture() };
    delete value[key];
    invalid(value);
  }
});

test('all supported shapes and directions accept finite bounded geometry', () => {
  const draft = fixture();
  for (const shape of WHITEBOARD_DIAGRAM_DRAFT_SHAPES) {
    draft.nodes[0]!.shape = shape;
    assert.ok(isWhiteboardDiagramDraft(draft));
  }
  for (const direction of WHITEBOARD_DIAGRAM_DRAFT_DIRECTIONS) {
    draft.edges[0]!.direction = direction;
    assert.ok(isWhiteboardDiagramDraft(draft));
  }
});

test('strict objects reject extra executable, asset and provider-owned fields at every level', () => {
  invalid({ ...fixture(), javascript: 'alert(1)' });
  invalid({ ...fixture(), model: 'provider-must-not-decide-this' });
  for (const patch of [{ assetId: 'someone-elses-asset' }, { type: 'CustomImageNode' },
    { visual3d: {} }, { onClick: 'run()' }, { url: 'https://example.test/image.png' }]) {
    const draft = fixture();
    draft.nodes[0] = { ...draft.nodes[0]!, ...patch };
    invalid(draft);
  }
  invalid({ ...fixture(), nodes: [{ ...fixture().nodes[0]!, shape: 'server' }] });
  invalid({ ...fixture(), edges: [{ ...fixture().edges[0]!, direction: 'reverse' }] });
  const extraBounds = fixture();
  Object.assign(extraBounds.nodes[0]!.bounds, { z: 1 });
  invalid(extraBounds);
  const extraEdge = fixture();
  Object.assign(extraEdge.edges[0]!, { routing: 'arbitrary' });
  invalid(extraEdge);
  const extraWarning = fixture('warnings');
  Object.assign(extraWarning.warnings[0]!, { confidence: 0.99 });
  invalid(extraWarning);
});

test('IDs follow their syntax, are globally unique, and edge endpoints must be nodes', () => {
  for (const id of ['', 'two words', '1bad', 'a'.repeat(65), 'a/b', '__proto__']) {
    const draft = fixture(); draft.nodes[0]!.id = id; invalid(draft);
  }
  const duplicateNode = fixture(); duplicateNode.nodes[1]!.id = duplicateNode.nodes[0]!.id; invalid(duplicateNode);
  const duplicateEdge = fixture(); duplicateEdge.edges[1]!.id = duplicateEdge.edges[0]!.id; invalid(duplicateEdge);
  const crossKind = fixture(); crossKind.edges[0]!.id = crossKind.nodes[0]!.id; invalid(crossKind);
  for (const endpoint of ['missing', fixture().edges[1]!.id]) {
    const draft = fixture(); draft.edges[0]!.targetId = endpoint; invalid(draft);
  }
  const source = fixture(); source.edges[0]!.sourceId = 'missing'; invalid(source);
  const self = fixture(); self.edges[0]!.targetId = self.edges[0]!.sourceId;
  assert.ok(isWhiteboardDiagramDraft(self), 'explicit self-loops are valid');
  const legalSpecial = fixture(); legalSpecial.nodes.push({ ...legalSpecial.nodes[0]!, id: 'constructor' });
  assert.ok(isWhiteboardDiagramDraft(legalSpecial), 'use safe Sets, not object-property lookup for IDs');
});

test('bounds are normalized integers and the entire rectangle stays in the source image', () => {
  for (const key of ['x', 'y', 'width', 'height'] as const) {
    for (const value of [-1, 0.5, 1001, NaN, Infinity, -Infinity]) {
      const draft = fixture(); draft.nodes[0]!.bounds[key] = value; invalid(draft);
    }
  }
  for (const key of ['width', 'height'] as const) {
    const draft = fixture(); draft.nodes[0]!.bounds[key] = 0; invalid(draft);
  }
  const horizontal = fixture(); horizontal.nodes[0]!.bounds = { x: 999, y: 0, width: 2, height: 1 }; invalid(horizontal);
  const vertical = fixture(); vertical.nodes[0]!.bounds = { x: 0, y: 999, width: 1, height: 2 }; invalid(vertical);
  const boundary = fixture(); boundary.nodes[0]!.bounds = { x: 999, y: 999, width: 1, height: 1 };
  assert.ok(isWhiteboardDiagramDraft(boundary));
  boundary.nodes[0]!.bounds = { x: 0, y: 0, width: 1000, height: 1000 };
  assert.ok(isWhiteboardDiagramDraft(boundary));
  invalid({ ...fixture(), nodes: [{ ...fixture().nodes[0]!, bounds: { x: '0', y: 0, width: 1, height: 1 } }] });
});

test('labels remain plain uninterpreted strings; size and type limits are enforced', () => {
  const draft = fixture();
  draft.nodes[0]!.label = '<script>alert(1)</script>\nTiếng Việt: đặt vé';
  assert.ok(isWhiteboardDiagramDraft(draft), 'renderer must display text, not execute markup');
  draft.nodes[0]!.label = 'x'.repeat(500);
  assert.ok(isWhiteboardDiagramDraft(draft));
  draft.nodes[0]!.label += 'x'; invalid(draft);
  draft.nodes[0]!.label = '😀'.repeat(250);
  assert.ok(isWhiteboardDiagramDraft(draft), 'server counts UTF-16 code units');
  draft.nodes[0]!.label += '😀'; invalid(draft);
  const edgeLabel = fixture(); edgeLabel.edges[0]!.label = 'x'.repeat(501); invalid(edgeLabel);
  invalid({ ...fixture(), nodes: [{ ...fixture().nodes[0]!, label: null }] });
});

test('outcome never requires hallucinated nodes for unrecognized input', () => {
  invalid({ ...fixture(), nodes: [], edges: [] });
  invalid({ ...fixture('unrecognized'), warnings: [] });
  invalid({ ...fixture('unrecognized'), nodes: [fixture().nodes[0]!] });
  invalid({ ...fixture('unrecognized'), edges: [fixture().edges[0]!] });
  assert.ok(isWhiteboardDiagramDraft(fixture('unrecognized')));
});

test('warnings require known codes, meaningful messages and valid optional references', () => {
  for (const patch of [{ code: 'low-confidence' }, { message: '' }, { message: ' \n\t ' },
    { message: 'x'.repeat(501) }, { elementId: 'missing' }, { elementId: 123 }]) {
    const draft = fixture('warnings'); Object.assign(draft.warnings[0]!, patch); invalid(draft);
  }
  const missing = fixture('warnings');
  const warning: Record<string, unknown> = { ...missing.warnings[0]! };
  delete warning.elementId;
  invalid({ ...missing, warnings: [warning] });
});

test('cardinality limits are inclusive and sparse arrays are invalid', () => {
  const draft = fixture();
  draft.nodes = Array.from({ length: 50 }, (_, i) => ({ ...draft.nodes[0]!, id: `node-${i}` }));
  draft.edges = Array.from({ length: 100 }, (_, i) => ({ ...draft.edges[0]!, id: `edge-${i}`, sourceId: 'node-0', targetId: 'node-1' }));
  draft.warnings = Array.from({ length: 30 }, () => ({ code: 'ambiguous-shape' as const, message: 'Check this shape.', elementId: null }));
  assert.ok(isWhiteboardDiagramDraft(draft));
  invalid({ ...draft, nodes: [...draft.nodes, { ...draft.nodes[0]!, id: 'overflow-node' }] });
  invalid({ ...draft, edges: [...draft.edges, { ...draft.edges[0]!, id: 'overflow-edge' }] });
  invalid({ ...draft, warnings: [...draft.warnings, draft.warnings[0]!] });
  for (const field of ['nodes', 'edges', 'warnings']) invalid({ ...fixture(), [field]: new Array(2) });
  invalid({ ...fixture(), nodes: new Array(100_000) });
});

test('untrusted object shapes and getters cannot execute during validation', () => {
  const poisoned = JSON.parse(JSON.stringify(fixture()).replace('"version":1', '"version":1,"__proto__":{}'));
  invalid(poisoned);
  invalid(Object.assign(Object.create({ hidden: true }) as object, fixture()));
  const getter = fixture();
  Object.defineProperty(getter, 'version', { enumerable: true, get: () => { throw new Error('must not execute'); } });
  invalid(getter);
  const { proxy, revoke } = Proxy.revocable(fixture(), {});
  revoke();
  invalid(proxy);
});

test('JSON Schema expresses the same local bounds and strict required fields', () => {
  const schema = WHITEBOARD_DIAGRAM_DRAFT_SCHEMA_V1;
  assert.equal(schema.type, 'object');
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual([...schema.required].sort(), ['edges', 'nodes', 'outcome', 'version', 'warnings']);
  assert.equal(schema.properties.nodes.maxItems, WHITEBOARD_DIAGRAM_DRAFT_LIMITS.maxNodes);
  assert.equal(schema.properties.edges.maxItems, WHITEBOARD_DIAGRAM_DRAFT_LIMITS.maxEdges);
  assert.equal(schema.properties.warnings.maxItems, WHITEBOARD_DIAGRAM_DRAFT_LIMITS.maxWarnings);
  for (const field of ['nodes', 'edges', 'warnings'] as const) {
    const item = schema.properties[field].items;
    assert.equal(item.additionalProperties, false);
    assert.deepEqual([...item.required].sort(), Object.keys(item.properties).sort());
  }
});

test('adding the strict AI contract does not tighten or replace the legacy diagram format', () => {
  assert.ok(isDiagramData({ nodes: [{ id: 'legacy', type: 'FutureNode', data: { label: 'old' } }], edges: [] }));
  assert.ok(isDiagramData({ activePageId: 'p', pages: [{ id: 'p', name: 'Page 1', nodes: [], edges: [] }] }));
  assert.equal(isDiagramData(fixture('unrecognized')), true,
    'legacy structural guard is intentionally permissive; AI endpoints must use the dedicated validator');
});
