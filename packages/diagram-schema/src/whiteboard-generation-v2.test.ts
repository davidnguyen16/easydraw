import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  WHITEBOARD_DIAGRAM_DRAFT_SCHEMA_V2, isWhiteboardDiagramDraft, isWhiteboardDiagramDraftV2,
  validateWhiteboardDiagramDraft, validateWhiteboardDiagramDraftV2,
  type WhiteboardDiagramDraftV2, type DraftCropV2, type DraftEdgeV2,
} from './index.js';

function fixture(): WhiteboardDiagramDraftV2 {
  const value: unknown = JSON.parse(readFileSync(new URL('../fixtures/whiteboard-generation-parabola.json', import.meta.url), 'utf8'));
  assert.ok(isWhiteboardDiagramDraftV2(value), 'parabola fixture follows the public V2 contract');
  return value;
}
const crop = (): DraftCropV2 => ({ id: 'source-detail', label: '', bounds: { x: 5, y: 5, width: 100, height: 100 }, reason: 'Preserve a source detail.' });
const edge = (sourceId: string, targetId: string): DraftEdgeV2 => ({
  id: 'connector', sourceId, targetId, label: '', direction: 'forward',
  style: { stroke: '#123456', strokeWidth: 2, dash: 'solid', routing: 'curved' },
});
function invalid(input: unknown) {
  const result = validateWhiteboardDiagramDraftV2(input);
  assert.equal(result.valid, false);
  assert.equal(isWhiteboardDiagramDraftV2(input), false);
  assert.ok(result.issues.length > 0 && result.issues.length <= 32);
}

test('parabola fixture has correct local quadratic controls and standalone axis arrows', () => {
  const draft = fixture();
  const curve = draft.paths.find((path) => path.id === 'parabola')!;
  assert.deepEqual(curve.geometry.commands, [{ op: 'M', values: [0, 1000] }, { op: 'Q', values: [500, 0, 1000, 1000] }]);
  const start = curve.geometry.commands[0]!.values;
  const control = curve.geometry.commands[1]!.values;
  const apexX = curve.bounds.x + (0.25 * start[0]! + 0.5 * control[0]! + 0.25 * control[2]!) * curve.bounds.width / 1000;
  const apexY = curve.bounds.y + (0.25 * start[1]! + 0.5 * control[1]! + 0.25 * control[3]!) * curve.bounds.height / 1000;
  assert.deepEqual([apexX, apexY], [500, 450]);
  const guide = draft.paths.find((path) => path.id === 'height-guide')!;
  assert.equal(guide.bounds.y, apexY);
  assert.equal(guide.geometry.dash, 'dashed');
  assert.equal(draft.edges.length, 0);
  assert.ok(draft.paths.filter((path) => path.id.endsWith('-axis')).every((path) => path.geometry.endArrow));
  assert.ok(draft.nodes.every((node) => node.shape === 'text'));
});

test('V1 public fixtures and validator semantics stay separate and unchanged', () => {
  for (const name of ['flowchart', 'warnings', 'unrecognized']) {
    const value: unknown = JSON.parse(readFileSync(new URL(`../fixtures/whiteboard-generation-${name}.json`, import.meta.url), 'utf8'));
    assert.ok(isWhiteboardDiagramDraft(value));
    assert.deepEqual(validateWhiteboardDiagramDraft(value), { valid: true, issues: [] });
    assert.equal(isWhiteboardDiagramDraftV2(value), false);
  }
  assert.equal(isWhiteboardDiagramDraft(fixture()), false);
});

test('paths-only, crops-only and mixed diagrams permit references to visible elements', () => {
  const paths = { ...fixture(), nodes: [] };
  assert.ok(isWhiteboardDiagramDraftV2(paths));
  const crops = { ...fixture(), nodes: [], paths: [], crops: [crop()] };
  assert.ok(isWhiteboardDiagramDraftV2(crops));
  const mixed = fixture(); mixed.crops.push(crop());
  mixed.edges.push(edge(mixed.nodes[0]!.id, mixed.paths[0]!.id));
  mixed.edges.push({ ...edge(mixed.paths[0]!.id, mixed.crops[0]!.id), id: 'crop-connector' });
  mixed.warnings = [mixed.nodes[0]!.id, mixed.paths[0]!.id, mixed.crops[0]!.id, mixed.edges[0]!.id, null]
    .map((elementId) => ({ code: 'ambiguous-shape', message: 'Check this detail.', elementId }));
  assert.ok(isWhiteboardDiagramDraftV2(mixed));
});

test('IDs are global and dangling references never pass', () => {
  for (const reference of ['missing', 'connector']) {
    const draft = fixture(); draft.edges = [edge(draft.paths[0]!.id, reference)]; invalid(draft);
  }
  const warning = fixture(); warning.warnings = [{ code: 'ambiguous-shape', message: 'Check.', elementId: 'missing' }]; invalid(warning);
  const repeated = fixture(); repeated.paths[0]!.id = repeated.nodes[0]!.id; invalid(repeated);
  const cropDuplicate = fixture(); cropDuplicate.crops = [{ ...crop(), id: cropDuplicate.paths[0]!.id }]; invalid(cropDuplicate);
  const edgeDuplicate = fixture(); edgeDuplicate.edges = [{ ...edge(edgeDuplicate.nodes[0]!.id, edgeDuplicate.paths[0]!.id), id: edgeDuplicate.paths[0]!.id }]; invalid(edgeDuplicate);
});

test('closed objects prevent crop image bytes, raw markup commands and unsafe style injection', () => {
  invalid({ ...fixture(), dataUrl: 'data:image/png;base64,AA==' });
  invalid({ ...fixture(), crops: [{ ...crop(), dataUrl: 'data:image/png;base64,AA==' }] });
  invalid({ ...fixture(), crops: [{ ...crop(), url: 'https://evil.test/' }] });
  for (const target of ['node', 'edge', 'path']) {
    const draft = fixture(); draft.edges = [edge(draft.nodes[0]!.id, draft.paths[0]!.id)];
    if (target === 'node') draft.nodes[0]!.style.stroke = 'url(https://evil.test/a)';
    if (target === 'edge') draft.edges[0]!.style.stroke = 'var(--evil)';
    if (target === 'path') Object.assign(draft.paths[0]!.geometry, { svg: '<script>run()</script>' });
    invalid(draft);
  }
  const text = fixture(); text.nodes[0]!.label = '<script>alert(1)</script>';
  assert.ok(isWhiteboardDiagramDraftV2(text), 'labels are plain text, and consumers must not interpret markup');
});

test('styles and source-image bounds reject nonfinite and out-of-range numbers', () => {
  for (const value of [NaN, Infinity, -Infinity, -1, 1001, 0.5]) {
    const draft = fixture(); draft.paths[0]!.bounds.x = value; invalid(draft);
  }
  const outside = fixture(); outside.paths[0]!.bounds = { x: 999, y: 0, width: 2, height: 1 }; invalid(outside);
  for (const patch of [{ strokeWidth: -1 }, { strokeWidth: 13 }, { strokeWidth: NaN }, { fontSize: 7 }, { fontSize: 73 },
    { textColor: 'none' }, { fill: '#fff' }, { stroke: 'none' }, { onClick: 'run()' }]) {
    const draft = fixture(); Object.assign(draft.nodes[0]!.style, patch); invalid(draft);
  }
  for (const patch of [{ routing: 'random' }, { dash: 'random' }, { strokeWidth: Infinity }]) {
    const draft = fixture(); draft.edges = [edge(draft.nodes[0]!.id, draft.paths[0]!.id)]; Object.assign(draft.edges[0]!.style, patch); invalid(draft);
  }
});

test('V2 cardinalities and aggregate command budget are inclusive', () => {
  const draft = fixture();
  draft.nodes = Array.from({ length: 50 }, (_, index) => ({ ...draft.nodes[0]!, id: `node-${index}` }));
  draft.paths = Array.from({ length: 64 }, (_, index) => ({ ...draft.paths[0]!, id: `path-${index}` }));
  draft.crops = Array.from({ length: 4 }, (_, index) => ({ ...crop(), id: `crop-${index}` }));
  draft.edges = Array.from({ length: 100 }, (_, index) => ({ ...edge('node-0', 'path-0'), id: `edge-${index}` }));
  draft.warnings = Array.from({ length: 30 }, () => ({ code: 'ambiguous-shape', message: 'Check.', elementId: null }));
  assert.ok(isWhiteboardDiagramDraftV2(draft));
  for (const key of ['nodes', 'paths', 'crops', 'edges', 'warnings'] as const) {
    invalid({ ...draft, [key]: [...draft[key], { ...draft[key][0], id: 'overflow' }] });
    invalid({ ...draft, [key]: new Array(100_000) });
    invalid({ ...draft, [key]: new Array(2) });
  }
  const budget = fixture();
  budget.paths = Array.from({ length: 8 }, (_, index) => ({
    ...budget.paths[0]!, id: `path-${index}`, geometry: {
      ...budget.paths[0]!.geometry,
      commands: [{ op: 'M', values: [0, 0] }, ...Array.from({ length: 63 }, () => ({ op: 'L' as const, values: [1000, 1000] }))],
    },
  }));
  assert.ok(isWhiteboardDiagramDraftV2(budget));
  budget.paths.push({ ...fixture().paths[0]!, id: 'too-many-commands' }); invalid(budget);
});

test('unrecognized outcomes require empty element arrays and an explanatory warning', () => {
  const value = { version: 2, outcome: 'unrecognized', nodes: [], edges: [], paths: [], crops: [],
    warnings: [{ code: 'unsupported-content', message: 'No drawing could be recognized.', elementId: null }] };
  assert.ok(isWhiteboardDiagramDraftV2(value));
  invalid({ ...value, warnings: [] });
  invalid({ ...value, paths: fixture().paths });
  invalid({ ...value, crops: [crop()] });
  invalid({ ...value, nodes: fixture().nodes });
  invalid({ ...value, outcome: 'diagram' });
});

test('V2 validation is immutable and handles malicious object descriptors', () => {
  const draft = fixture(); const before = JSON.stringify(draft);
  const freeze = (value: unknown): void => {
    if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  };
  freeze(draft);
  assert.deepEqual(validateWhiteboardDiagramDraftV2(draft), { valid: true, issues: [] });
  assert.equal(JSON.stringify(draft), before);
  let reads = 0;
  const getter = fixture();
  Object.defineProperty(getter.paths[0]!.geometry, 'commands', { enumerable: true, get() { reads += 1; throw new Error('accessor'); } });
  invalid(getter); assert.equal(reads, 0);
  invalid(Object.assign(Object.create({ inherited: true }) as object, fixture()));
  invalid(JSON.parse(JSON.stringify(fixture()).replace('"version":2', '"version":2,"__proto__":{}')));
  const revoked = Proxy.revocable(fixture(), {}); revoked.revoke(); invalid(revoked.proxy);
});

test('strict provider schema has no optional or open object properties', () => {
  function inspect(value: unknown): void {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach(inspect); return; }
    const schema = value as Record<string, unknown>;
    if (schema.type === 'object') {
      assert.equal(schema.additionalProperties, false);
      assert.deepEqual([...(schema.required as string[])].sort(), Object.keys(schema.properties as object).sort());
    }
    Object.values(schema).forEach(inspect);
  }
  inspect(WHITEBOARD_DIAGRAM_DRAFT_SCHEMA_V2);
  assert.equal(WHITEBOARD_DIAGRAM_DRAFT_SCHEMA_V2.properties.version.const, 2);
  assert.equal(WHITEBOARD_DIAGRAM_DRAFT_SCHEMA_V2.properties.paths.maxItems, 64);
  assert.equal(WHITEBOARD_DIAGRAM_DRAFT_SCHEMA_V2.properties.crops.maxItems, 4);
});
