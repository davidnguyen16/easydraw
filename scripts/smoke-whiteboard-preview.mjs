/**
 * STEP 3 whiteboard -> diagram preview regression (real UI, mocked API).
 * Run ONLY against an already running local frontend; this script starts no
 * server and uses one isolated headless browser. No credentials are required.
 *
 * BASE_URL                 default http://localhost:5173
 * PLAYWRIGHT_MODULE_PATH   existing playwright-core / playwright directory
 * BROWSER_EXECUTABLE_PATH  optional installed Chromium/Edge executable
 * SMOKE_OUTPUT_DIR         defaults to a new OS temporary directory
 *
 * All auth, document and preview requests are intercepted in memory. Preview
 * POST/GET/DELETE calls never leave the browser; fixture controls live here,
 * not in the product UI. Only synthetic whiteboard autosaves are accepted.
 * Real diagram creation, OpenAI, S3 and every unrecognized write are blocked.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright-core');
const baseUrl = new URL(process.env.BASE_URL || 'http://localhost:5173');
assert(['localhost', '127.0.0.1', '[::1]'].includes(baseUrl.hostname), 'Use a LOCAL frontend, never production.');
const output = process.env.SMOKE_OUTPUT_DIR ? path.resolve(process.env.SMOKE_OUTPUT_DIR)
  : await mkdtemp(path.join(tmpdir(), 'easydraw-whiteboard-preview-'));
await mkdir(output, { recursive: true });
const flowchart = JSON.parse(await readFile(new URL('../packages/diagram-schema/fixtures/whiteboard-generation-flowchart.json', import.meta.url), 'utf8'));
const warnings = JSON.parse(await readFile(new URL('../packages/diagram-schema/fixtures/whiteboard-generation-warnings.json', import.meta.url), 'utf8'));
const unrecognized = JSON.parse(await readFile(new URL('../packages/diagram-schema/fixtures/whiteboard-generation-unrecognized.json', import.meta.url), 'utf8'));
const parabola = require('@easydraw/diagram-schema/fixtures/parabola.json');

// Synthetic API graph, not a production converter or a UI-side AI adapter.
// The server converter is covered separately by backend unit tests.
const NODE_TYPES = { rectangle: 'RectangleNode', 'rounded-rectangle': 'RoundedRectangleNode',
  ellipse: 'EllipseNode', diamond: 'DiamondNode', database: 'DatabaseNode', text: 'TextNode' };
function fixtureDocument(draft) {
  if (draft.outcome === 'unrecognized') return null;
  const v2 = draft.version === 2;
  assert(!draft.crops?.length, 'This plain fixture adapter does not manufacture source crops');
  return { schemaVersion: 1, activePageId: 'preview-page', pages: [{ id: 'preview-page', name: 'Preview',
    nodes: [...draft.nodes.map((node) => ({ id: node.id, type: NODE_TYPES[node.shape],
      position: { x: node.bounds.x, y: node.bounds.y }, width: v2 ? node.bounds.width : Math.max(40, node.bounds.width),
      height: v2 ? node.bounds.height : Math.max(24, node.bounds.height),
      data: { label: node.label, ...(v2 ? { preserveBounds: true } : {}), fontSize: node.style?.fontSize ?? 14, fillColor: node.style?.fill ?? '#ffffff',
        borderColor: node.style?.stroke ?? '#526375', borderWidth: node.style?.strokeWidth ?? 1.5,
        textColor: node.style?.textColor ?? '#253349' } })),
      ...(v2 ? draft.paths.map((item) => ({ id: item.id, type: 'VectorPathNode',
        position: { x: item.bounds.x, y: item.bounds.y }, width: item.bounds.width, height: item.bounds.height,
        data: { label: item.label, vector: structuredClone(item.geometry) } })) : []),
    ],
    edges: draft.edges.map((edge) => ({ id: edge.id, type: 'connection', source: edge.sourceId, target: edge.targetId,
      sourceHandle: 'bottom', targetHandle: 'top', data: { markerStart: edge.direction === 'both' ? 'triangle' : 'none',
        markerEnd: edge.direction === 'none' ? 'none' : 'triangle',
        labels: edge.label ? [{ id: `${edge.id}-label`, text: edge.label, t: 0.5 }] : [] } })),
  }] };
}
let vectorCrop = '';
function vectorFixtureDocument() {
  const vector = (id, x, y, width, height, commands, extra = {}) => ({ id, type: 'VectorPathNode',
    position: { x, y }, width, height, data: { label: `Semantic ${id}`, vector: { version: 1, commands,
      stroke: '#315a85', fill: 'none', strokeWidth: 2, dash: 'solid', startArrow: false, endArrow: false, ...extra } } });
  return { schemaVersion: 1, activePageId: 'vector-page', pages: [{ id: 'vector-page', name: 'Vector review', nodes: [
    vector('triangle-art', 30, 30, 140, 100, [{ op: 'M', values: [500, 0] }, { op: 'L', values: [1000, 1000] },
      { op: 'L', values: [0, 1000] }, { op: 'Z', values: [] }], { fill: '#f8c970' }),
    vector('curved-art', 220, 30, 160, 100, [{ op: 'M', values: [0, 900] },
      { op: 'C', values: [100, 0, 900, 0, 1000, 900] }], { dash: 'dashed', endArrow: true }),
    vector('thin-arrow-art', 30, 230, 180, 1, [{ op: 'M', values: [0, 500] }, { op: 'L', values: [1000, 500] }],
      { startArrow: true, endArrow: true }),
    { id: 'source-detail', type: 'SourceImageNode', position: { x: 220, y: 200 }, width: 160, height: 100,
      data: { label: 'Original sketch detail', image: { version: 1, dataUrl: vectorCrop, width: 80, height: 50, reason: 'Preserved unrecognized detail.' } } },
    { id: 'caption', type: 'TextNode', position: { x: 30, y: 140 }, width: 140, height: 40,
      data: { label: 'Editable caption', textColor: '#315a85', fontSize: 14 } },
  ], edges: [
    { id: 'straight-route', source: 'triangle-art', target: 'curved-art', sourceHandle: 'right', targetHandle: 'left',
      data: { routing: 'straight', lineStyle: 'dotted', strokeColor: '#bc3850', markerEnd: 'triangle' } },
    { id: 'curved-route', source: 'curved-art', target: 'source-detail', sourceHandle: 'bottom', targetHandle: 'top',
      data: { routing: 'curved', lineStyle: 'dashed', strokeColor: '#315a85' } },
  ] }] };
}
const firstId = 'preview-whiteboard-a';
const secondId = 'preview-whiteboard-b';
const documentOf = (id, title, width, height) => ({
  id, title, type: 'whiteboard', status: 'draft', updatedAt: '2026-01-01T00:00:00.000Z',
  data: { version: 1, pack: 'whiteboard', width, height, image: null },
});
const state = {
  documents: new Map([
    [firstId, documentOf(firstId, 'Preview smoke A', 800, 600)],
    [secondId, documentOf(secondId, 'Preview smoke B', 640, 480)],
  ]),
  patches: [], thumbnails: [], forbidden: [], routeErrors: [],
  nextSample: 'flowchart', previews: new Map(), previewRequests: [], previewLookups: [], previewCancels: [],
  expectedLostResponses: 0, observedLostResponses: 0,
};
const errors = [];
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BROWSER_EXECUTABLE_PATH ? { executablePath: process.env.BROWSER_EXECUTABLE_PATH } : { channel: 'msedge' }),
  args: ['--renderer-process-limit=1', '--disable-background-networking', '--enable-webgl', '--enable-unsafe-swiftshader'],
});
const watchdog = setTimeout(() => {
  console.error('FAIL: Whiteboard preview smoke exceeded its 180-second watchdog.');
  process.exitCode = 1;
  void browser.close();
}, 180_000);
const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, serviceWorkers: 'block' });
const diagramSidebarPreference = JSON.stringify({ width: 287, isCollapsed: true });
await context.addInitScript(({ origin, value }) => {
  if (location.origin === origin && localStorage.getItem('easydraw.sidebar.v1') === null) {
    localStorage.setItem('easydraw.sidebar.v1', value);
  }
}, { origin: baseUrl.origin, value: diagramSidebarPreference });
const page = await context.newPage();
page.setDefaultTimeout(20_000);
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
  if (message.type() !== 'error') return;
  // Exactly the deliberately dropped synthetic POST response may report a
  // resource error. Everything else still fails the smoke test.
  if (state.observedLostResponses < state.expectedLostResponses &&
    /\/diagrams\/[^/]+\/previews$/.test(message.location().url ?? '') &&
    /^Failed to load resource: net::ERR_FAILED$/.test(message.text())) {
    state.observedLostResponses++;
  } else errors.push(message.text());
});
page.on('dialog', (dialog) => dialog.accept());

await context.route('**/*', async (route) => {
  const request = route.request();
  const url = new URL(request.url());
  const method = request.method();
  const headers = {
    'access-control-allow-origin': baseUrl.origin, 'access-control-allow-credentials': 'true',
    'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS', 'access-control-allow-headers': 'content-type',
  };
  const reply = (json, status = 200) => route.fulfill({ status, headers, ...(status === 204 ? {} : { json }) });
  const apiPath = !/^\/(?:dashboard|editor|_next)(?:\/|$)/.test(url.pathname)
    && /\/(?:auth|diagrams|diagram-previews|node-library|ai|generation)(?:\/|$)/.test(url.pathname);
  try {
    if (method === 'OPTIONS' && apiPath) return reply(undefined, 204);
    if (url.pathname.endsWith('/auth/me') && method === 'GET') {
      return reply({ id: 'preview-smoke-owner', email: 'preview@example.invalid', name: 'Synthetic Owner' });
    }
    if (apiPath && url.pathname.endsWith('/diagrams') && method === 'GET') {
      return reply([...state.documents.values()].map(({ data, ...document }) => document));
    }
    const previewRequest = apiPath && url.pathname.match(/\/diagrams\/([^/]+)\/previews\/requests\/([^/]+)$/);
    if (previewRequest && state.documents.has(previewRequest[1])) {
      const id = previewRequest[2];
      if (method === 'DELETE') {
        state.previewCancels.push(id);
        const prior = state.previews.get(id);
        state.previews.set(id, prior ? { ...prior, status: 'cancelled', document: null, documentHash: null } : {
          id: `preview-${id}`, clientRequestId: id, clientRevision: null, status: 'cancelled',
          source: { width: 0, height: 0 }, model: 'gpt-6-sol', document: null, documentHash: null,
          warnings: [], errorCode: null, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        });
        return reply(undefined, 204);
      }
      if (method === 'GET') {
        state.previewLookups.push(id);
        return state.previews.has(id) ? reply(state.previews.get(id)) : reply({ message: 'Not found' }, 404);
      }
    }
    const createPreview = apiPath && url.pathname.match(/\/diagrams\/([^/]+)\/previews$/);
    if (createPreview && state.documents.has(createPreview[1]) && method === 'POST') {
      const payload = request.postDataJSON();
      assert.deepEqual(Object.keys(payload).sort(), ['clientRequestId', 'clientRevision', 'height', 'hint', 'image', 'width'].sort());
      assert.match(payload.clientRequestId, /^[\da-f-]{36}$/i);
      assert.equal(typeof payload.hint, 'string'); assert(payload.hint.length <= 4000);
      assert(Number.isInteger(payload.clientRevision));
      assert.match(payload.image, /^data:image\/png;base64,/);
      assert.equal(payload.width, state.documents.get(createPreview[1]).data.width);
      assert.equal(payload.height, state.documents.get(createPreview[1]).data.height);
      assert(!state.previewRequests.some((item) => item.clientRequestId === payload.clientRequestId), 'A request was re-submitted to AI instead of recovered by GET');
      state.previewRequests.push(structuredClone(payload));
      const sample = state.nextSample;
      const draft = sample === 'warnings' ? warnings : sample === 'unrecognized' ? unrecognized : sample === 'parabola' ? parabola : flowchart;
      const now = Date.now();
      const result = { id: `preview-${payload.clientRequestId}`, clientRequestId: payload.clientRequestId,
        clientRevision: payload.clientRevision, source: { width: payload.width, height: payload.height },
        model: 'gpt-6-sol', createdAt: new Date(now).toISOString(),
        expiresAt: new Date(sample === 'expired' ? now - 1 : now + 86_400_000).toISOString(),
        status: sample === 'error' ? 'failed' : draft.outcome === 'unrecognized' ? 'unrecognized' : 'ready',
        document: sample === 'error' ? null : sample === 'vectors' ? vectorFixtureDocument() : fixtureDocument(draft),
        documentHash: sample === 'error' || draft.outcome === 'unrecognized' ? null : 'a'.repeat(64),
        warnings: draft.warnings, errorCode: sample === 'error' ? 'provider_refused' : null,
      };
      const tombstone = state.previews.get(payload.clientRequestId)?.status === 'cancelled';
      if (!tombstone) state.previews.set(payload.clientRequestId, { ...result, status: 'processing', document: null, documentHash: null });
      await new Promise((resolve) => setTimeout(resolve, 650));
      if (state.previews.get(payload.clientRequestId)?.status !== 'cancelled') state.previews.set(payload.clientRequestId, result);
      if (sample === 'connection-loss') {
        state.expectedLostResponses++;
        return route.abort('failed');
      }
      // Deliberately deliver the old completed result even after cancellation;
      // the client's abort/request-ID guard must prevent a late publication.
      return reply(result);
    }
    const match = apiPath && url.pathname.match(/\/diagrams\/([^/]+)(\/thumbnail)?$/);
    const document = match && state.documents.get(match[1]);
    if (document && method === 'GET' && !match[2]) return reply(document);
    if (document && method === 'PATCH') {
      const payload = request.postDataJSON();
      if (match[2]) {
        assert.deepEqual(Object.keys(payload), ['image']);
        assert.match(payload.image, /^data:image\/(?:png|webp|jpeg);base64,/);
        state.thumbnails.push({ id: document.id, payload });
        return reply({ id: document.id });
      }
      assert(Object.keys(payload).every((key) => ['title', 'data'].includes(key)), 'Preview data leaked into autosave');
      if (payload.data) {
        assert.equal(payload.data.pack, 'whiteboard', 'A preview replaced the stored raster document');
        assert.equal(payload.data.version, 1);
        assert.equal(payload.data.width, document.data.width);
        assert.equal(payload.data.height, document.data.height);
        assert(Object.keys(payload.data).every((key) => ['version', 'pack', 'width', 'height', 'image'].includes(key)),
          'Transient preview content must not be persisted in the whiteboard');
        assert.match(payload.data.image, /^data:image\/png;base64,/);
      }
      state.patches.push({ id: document.id, payload: structuredClone(payload) });
      state.documents.set(document.id, { ...document, ...structuredClone(payload) });
      return reply(state.documents.get(document.id));
    }
    if (url.pathname.endsWith('/node-library/sections') && method === 'GET') return reply({ sections: [] });
    // Exact development-only diagnostic, not an application/backend write.
    if (url.origin === baseUrl.origin && method === 'POST' && url.pathname === '/__nextjs_original-stack-frames') return route.continue();
    if (url.origin === baseUrl.origin && ['GET', 'HEAD'].includes(method) && !apiPath) return route.continue();
    state.forbidden.push(`${method} ${url.origin}${url.pathname}`);
    return route.abort('blockedbyclient');
  } catch (error) {
    state.routeErrors.push(error.message);
    return reply({ message: 'Synthetic request violated the smoke-test contract' }, 422);
  }
});
if (context.routeWebSocket) {
  await context.routeWebSocket('**/*', (socket) => {
    const url = new URL(socket.url());
    if (url.host === baseUrl.host) socket.connectToServer();
    else { state.forbidden.push(`WEBSOCKET ${url.origin}${url.pathname}`); socket.close(); }
  });
}

const panel = () => page.getByRole('complementary', { name: 'Diagram preview', exact: true });
const board = () => page.getByLabel('Whiteboard canvas', { exact: true });
const undo = () => page.getByRole('button', { name: 'Undo (Ctrl+Z)', exact: true });
const redo = () => page.getByRole('button', { name: 'Redo (Ctrl+Y)', exact: true });
const commit = () => panel().getByRole('button', { name: 'Create diagram', exact: true });
const status = () => panel().getAttribute('data-preview-status');
const previewId = () => panel().getAttribute('data-preview-id');
const dimension = (mode) => panel().getByRole('group', { name: 'Preview dimension', exact: true })
  .getByRole('button', { name: `${mode} preview`, exact: true });
const colorsToggle = () => page.getByRole('button', { name: 'Colors', exact: true });
const colorsPanel = () => page.locator('#whiteboard-colors-panel');
const resizeHandle = (side) => page.getByRole('separator', { name: side === 'tools' ? 'Resize tools sidebar' : 'Resize AI preview', exact: true });
const toolsPanel = () => page.locator('#whiteboard-tools-panel');
const collapsePanel = (side) => page.getByRole('button', { name: side === 'tools' ? 'Collapse tools sidebar' : 'Collapse AI preview', exact: true });
const expandPanel = (side) => page.getByRole('button', { name: side === 'tools' ? 'Expand tools sidebar' : 'Expand AI preview', exact: true });
const panelWidth = async (side) => Number(await resizeHandle(side).getAttribute('aria-valuenow'));
const readLayoutPreferences = () => page.evaluate(() => ({
  whiteboard: localStorage.getItem('easydraw.whiteboard-layout.v1'),
  diagram: localStorage.getItem('easydraw.sidebar.v1'),
}));
function writesAndPreviewCalls() {
  return { patches: state.patches.length, thumbnails: state.thumbnails.length, creates: state.previewRequests.length,
    lookups: state.previewLookups.length, cancels: state.previewCancels.length, designs: state.documents.size };
}
async function dragPanelWidth(side, target) {
  const divider = resizeHandle(side);
  const before = await panelWidth(side);
  const box = await divider.boundingBox();
  assert(box, `Missing ${side} resize separator`);
  const x = box.x + box.width / 2, y = box.y + Math.min(box.height / 2, 110);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + (target - before) * (side === 'tools' ? 1 : -1), y, { steps: 6 });
  await page.mouse.up();
  await page.mouse.move(1, 1);
  await until(async () => Math.abs(await panelWidth(side) - target) <= 1, `${side} pointer resize did not reach ${target}px`);
}
async function assertCanvasMinimum(minimum = 320) {
  const available = await board().boundingBox();
  assert(available && available.width >= minimum - 1, `Panel resizing squeezed the canvas below ${minimum}px`);
}
async function assertLayoutPreferencesIsolated() {
  const preferences = await readLayoutPreferences();
  assert.equal(preferences.diagram, diagramSidebarPreference, 'Whiteboard panels changed Diagram sidebar preferences');
  assert(preferences.whiteboard && typeof JSON.parse(preferences.whiteboard) === 'object', 'Whiteboard panel preferences were not persisted separately');
  return preferences.whiteboard;
}
async function until(predicate, message, timeout = 20_000) {
  const deadline = Date.now() + timeout;
  let last;
  while (Date.now() < deadline) {
    try { if (await predicate()) return; } catch (error) { last = error; }
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
  throw new Error(`${message}${last ? `: ${last.message}` : ''}`);
}
async function waitStatus(expected) {
  await until(async () => await status() === expected, `Preview did not enter ${expected}`);
  assert(await commit().isDisabled(), `STEP 3 must not enable Create diagram before exact commit integration (${expected})`);
}
async function start(sample = 'flowchart') {
  state.nextSample = sample;
  const count = state.previewRequests.length;
  await setIdeaExpanded(true);
  await panel().getByRole('button', { name: /^(?:Generate preview|Generate from drawing)$/, exact: true }).click();
  await waitStatus('loading');
  await until(() => state.previewRequests.length === count + 1, 'Preview image was not sent to the synthetic API');
}
async function setIdeaExpanded(expanded) {
  const composer = panel().locator('details').filter({ has: page.getByText('Idea & new preview', { exact: true }) });
  if (await composer.count() && (await composer.getAttribute('open') !== null) !== expanded) await composer.locator(':scope > summary').click();
}
async function generate(sample = 'flowchart', expected = 'ready') {
  await start(sample);
  await waitStatus(expected);
}
async function boardUI() {
  return {
    tool: await page.getByRole('complementary', { name: 'Tools', exact: true }).getByRole('radio', { checked: true }).allTextContents(),
    undoDisabled: await undo().isDisabled(), redoDisabled: await redo().isDisabled(),
    zoom: await page.getByLabel('Zoom level', { exact: true }).inputValue(),
    pixels: await board().evaluate((canvas) => canvas.toDataURL('image/png')),
  };
}
async function colorOptionsUI() {
  return {
    line: await colorsPanel().getByRole('button', { name: 'Line colour', exact: true }).evaluate((element) => getComputedStyle(element).backgroundColor),
    fill: await colorsPanel().getByRole('button', { name: 'Fill colour', exact: true }).evaluate((element) => getComputedStyle(element).backgroundColor),
    fillTarget: await colorsPanel().getByRole('button', { name: 'Fill colour', exact: true }).getAttribute('aria-pressed'),
    width: await page.getByLabel('Line width ([ / ])', { exact: true }).inputValue(),
  };
}
async function graphArtworkSnapshot() {
  return panel().getByTestId('diagram-preview-canvas').evaluate((element) => ({
    nodes: [...element.querySelectorAll('.react-flow__node')].map((node) => ({
      id: node.dataset.id, type: [...node.classList].find((name) => name.startsWith('react-flow__node-')),
      position: node.style.transform, width: node.style.width, height: node.style.height,
      labels: [...node.querySelectorAll('textarea')].map((input) => input.value),
      vectors: [...node.querySelectorAll('[data-vector-path]')].map((shape) => ({
        path: shape.getAttribute('d'), stroke: shape.getAttribute('stroke'), fill: shape.getAttribute('fill'),
        dash: shape.getAttribute('stroke-dasharray'), startArrow: Boolean(shape.getAttribute('marker-start')),
        endArrow: Boolean(shape.getAttribute('marker-end')),
      })),
      images: [...node.querySelectorAll('img')].map((image) => image.getAttribute('src')),
    })),
    edges: [...element.querySelectorAll('.react-flow__edge')].map((edge) => ({ id: edge.dataset.id,
      path: edge.querySelector('.react-flow__edge-path')?.getAttribute('d'),
      dash: edge.querySelector('.react-flow__edge-path')?.style.strokeDasharray,
    })),
  }));
}
async function assertArtworkUnchanged(expected, message) {
  const before = JSON.parse(expected);
  const equivalent = (after) => {
    if (JSON.stringify(before.nodes) !== JSON.stringify(after.nodes) || before.edges.length !== after.edges.length) return false;
    return before.edges.every((edge, index) => {
      const next = after.edges[index];
      // React Flow measures handle DOM boxes through the viewport transform.
      // Hiding/restoring that viewport introduces observed ~0.0001-unit edge
      // coordinate drift. Compare only derived edge numbers within 0.001;
      // commands, IDs, styles, node geometry, text and source data stay exact.
      const numbers = /-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/gi;
      const oldPath = edge.path ?? '', newPath = next.path ?? '';
      if (oldPath.replace(numbers, '#') !== newPath.replace(numbers, '#')) return false;
      const a = oldPath.match(numbers) ?? [], b = newPath.match(numbers) ?? [];
      if (a.length !== b.length || a.some((value, at) => Math.abs(Number(value) - Number(b[at])) > 0.001)) return false;
      return JSON.stringify(edge) === JSON.stringify({ ...next, path: edge.path });
    });
  };
  await until(async () => equivalent(await graphArtworkSnapshot()), message, 3000).catch(async (error) => {
    const after = await graphArtworkSnapshot();
    const changes = Object.fromEntries(['nodes', 'edges'].map((kind) => [kind, after[kind].flatMap((item) => {
      const prior = before[kind].find((entry) => entry.id === item.id);
      const fields = Object.fromEntries(Object.keys(item).filter((key) => JSON.stringify(prior?.[key]) !== JSON.stringify(item[key]))
        .map((key) => [key, key === 'images' ? { beforeLengths: prior?.images?.map((image) => image.length), afterLengths: item.images.map((image) => image.length) }
          : { before: prior?.[key], after: item[key] }]));
      return Object.keys(fields).length ? [{ id: item.id, fields }] : [];
    })]));
    throw new Error(`${error.message}: ${JSON.stringify(changes)}`);
  });
}
async function waitForPreview3D(expectedGraph) {
  const scene = panel().getByLabel('3D diagram', { exact: true });
  await scene.waitFor({ state: 'visible' });
  await scene.locator('canvas').waitFor({ state: 'visible', timeout: 60_000 });
  await until(async () => scene.locator('canvas').evaluate((canvas) => canvas.width > 0 && canvas.height > 0
    && !!canvas.dataset.cameraPosition && !!canvas.dataset.cameraTarget), '3D preview camera did not initialize');
  assert.equal(await scene.getAttribute('data-node-count'), String(expectedGraph.nodes.length));
  assert.equal(await scene.getAttribute('data-edge-count'), String(expectedGraph.edges.length));
  await until(async () => await scene.locator('[data-scene-node]').count() === expectedGraph.nodes.length,
    '3D preview did not render the same number of objects');
  for (const node of expectedGraph.nodes) {
    const diagnostic = scene.locator(`[data-scene-node="${node.id}"]`);
    assert.equal(await diagnostic.getAttribute('data-node-type'), node.type, `3D preview changed type for ${node.id}`);
    assert.equal(await diagnostic.getAttribute('data-node-label'), node.data.label, `3D preview changed label for ${node.id}`);
  }
  const imageStates = scene.locator('[data-custom-image-state]');
  await until(async () => imageStates.evaluateAll((elements) => elements.every((element) => element.dataset.customImageState === 'ready')),
    '3D preview source images did not decode');
  return scene;
}
async function previewCamera(scene) {
  const canvas = scene.locator('canvas');
  return { position: JSON.parse(await canvas.getAttribute('data-camera-position')),
    target: JSON.parse(await canvas.getAttribute('data-camera-target')) };
}
async function previewPixels(scene) {
  return scene.locator('canvas').evaluate((source) => {
    const copy = document.createElement('canvas'); copy.width = source.width; copy.height = source.height;
    const context = copy.getContext('2d'); context.drawImage(source, 0, 0);
    const pixels = context.getImageData(0, 0, copy.width, copy.height).data;
    let hash = 2166136261;
    for (let i = 0; i < pixels.length; i += 4) hash = Math.imul(hash ^ pixels[i] ^ (pixels[i + 1] << 8) ^ (pixels[i + 2] << 16), 16777619);
    return hash >>> 0;
  });
}
async function assertSpatialPreviewControls(scene) {
  const canvas = await scene.locator('canvas').boundingBox(), area = await scene.boundingBox();
  assert(canvas && area && canvas.height >= 100, 'Compact spatial preview has no useful drawable area');
  const controls = [];
  for (const name of ['Fit', 'Isometric', 'Top', 'Front', 'Floor', 'Upright', 'Grid']) {
    const box = await scene.getByRole('button', { name, exact: true }).boundingBox();
    assert(box && box.x >= area.x - 1 && box.y >= area.y - 1 && box.x + box.width <= area.x + area.width + 1
      && box.y + box.height <= area.y + area.height + 1, `${name} is clipped by the compact preview`);
    assert(box.y + box.height <= canvas.y + 1 || box.y >= canvas.y + canvas.height - 1
      || box.x + box.width <= canvas.x + 1 || box.x >= canvas.x + canvas.width - 1,
    `${name} obscures the actual 3D drawing viewport`);
    for (const prior of controls) assert(!(box.x < prior.x + prior.width - 1 && box.x + box.width > prior.x + 1
      && box.y < prior.y + prior.height - 1 && box.y + box.height > prior.y + 1), `${name} overlaps another 3D control`);
    controls.push(box);
  }
}
function cameraDistance(a, b) {
  return Math.hypot(...a.position.map((value, index) => value - b.position[index]),
    ...a.target.map((value, index) => value - b.target[index]));
}
async function boardPoint(x, y) {
  const box = await page.locator('[data-board]').boundingBox();
  const canvas = await board().boundingBox();
  assert(box && canvas, 'Whiteboard layout is missing');
  const point = { x: box.x + x, y: box.y + y };
  assert(point.x > canvas.x && point.x < canvas.x + canvas.width && point.y > canvas.y && point.y < canvas.y + canvas.height,
    'Test drawing coordinate lies outside the visible board');
  return point;
}
async function dragBoard(from, to) {
  const a = await boardPoint(...from), b = await boardPoint(...to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 10 });
  await page.mouse.up();
  await page.mouse.move(1, 1);
}
async function sourceSnapshot() {
  const details = panel().locator('details').filter({ hasText: 'Source snapshot' });
  if (await details.getAttribute('open') === null) await details.locator('summary').click();
  const image = panel().getByAltText('Captured whiteboard', { exact: true });
  await image.waitFor({ state: 'visible' });
  const result = await image.evaluate(async (element) => {
    await element.decode();
    return { src: element.src, width: element.naturalWidth, height: element.naturalHeight,
      revision: element.getAttribute('data-source-revision') };
  });
  assert.equal(result.width, 800); assert.equal(result.height, 600);
  assert.match(result.src, /^data:image\/png;base64,/);
  assert.notEqual(result.revision, null, 'Source snapshot lacks its drawing revision');
  return result;
}
async function imagePixels(src) {
  return page.evaluate(async (src) => {
    const image = new Image(); image.src = src; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
    const bytes = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let hash = 2166136261, dark = 0;
    for (let i = 0; i < bytes.length; i++) hash = Math.imul(hash ^ bytes[i], 16777619);
    for (let i = 0; i < bytes.length; i += 4) if (bytes[i + 3] > 200 && Math.max(bytes[i], bytes[i + 1], bytes[i + 2]) < 180) dark++;
    return { width: canvas.width, height: canvas.height, hash: hash >>> 0, dark };
  }, src);
}
async function assertGraph(fixture) {
  await until(async () => await panel().locator('.react-flow__node').count() === fixture.nodes.length
    && await panel().locator('.react-flow__edge').count() === fixture.edges.length,
  'Preview node/edge counts differ from the synthetic server result');
}
async function fitForCapture() {
  const details = panel().locator('details[open]').filter({ hasText: 'Source snapshot' });
  if (await details.count()) await details.locator('summary').click();
  const canvas = panel().getByTestId('diagram-preview-canvas');
  await canvas.scrollIntoViewIfNeeded();
  await panel().getByRole('button', { name: 'Fit preview', exact: true }).click();
  await until(async () => canvas.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const nodes = [...element.querySelectorAll('.react-flow__node')];
    return nodes.length > 0 && nodes.every((node) => {
      const box = node.getBoundingClientRect();
      return box.left >= bounds.left && box.top >= bounds.top && box.right <= bounds.right && box.bottom <= bounds.bottom;
    });
  }), 'Fit preview did not bring every object inside its viewport');
  // Capture after the explicit 120 ms fit animation has settled, not mid-pan.
  await page.waitForTimeout(160);
}
async function visibleGraphLayout() {
  return panel().getByTestId('diagram-preview-canvas').evaluate((canvas) => {
    const boxOf = (element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height };
    };
    let visible = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
    const ancestors = [];
    for (let element = canvas; element; element = element.parentElement) {
      const box = boxOf(element), style = getComputedStyle(element);
      const clipsX = /hidden|auto|scroll|clip/.test(style.overflowX);
      const clipsY = /hidden|auto|scroll|clip/.test(style.overflowY);
      if (clipsX) { visible.left = Math.max(visible.left, box.left); visible.right = Math.min(visible.right, box.right); }
      if (clipsY) { visible.top = Math.max(visible.top, box.top); visible.bottom = Math.min(visible.bottom, box.bottom); }
      if (clipsX || clipsY) ancestors.push({ tag: element.tagName, className: element.className, box,
        overflowX: style.overflowX, overflowY: style.overflowY, scrollTop: element.scrollTop });
    }
    const nodes = [...canvas.querySelectorAll('.react-flow__node')].map((node) => ({ id: node.dataset.id, box: boxOf(node) }));
    return { visible, canvas: boxOf(canvas), flow: boxOf(canvas.querySelector('.react-flow')),
      controls: boxOf(canvas.querySelector('[aria-label="Preview view controls"]')),
      viewport: canvas.querySelector('.react-flow__viewport').getAttribute('style'), ancestors, nodes };
  });
}
async function assertVisibleGraph() {
  let layout;
  await until(async () => {
    layout = await visibleGraphLayout();
    const { visible, nodes, controls } = layout;
    return nodes.length > 0 && nodes.every(({ box }) => box.left >= visible.left && box.right <= visible.right
      && box.top >= visible.top && box.bottom <= visible.bottom
      && !(box.left < controls.right && box.right > controls.left && box.top < controls.bottom && box.bottom > controls.top));
  }, 'Preview objects are clipped by a scroll/overflow ancestor after focus', 2000).catch((error) => {
    throw new Error(`${error.message}: ${JSON.stringify(layout)}`);
  });
}

try {
  // Next development compilation can make the first navigation slower than
  // individual interactions; do not wait for unrelated resource load events.
  await page.goto(new URL(`/editor/${firstId}`, baseUrl).href, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await board().waitFor({ state: 'visible' });
  await panel().getByRole('heading', { name: 'Diagram preview', exact: true }).waitFor();
  await panel().getByText('AI preview', { exact: true }).waitFor();
  assert.equal(await panel().getByText(/Sends a frozen image and your description to OpenAI/).count(), 0,
    'The removed screenshot explanation must not return. Source snapshot review remains available.');
  assert.equal(await panel().getByLabel('Preview sample', { exact: true }).count(), 0, 'Demo fixture controls leaked into the product UI');
  await waitStatus('idle');
  assert(await undo().isDisabled(), 'Synthetic blank whiteboard should have no undo history');
  assert.equal(state.patches.length, 0);
  const beforeColors = await boardUI();
  const callsBeforeColors = writesAndPreviewCalls();
  await colorsPanel().waitFor({ state: 'visible' });
  assert.equal(await colorsToggle().getAttribute('aria-controls'), 'whiteboard-colors-panel');
  assert.equal(await colorsToggle().getAttribute('aria-expanded'), 'true');
  assert.equal(await colorsToggle().getAttribute('aria-pressed'), 'true');
  await colorsPanel().getByRole('option', { name: 'Brown', exact: true }).click();
  await colorsPanel().getByRole('button', { name: 'Fill colour', exact: true }).click();
  await colorsPanel().getByRole('option', { name: 'Green', exact: true }).click();
  await page.getByLabel('Line width ([ / ])', { exact: true }).selectOption('4');
  const selectedColors = await colorOptionsUI();
  assert.equal(selectedColors.fillTarget, 'true');
  await colorsToggle().click();
  assert.equal(await colorsToggle().getAttribute('aria-expanded'), 'false');
  assert.equal(await colorsToggle().getAttribute('aria-pressed'), 'false');
  assert.equal(await colorsPanel().count(), 1, 'Hidden palette must stay mounted to preserve local color-field state');
  assert.equal(await colorsPanel().isVisible(), false);
  await colorsToggle().focus(); await colorsToggle().press('Enter');
  await colorsPanel().waitFor({ state: 'visible' });
  assert.deepEqual(await colorOptionsUI(), selectedColors, 'Palette show reset selected colors/options or active fill target');
  await colorsToggle().press('Space');
  assert.equal(await colorsPanel().isVisible(), false);
  await colorsToggle().press('Space');
  await colorsPanel().waitFor({ state: 'visible' });
  assert.deepEqual(await colorOptionsUI(), selectedColors, 'Keyboard palette toggle reset colors/options');
  assert.deepEqual(await boardUI(), beforeColors, 'Palette toggle changed canvas pixels, tools, history or zoom');
  assert.deepEqual(writesAndPreviewCalls(), callsBeforeColors, 'Palette toggle caused autosave, preview API or diagram creation');
  // Restore the classic defaults before the original paint/snapshot regressions.
  await colorsPanel().getByRole('option', { name: 'White', exact: true }).click();
  await colorsPanel().getByRole('button', { name: 'Line colour', exact: true }).click();
  await colorsPanel().getByRole('option', { name: 'Black', exact: true }).click();
  await page.getByLabel('Line width ([ / ])', { exact: true }).selectOption('2');
  console.log('PASS Colors toggle mouse/Enter/Space accessibility; mounted palette and colors/options preserved; no canvas/API writes');
  const initial = await boardUI();
  const hint = panel().getByLabel('Describe your idea', { exact: true });
  await hint.fill('Keep the request and response labels.');
  await hint.pressSequentially(' pstr');
  // A real bubbling image-paste event in the hint must not reach the paint
  // engine's global paste handler or create a floating image selection.
  await hint.evaluate(async (element) => {
    const canvas = document.createElement('canvas'); canvas.width = 8; canvas.height = 8;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#ff0000'; ctx.fillRect(0, 0, 8, 8);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    const data = new DataTransfer(); data.setData('text/plain', 'Hint, not canvas text');
    data.items.add(new File([blob], 'synthetic-clipboard.png', { type: 'image/png' }));
    element.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: data }));
  });
  assert.equal(await page.getByRole('toolbar', { name: 'Selection', exact: true }).count(), 0);
  assert.deepEqual(await boardUI(), initial, 'Hint typing/paste changed the whiteboard pixels, history, zoom or tool');
  await generate();
  await assertGraph(flowchart);
  const originalPreviewId = await previewId();
  assert(originalPreviewId, 'A ready preview needs an identifiable result');
  const firstSnapshot = await sourceSnapshot();
  assert.equal(firstSnapshot.src, state.previewRequests[0].image, 'Source review differs from the frozen image submitted to AI');
  assert.equal(state.previewRequests[0].hint, await hint.inputValue());
  assert.equal((await imagePixels(firstSnapshot.src)).dark, 0, 'Blank board snapshot unexpectedly contains drawing pixels');
  console.log('PASS live AI disclosure/idle/loading/ready states; submitted source dimensions; hint typing and paste are isolated');

  const whiteboardBeforeNavigation = await boardUI();
  const viewport = panel().locator('.react-flow__viewport');
  const transformBefore = await viewport.getAttribute('style');
  const previewBox = await panel().locator('.react-flow').boundingBox();
  assert(previewBox, 'Preview viewport has no bounds');
  await page.mouse.move(previewBox.x + previewBox.width * 0.8, previewBox.y + previewBox.height * 0.8);
  await page.mouse.wheel(0, -130);
  await until(async () => await viewport.getAttribute('style') !== transformBefore, 'Preview wheel did not zoom its own viewport');
  const beforePan = await viewport.getAttribute('style');
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(previewBox.x + previewBox.width * 0.8 - 45, previewBox.y + previewBox.height * 0.8 - 25, { steps: 6 });
  await page.mouse.up({ button: 'middle' });
  await until(async () => await viewport.getAttribute('style') !== beforePan, 'Preview drag did not pan its own viewport');
  await panel().focus();
  await page.keyboard.press('t');
  await page.keyboard.press('Delete');
  await page.keyboard.press('Control+z');
  await assertGraph(flowchart);
  await page.mouse.move(1, 1);
  assert.deepEqual(await boardUI(), whiteboardBeforeNavigation, 'Preview navigation affected the painting editor');
  await generate();
  assert.notEqual(await previewId(), originalPreviewId, 'Repeated generation did not replace the transient result');
  assert.equal(state.patches.length, 0, 'Generating/navigating previews caused a whiteboard write');
  console.log('PASS preview pan/zoom is isolated; repeated results remain transient and Create diagram stays disabled');

  await start('flowchart');
  const hiddenPendingRequest = state.previewRequests.at(-1).clientRequestId;
  const cancelsBeforeCollapse = state.previewCancels.length;
  await collapsePanel('preview').click();
  await until(async () => await status() === 'ready', 'Hidden pending preview did not complete');
  assert.equal(state.previewCancels.length, cancelsBeforeCollapse, 'Collapsing preview cancelled its pending generation');
  assert.equal(await previewId(), `preview-${hiddenPendingRequest}`, 'Hidden preview did not finish its original request');
  await expandPanel('preview').click();
  assert(await commit().isDisabled());
  await assertGraph(flowchart);
  console.log('PASS pending preview continues while collapsed and reopens the same result');

  // Bounded numeric vectors, free arrows, curves and honest bitmap crops share
  // this readonly surface without silently becoming rectangular shape nodes.
  vectorCrop = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 80; canvas.height = 50;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#f8eee0'; ctx.fillRect(0, 0, 80, 50);
    ctx.strokeStyle = '#6e526f'; ctx.lineWidth = 3; ctx.beginPath();
    ctx.moveTo(6, 36); ctx.bezierCurveTo(20, 3, 32, 47, 46, 13); ctx.lineTo(73, 31); ctx.stroke();
    return canvas.toDataURL('image/png');
  });
  const beforeVectors = await boardUI();
  await generate('vectors');
  await assertGraph(vectorFixtureDocument().pages[0]);
  assert.equal(await panel().locator('[data-vector-state="ready"]').count(), 3);
  const curve = panel().locator('[data-id="curved-art"] [data-vector-path]');
  assert.match(await curve.getAttribute('d'), /C/);
  assert.equal(await curve.getAttribute('stroke-dasharray'), '8 5');
  assert.match(await curve.getAttribute('marker-end'), /^url\(#vector-arrow-/);
  const thinArrow = panel().locator('[data-id="thin-arrow-art"]');
  assert.match(await thinArrow.getAttribute('style'), /height:\s*1px/);
  assert.match(await thinArrow.locator('[data-vector-path]').getAttribute('marker-start'), /^url\(#vector-arrow-/);
  assert.equal(await panel().locator('[data-id="triangle-art"] [data-vector-path]').getAttribute('fill'), '#f8c970');
  assert.equal(await panel().locator('[data-vector-state] textarea, [data-vector-state] text').count(), 0);
  await panel().getByText('Source image — pixels not editable', { exact: true }).waitFor();
  await panel().getByAltText('Original sketch detail', { exact: true }).evaluate((image) => image.decode());
  await until(async () => await panel().locator('[data-id="source-detail"] [data-custom-image-state]').getAttribute('data-custom-image-state') === 'ready',
    'Source crop decode did not reach export-ready state');
  assert.match(await panel().locator('[data-id="straight-route"] .react-flow__edge-path').getAttribute('d'), /L/);
  assert.match(await panel().locator('[data-id="curved-route"] .react-flow__edge-path').getAttribute('d'), /C/);
  assert.match(await panel().locator('[data-id="straight-route"] .react-flow__edge-path').evaluate((element) => getComputedStyle(element).strokeDasharray), /^1(?:px)?[,\s]+5(?:px)?$/);
  await fitForCapture();
  const originalVectorBox = await thinArrow.getAttribute('style');
  const vectorHint = await hint.inputValue();
  await panel().focus(); await page.keyboard.press('Delete'); await page.keyboard.press('Control+z');
  await assertVisibleGraph();
  assert.equal(await hint.inputValue(), vectorHint, 'Readonly preview shortcuts invoked browser undo in the unfocused hint');
  assert.equal(await thinArrow.getAttribute('style'), originalVectorBox);
  assert.deepEqual(await boardUI(), beforeVectors, 'Vector preview affected whiteboard state');
  await page.screenshot({ path: path.join(output, '05-vector-artwork.png') });
  console.log('PASS vector triangle/curve/free arrow/crop; semantic labels do not duplicate; routing/dashes and read-only state preserved');

  const layoutBoard = await boardUI();
  const layoutCalls = writesAndPreviewCalls();
  const layoutResult = await previewId();
  const layoutHint = await hint.inputValue();
  const layoutRequestId = state.previewRequests.at(-1).clientRequestId;
  const layoutReceipt = JSON.stringify(state.previews.get(layoutRequestId));
  const layoutArtwork = JSON.stringify(await graphArtworkSnapshot());
  const originalToolsWidth = await panelWidth('tools');
  const originalPreviewWidth = await panelWidth('preview');
  assert.equal(originalToolsWidth, 232);
  assert.equal(originalPreviewWidth, 460);
  assert.equal(await resizeHandle('tools').getAttribute('aria-orientation'), 'vertical');
  assert.equal(await resizeHandle('preview').getAttribute('aria-orientation'), 'vertical');
  await dragPanelWidth('tools', 292);
  await dragPanelWidth('preview', 540);
  await assertCanvasMinimum();
  await resizeHandle('tools').press('ArrowLeft');
  assert.equal(await panelWidth('tools'), 272, 'Tools separator keyboard did not decrease width by 20px');
  await resizeHandle('preview').press('ArrowRight');
  assert.equal(await panelWidth('preview'), 520, 'Preview separator keyboard direction was reversed');
  const toolTiles = await toolsPanel().getByRole('radio').evaluateAll((elements) => elements.map((element) => {
    const bounds = element.getBoundingClientRect();
    return { label: element.textContent, width: bounds.width, height: bounds.height };
  }));
  assert(toolTiles.length > 10, 'Tool grid regression did not inspect every tool group');
  assert(toolTiles.every((tile) => Math.abs(tile.width - toolTiles[0].width) <= 1 && Math.abs(tile.height - tile.width) <= 1),
    `Tool groups must use consistent square tiles, including the single Text tool: ${JSON.stringify(toolTiles)}`);
  await assertVisibleGraph();
  await page.screenshot({ path: path.join(output, '11-resized-whiteboard-panels.png') });
  for (const side of ['tools', 'preview']) {
    await resizeHandle(side).press('Home');
    assert.equal(await panelWidth(side), Number(await resizeHandle(side).getAttribute('aria-valuemin')));
    await resizeHandle(side).press('End');
    assert.equal(await panelWidth(side), Number(await resizeHandle(side).getAttribute('aria-valuemax')));
    await assertCanvasMinimum();
  }
  await dragPanelWidth('tools', originalToolsWidth);
  await dragPanelWidth('preview', originalPreviewWidth);
  // Interrupted drags restore the previous preference and release pointer/
  // cursor state instead of leaving a resize transaction attached to the UI.
  const cancelBox = await resizeHandle('tools').boundingBox();
  const cancelX = cancelBox.x + cancelBox.width / 2, cancelY = cancelBox.y + 110;
  const bodyBeforeDrag = await page.evaluate(() => ({ cursor: document.body.style.cursor, userSelect: document.body.style.userSelect }));
  await page.mouse.move(cancelX, cancelY); await page.mouse.down();
  await page.mouse.move(cancelX + 40, cancelY, { steps: 4 });
  await page.keyboard.press('Escape'); await page.mouse.up(); await page.mouse.move(1, 1);
  assert.equal(await panelWidth('tools'), originalToolsWidth, 'Escape did not revert the interrupted tools resize');
  assert.deepEqual(await page.evaluate(() => ({ cursor: document.body.style.cursor, userSelect: document.body.style.userSelect })), bodyBeforeDrag,
    'Resize did not restore the body cursor/selection style');
  const canvasBeforeCollapse = (await board().boundingBox()).width;
  await collapsePanel('tools').click();
  await expandPanel('tools').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#whiteboard-tools-content').isVisible(), false);
  assert.equal(Math.round((await toolsPanel().boundingBox()).width), 32);
  await collapsePanel('preview').click();
  await expandPanel('preview').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#whiteboard-preview-content').isVisible(), false);
  assert.equal(Math.round((await panel().boundingBox()).width), 32);
  assert((await board().boundingBox()).width > canvasBeforeCollapse + 500, 'Collapsed rails did not release drawing space');
  await page.screenshot({ path: path.join(output, '10-collapsed-whiteboard-panels.png') });
  await expandPanel('tools').click(); await expandPanel('preview').click();
  await panel().waitFor({ state: 'visible' });
  assert.equal(await panelWidth('tools'), originalToolsWidth);
  assert.equal(await panelWidth('preview'), originalPreviewWidth);
  assert.equal(await previewId(), layoutResult);
  assert.equal(await hint.inputValue(), layoutHint);
  await assertVisibleGraph();
  await assertArtworkUnchanged(layoutArtwork, 'Panel resizing/collapse changed the reviewed 2D artwork');
  await until(async () => JSON.stringify(await boardUI()) === JSON.stringify(layoutBoard),
    'Restored panel widths did not preserve canvas pixels/history/tool/zoom');
  assert.equal(JSON.stringify(state.previews.get(layoutRequestId)), layoutReceipt, 'Panel changes mutated the AI preview receipt/source');
  assert.deepEqual(writesAndPreviewCalls(), layoutCalls, 'Panel resize/collapse caused autosave or preview API requests');
  await assertLayoutPreferencesIsolated();
  console.log('PASS panel pointer/keyboard resize, bounds/canvas minimum, Escape cleanup, collapse/reopen; exact source/preview preserved without API writes');

  const vectorGraphBefore3D = JSON.stringify(await graphArtworkSnapshot());
  const vectorReceiptBefore3D = JSON.stringify(state.previews.get(state.previewRequests.at(-1).clientRequestId));
  const previewBefore3D = await previewId();
  const boardBefore3D = await boardUI();
  const callsBefore3D = writesAndPreviewCalls();
  const sourceBefore3D = state.previewRequests.at(-1).image;
  await dimension('3D').click();
  let vectorScene = await waitForPreview3D(vectorFixtureDocument().pages[0]);
  assert.equal(await dimension('3D').getAttribute('aria-pressed'), 'true');
  assert.equal(await panel().getByTestId('diagram-preview-canvas').isVisible(), false);
  assert.equal(await vectorScene.getByRole('textbox').count(), 0, 'Readonly 3D preview exposed label editing');
  assert.equal(await vectorScene.getAttribute('data-orientation'), 'upright', 'Sketch previews should start upright');
  assert.equal(await vectorScene.getByRole('button', { name: 'Grid', exact: true }).getAttribute('aria-pressed'), 'false');
  const uprightPixels = await previewPixels(vectorScene);
  await vectorScene.getByRole('button', { name: 'Floor', exact: true }).click();
  await until(async () => await vectorScene.getAttribute('data-orientation') === 'floor', 'Preview floor orientation did not activate');
  await until(async () => await previewPixels(vectorScene) !== uprightPixels, 'Preview orientation did not change actual WebGL pixels');
  assert.equal(await vectorScene.getByRole('button', { name: 'Floor', exact: true }).getAttribute('aria-pressed'), 'true');
  const noGridPixels = await previewPixels(vectorScene);
  await vectorScene.getByRole('button', { name: 'Grid', exact: true }).click();
  await until(async () => await vectorScene.getAttribute('data-show-grid') === 'true', 'Preview grid did not become visible');
  await until(async () => await previewPixels(vectorScene) !== noGridPixels, 'Grid control had no effect on actual WebGL pixels');
  await dimension('2D').click();
  await assertArtworkUnchanged(vectorGraphBefore3D, 'Changing scene orientation/grid changed the reviewed 2D graph');
  await dimension('3D').click();
  vectorScene = await waitForPreview3D(vectorFixtureDocument().pages[0]);
  assert.equal(await vectorScene.getAttribute('data-orientation'), 'floor', '2D toggle reset result-local orientation');
  assert.equal(await vectorScene.getAttribute('data-show-grid'), 'true', '2D toggle reset result-local grid preference');
  await vectorScene.getByRole('button', { name: 'Upright', exact: true }).click();
  await vectorScene.getByRole('button', { name: 'Grid', exact: true }).click();
  await assertSpatialPreviewControls(vectorScene);
  await page.screenshot({ path: path.join(output, '15-spatial-preview-upright.png') });
  const savedWidth = await panelWidth('preview');
  await dragPanelWidth('preview', 320);
  await assertSpatialPreviewControls(vectorScene);
  await page.screenshot({ path: path.join(output, '16-spatial-preview-compact.png') });
  await dragPanelWidth('preview', savedWidth);
  assert.equal(await previewId(), previewBefore3D);
  assert.equal(JSON.stringify(state.previews.get(state.previewRequests.at(-1).clientRequestId)), vectorReceiptBefore3D,
    'Spatial orientation or grid changed the reviewed server receipt');
  assert.deepEqual(writesAndPreviewCalls(), callsBefore3D, 'Spatial preview controls called AI or stored view metadata');
  console.log('PASS spatial preview Floor/Upright/Grid change pixels, survive 2D toggles locally and keep compact controls outside drawing');
  const originalCamera = await previewCamera(vectorScene);
  const sceneBounds = await vectorScene.locator('canvas').boundingBox();
  assert(sceneBounds, '3D preview canvas has no bounds');
  await page.mouse.move(sceneBounds.x + sceneBounds.width * 0.6, sceneBounds.y + sceneBounds.height * 0.55);
  await page.mouse.down();
  await page.mouse.move(sceneBounds.x + sceneBounds.width * 0.6 + 70, sceneBounds.y + sceneBounds.height * 0.55 + 30, { steps: 10 });
  await page.mouse.up();
  await until(async () => cameraDistance(await previewCamera(vectorScene), originalCamera) > 0.01, 'Dragging did not orbit the readonly 3D preview');
  const beforePreviewZoom = await previewCamera(vectorScene);
  await page.mouse.wheel(0, -120);
  await until(async () => cameraDistance(await previewCamera(vectorScene), beforePreviewZoom) > 0.01,
    'Scroll did not zoom the readonly 3D preview');
  const beforePreviewPan = await previewCamera(vectorScene);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(sceneBounds.x + sceneBounds.width * 0.6 + 40, sceneBounds.y + sceneBounds.height * 0.55 + 15, { steps: 6 });
  await page.mouse.up({ button: 'right' });
  await until(async () => { const camera = await previewCamera(vectorScene); return Math.hypot(...camera.target.map((value, index) => value - beforePreviewPan.target[index])) > 0.01; },
    'Right-drag did not pan the readonly 3D preview');
  const views = vectorScene.getByRole('group', { name: '3D camera views', exact: true });
  await views.getByRole('button', { name: 'Top', exact: true }).click();
  await until(async () => { const camera = await previewCamera(vectorScene); return Math.abs(camera.position[0] - camera.target[0]) < 0.01
    && camera.position[1] - camera.target[1] > 1; }, '3D preview Top preset did not move camera');
  await views.getByRole('button', { name: 'Front', exact: true }).click();
  await until(async () => { const camera = await previewCamera(vectorScene); return Math.abs(camera.position[1] - camera.target[1]) < 0.01
    && camera.position[2] - camera.target[2] > 1; }, '3D preview Front preset did not move camera');
  await views.getByRole('button', { name: 'Isometric', exact: true }).click();
  await until(async () => { const camera = await previewCamera(vectorScene); return camera.position[0] - camera.target[0] > 1
    && camera.position[1] - camera.target[1] > 1; }, '3D preview Isometric preset did not move camera');
  await views.getByRole('button', { name: 'Fit', exact: true }).click();
  const canvasWidthBeforeResize = (await vectorScene.locator('canvas').boundingBox()).width;
  await dragPanelWidth('preview', 600);
  await assertCanvasMinimum();
  await until(async () => (await vectorScene.locator('canvas').boundingBox()).width > canvasWidthBeforeResize + 100,
    '3D canvas did not follow the resized AI panel');
  await views.getByRole('button', { name: 'Fit', exact: true }).click();
  assert((await previewCamera(vectorScene)).position.every(Number.isFinite), 'Fit after panel resize produced an invalid camera');
  await page.screenshot({ path: path.join(output, '12-resized-preview-3d.png') });
  await dragPanelWidth('preview', originalPreviewWidth);
  await views.getByRole('button', { name: 'Fit', exact: true }).click();
  await page.waitForTimeout(250);
  const cameraBeforeCollapse = await previewCamera(vectorScene);
  await collapsePanel('preview').click();
  assert.equal(await page.locator('#whiteboard-preview-content').isVisible(), false);
  await until(async () => await panel().getByTestId('diagram-preview-3d').locator('canvas').count() === 0,
    'Collapsed AI panel kept its WebGL canvas alive');
  await expandPanel('preview').click();
  assert.equal(await dimension('3D').getAttribute('aria-pressed'), 'true', 'Reopening preview reset its selected dimension');
  vectorScene = await waitForPreview3D(vectorFixtureDocument().pages[0]);
  await until(async () => cameraDistance(await previewCamera(vectorScene), cameraBeforeCollapse) < 0.01,
    'Collapsing and reopening the AI panel lost its local review camera');
  assert.equal(await previewId(), previewBefore3D);
  assert.equal(await hint.inputValue(), layoutHint);
  assert.equal(state.previewRequests.at(-1).image, sourceBefore3D);
  assert.deepEqual(writesAndPreviewCalls(), callsBefore3D, '3D resize/collapse called the API or saved a document');
  console.log('PASS 3D resize/Fit and collapse/reopen preserve result/camera and release hidden WebGL');
  const vectorHintBefore3D = await hint.inputValue();
  await setIdeaExpanded(true);
  await hint.fill(`${vectorHintBefore3D} Review another viewpoint.`);
  await panel().getByText(/^Your drawing or description has changed/).waitFor();
  await setIdeaExpanded(false);
  assert.equal(await previewId(), previewBefore3D, 'Stale hint created another 3D preview result');
  await views.getByRole('button', { name: 'Fit', exact: true }).click();
  await setIdeaExpanded(true);
  await hint.fill(vectorHintBefore3D);
  await setIdeaExpanded(false);
  await until(async () => await panel().getByText(/^Your drawing or description has changed/).count() === 0, 'Restoring the reviewed hint left 3D preview stale');
  await panel().focus(); await page.keyboard.press('Delete'); await page.keyboard.press('Control+z');
  assert.equal(await hint.inputValue(), vectorHintBefore3D);
  await page.screenshot({ path: path.join(output, '07-vector-preview-3d.png') });
  await page.setViewportSize({ width: 1366, height: 768 });
  const compactViewer = panel().getByTestId('diagram-preview-viewer');
  await compactViewer.scrollIntoViewIfNeeded();
  await until(async () => {
    const viewer = await compactViewer.boundingBox();
    const disclaimer = await compactViewer.getByText(/^Read-only\./).boundingBox();
    const details = await panel().getByText(/^5 objects.*2 connections/).locator('..').boundingBox();
    return viewer && disclaimer && details && viewer.y + viewer.height <= details.y + 1
      && disclaimer.y + disclaimer.height <= details.y + 1;
  }, 'Short desktop viewport overlapped the 3D disclaimer/viewer with result details');
  await page.screenshot({ path: path.join(output, '09-short-preview-3d.png') });
  await page.setViewportSize({ width: 1440, height: 960 });
  await vectorScene.scrollIntoViewIfNeeded();
  // Camera state is local to this result and must survive a view switch without
  // touching editor documents, diagram APIs or the reviewed provider receipt.
  await page.waitForTimeout(250);
  const savedPreviewCamera = await previewCamera(vectorScene);
  await dimension('2D').click();
  await panel().getByTestId('diagram-preview-canvas').waitFor({ state: 'visible' });
  await assertArtworkUnchanged(vectorGraphBefore3D, 'Returning to 2D changed the reviewed objects, paths, labels or connections');
  assert.equal(await panel().getByTestId('diagram-preview-3d').locator('canvas').count(), 0,
    'Hidden 3D mode retained an unnecessary WebGL canvas');
  await dimension('3D').click();
  vectorScene = await waitForPreview3D(vectorFixtureDocument().pages[0]);
  await until(async () => cameraDistance(await previewCamera(vectorScene), savedPreviewCamera) < 0.01,
    '2D to 3D switch lost the result-local review camera');
  // Synthetic context loss exercises the real fallback with no GPU failure or
  // provider/network call. The reviewed document must remain recoverable in 2D.
  await vectorScene.locator('canvas').evaluate((canvas) => canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true })));
  await vectorScene.getByRole('button', { name: 'Return to 2D', exact: true }).waitFor({ state: 'visible' });
  await vectorScene.getByRole('button', { name: 'Return to 2D', exact: true }).click();
  await dimension('2D').waitFor({ state: 'visible' });
  assert.equal(await dimension('2D').getAttribute('aria-pressed'), 'true');
  await assertArtworkUnchanged(vectorGraphBefore3D, 'Fallback lost the exact reviewed 2D graph');
  assert.equal(await previewId(), previewBefore3D);
  assert.equal(state.previewRequests.at(-1).image, sourceBefore3D, '3D interactions altered the frozen source');
  assert.equal(JSON.stringify(state.previews.get(state.previewRequests.at(-1).clientRequestId)), vectorReceiptBefore3D,
    '3D navigation changed the synthetic persisted preview receipt');
  assert.deepEqual(await boardUI(), boardBefore3D, '3D navigation/fallback changed whiteboard pixels, zoom, tool or undo state');
  assert.deepEqual(writesAndPreviewCalls(), callsBefore3D, '3D navigation called AI/API or persisted view changes');
  assert(await commit().isDisabled());
  console.log('PASS 2D↔3D shares exact graph; orbit/pan/zoom/presets/fit/local camera/context-loss fallback; source and API state untouched');

  const beforeParabola = await boardUI();
  await generate('parabola');
  await assertGraph(fixtureDocument(parabola).pages[0]);
  assert.equal(await panel().locator('.react-flow__node-VectorPathNode').count(), 4);
  assert.equal(await panel().locator('.react-flow__node-TextNode').count(), 4);
  assert.equal(await panel().locator('.react-flow__node-RectangleNode, .react-flow__edge').count(), 0);
  for (const axis of ['x-axis', 'y-axis']) {
    const shape = panel().locator(`[data-id="${axis}"] [data-vector-path]`);
    assert.match(await shape.getAttribute('d'), /L/);
    assert.match(await shape.getAttribute('marker-end'), /^url\(#vector-arrow-/);
  }
  const quadratic = panel().locator('[data-id="parabola"] [data-vector-path]');
  assert.equal(await quadratic.getAttribute('d'), 'M0 800 Q300 0 600 800');
  assert.equal(await quadratic.getAttribute('stroke'), '#2563EB');
  assert.equal(await panel().locator('[data-id="height-guide"] [data-vector-path]').getAttribute('stroke-dasharray'), '8 5');
  for (const node of parabola.nodes) {
    assert.equal(await panel().locator(`[data-id="${node.id}"] textarea`).inputValue(), node.label,
      `Parabola text ${node.id} was not preserved as its own editable document node`);
  }
  assert.equal(await panel().locator('.react-flow__node-VectorPathNode textarea, .react-flow__node-VectorPathNode text').count(), 0);
  await fitForCapture();
  const parabolaHint = await hint.inputValue();
  await panel().focus(); await page.keyboard.press('Delete'); await page.keyboard.press('Control+z');
  await assertVisibleGraph();
  assert.equal(await hint.inputValue(), parabolaHint, 'Readonly parabola preview changed the hint through native undo');
  // Legitimate hint changes insert/remove the stale banner and resize the
  // canvas. Close the explicit composer to return to review. Automatic fitting
  // must keep the whole graph actually visible,
  // accounting for every clipping/scroll ancestor, without another Fit click.
  await setIdeaExpanded(true);
  await hint.fill(`${parabolaHint} Updated context.`);
  await panel().getByText(/^Your drawing or description has changed/).waitFor();
  await setIdeaExpanded(false);
  await assertVisibleGraph();
  await setIdeaExpanded(true);
  await hint.fill(parabolaHint);
  await setIdeaExpanded(false);
  await until(async () => await panel().getByText(/^Your drawing or description has changed/).count() === 0, 'Restored hint did not clear the stale notice');
  await panel().focus();
  await assertVisibleGraph();
  await assertGraph(fixtureDocument(parabola).pages[0]);
  assert.deepEqual(await boardUI(), beforeParabola, 'Parabola review altered the whiteboard');
  assert(await commit().isDisabled());
  await page.screenshot({ path: path.join(output, '06-parabola.png') });
  console.log('PASS public V2 parabola fixture: separate axes, quadratic curve, dashed guide and independent text; dynamic resize fit/visible clipping/read-only preserved');

  const postsBeforeRecovery = state.previewRequests.length;
  await generate('connection-loss');
  await assertGraph(flowchart);
  assert.equal(state.previewRequests.length, postsBeforeRecovery + 1, 'Lost response triggered an extra generation');
  assert(state.previewLookups.includes(state.previewRequests.at(-1).clientRequestId), 'Lost POST response was not recovered by request-ID lookup');
  console.log('PASS lost response recovers through GET without another AI POST');

  await page.getByRole('radio', { name: 'Pencil', exact: true }).click();
  await dragBoard([70, 90], [175, 145]);
  await panel().getByText(/^Your drawing or description has changed/).waitFor();
  await until(() => !!state.documents.get(firstId).data.image, 'Painting stroke was not autosaved');
  const paintedImage = state.documents.get(firstId).data.image;
  assert((await imagePixels(paintedImage)).dark > 50, 'Synthetic stroke did not draw pixels');
  await generate('warnings');
  await assertGraph(warnings);
  for (const warning of warnings.warnings) await panel().getByText(warning.message, { exact: true }).waitFor();
  const previousId = await previewId();
  await page.screenshot({ path: path.join(output, '01-desktop-warnings.png') });
  await generate('error', 'error');
  const restore = panel().getByRole('button', { name: 'Use previous preview', exact: true });
  await restore.waitFor({ state: 'visible' });
  await restore.click();
  await waitStatus('ready');
  assert.equal(await previewId(), previousId, 'Error recovery did not restore the last successful result');
  await assertGraph(warnings);
  await generate('unrecognized', 'unrecognized');
  await generate('expired', 'expired');
  await page.screenshot({ path: path.join(output, '02-expired.png') });
  console.log('PASS drawing changes mark preview stale; warnings/error recovery/unrecognized/expired are explicit');

  await start('flowchart');
  const cancelledRequestId = state.previewRequests.at(-1).clientRequestId;
  await panel().getByRole('button', { name: 'Cancel preview', exact: true }).click();
  await until(async () => await status() !== 'loading', 'Cancel did not leave the loading state');
  await until(() => state.previewCancels.includes(cancelledRequestId), 'Cancel was not sent to the server using the original request ID');
  const cancelled = { status: await status(), id: await previewId() };
  await page.waitForTimeout(900); // Beyond the intentional 650 ms synthetic API delay.
  assert.deepEqual({ status: await status(), id: await previewId() }, cancelled, 'A late cancelled response replaced the displayed state');
  assert(await commit().isDisabled());

  // Only two deliberate pixel-history operations exist: stroke, then lift.
  // Snapshotting a floating selection must preserve it and add no undo step.
  await page.getByRole('radio', { name: 'Selection', exact: true }).click();
  await dragBoard([50, 65], [195, 170]);
  const selection = page.getByRole('toolbar', { name: 'Selection', exact: true });
  await selection.waitFor({ state: 'visible' });
  await generate('flowchart');
  const selectedSnapshot = await sourceSnapshot();
  assert.deepEqual(await imagePixels(selectedSnapshot.src), await imagePixels(paintedImage),
    'Captured snapshot omitted the floating selection or included editor chrome');
  assert(await selection.isVisible(), 'Capturing a preview committed the floating selection');
  await undo().click();
  await undo().click();
  assert(await undo().isDisabled(), 'Preview generation added a whiteboard history entry');
  await until(() => state.patches.at(-1)?.payload.data?.image
    && state.documents.get(firstId).data.image !== paintedImage, 'Undo did not autosave the restored board');
  await until(async () => (await imagePixels(state.documents.get(firstId).data.image)).dark === 0,
    'Two undo operations did not restore the blank whiteboard');

  await page.getByRole('radio', { name: 'Text', exact: true }).click();
  await dragBoard([55, 70], [250, 125]);
  const text = page.getByRole('textbox', { name: 'Text', exact: true });
  await text.fill('Pending source text');
  const beforeTextCapture = state.patches.length;
  await generate('flowchart');
  const textSnapshot = await sourceSnapshot();
  assert((await imagePixels(textSnapshot.src)).dark > 80, 'Snapshot omitted the uncommitted text');
  assert.equal(await text.inputValue(), 'Pending source text', 'Snapshot committed or cleared the pending text');
  assert(await undo().isDisabled(), 'Snapshotting uncommitted text changed history');
  assert.equal(state.patches.length, beforeTextCapture, 'Capturing pending text caused an autosave');
  await text.press('Escape');
  console.log('PASS read-only capture includes floating pixels and pending text without committing or adding history');

  await page.setViewportSize({ width: 640, height: 800 });
  await page.getByRole('tab', { name: 'Preview', exact: true }).click();
  await panel().waitFor({ state: 'visible' });
  assert.equal(await resizeHandle('preview').count(), 0, 'Desktop AI resize separator leaked into narrow tabs');
  assert.equal(await collapsePanel('preview').count(), 0, 'Desktop AI collapse button leaked into narrow tabs');
  assert(await panel().evaluate((element) => {
    const box = element.getBoundingClientRect(); return box.x >= -1 && box.right <= innerWidth + 1;
  }), 'Preview overflows the narrow viewport');
  await page.screenshot({ path: path.join(output, '03-narrow-preview.png') });
  const narrowPreviewId = await previewId();
  const callsBeforeNarrow3D = writesAndPreviewCalls();
  const narrowSource = state.previewRequests.at(-1).image;
  await dimension('3D').click();
  const narrowScene = await waitForPreview3D(fixtureDocument(flowchart).pages[0]);
  await narrowScene.scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
  const narrowCamera = await previewCamera(narrowScene);
  await page.screenshot({ path: path.join(output, '08-narrow-preview-3d.png') });
  await page.getByRole('tab', { name: 'Whiteboard', exact: true }).click();
  await board().waitFor({ state: 'visible' });
  assert.equal(await panel().locator('canvas').count(), 0, 'Hidden narrow preview retained a WebGL canvas');
  const narrowToolsWidth = await panelWidth('tools');
  await resizeHandle('tools').press('End');
  await assertCanvasMinimum(160);
  await dragPanelWidth('tools', narrowToolsWidth);
  await collapsePanel('tools').press('Enter');
  await expandPanel('tools').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#whiteboard-tools-content').isVisible(), false);
  await expandPanel('tools').press('Space');
  assert.equal(await panelWidth('tools'), narrowToolsWidth);
  await page.screenshot({ path: path.join(output, '04-narrow-whiteboard.png') });
  await page.getByRole('tab', { name: 'Preview', exact: true }).click();
  assert.equal(await dimension('3D').getAttribute('aria-pressed'), 'true', 'Narrow tab switch reset preview dimension');
  const resumedNarrowScene = await waitForPreview3D(fixtureDocument(flowchart).pages[0]);
  await until(async () => cameraDistance(await previewCamera(resumedNarrowScene), narrowCamera) < 0.01,
    'Narrow tab hide/show lost the local preview camera');
  assert.equal(await previewId(), narrowPreviewId);
  assert.equal(state.previewRequests.at(-1).image, narrowSource);
  assert.deepEqual(writesAndPreviewCalls(), callsBeforeNarrow3D, 'Narrow 3D/tab navigation caused API writes or another generation');
  await dimension('2D').click();
  await panel().getByTestId('diagram-preview-canvas').waitFor({ state: 'visible' });
  console.log('PASS narrow 3D/tab navigation retains preview/camera, disposes hidden WebGL and never regenerates');
  await page.setViewportSize({ width: 1440, height: 960 });
  await panel().waitFor({ state: 'visible' });

  await start();
  const switchedRequestId = state.previewRequests.at(-1).clientRequestId;
  // Native history updates Next's pathname without reloading the JS realm:
  // an outstanding request from A must never populate B's preview panel.
  await page.evaluate((id) => window.history.pushState(null, '', `/editor/${id}`), secondId);
  await until(async () => await page.getByLabel('Whiteboard title', { exact: true }).inputValue() === 'Preview smoke B',
    'Second whiteboard did not load');
  await waitStatus('idle');
  await until(() => state.previewCancels.includes(switchedRequestId), 'Switching documents did not cancel its outstanding preview');
  await page.waitForTimeout(900);
  await waitStatus('idle');
  assert.equal(await previewId(), '', 'Previous document result leaked into the next whiteboard');
  assert.equal(await panel().getByLabel('Describe your idea', { exact: true }).inputValue(), '', 'Previous document hint leaked into the next whiteboard');
  assert.equal(await panel().locator('.react-flow__node').count(), 0);
  assert.equal(state.documents.size, 2, 'Preview generated a new official diagram');
  assert.equal(state.documents.get(secondId).data.image, null, 'Preview state changed another whiteboard');
  const callsBeforeLayoutReload = writesAndPreviewCalls();
  await dragPanelWidth('tools', 192);
  await dragPanelWidth('preview', 420);
  await collapsePanel('tools').click();
  await collapsePanel('preview').click();
  const preferencesBeforeReload = await assertLayoutPreferencesIsolated();
  assert.deepEqual(JSON.parse(preferencesBeforeReload), {
    toolsWidth: 192, previewWidth: 420, toolsCollapsed: true, previewCollapsed: true,
  });
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });
  await board().waitFor({ state: 'visible' });
  await expandPanel('tools').waitFor({ state: 'visible' });
  await expandPanel('preview').waitFor({ state: 'visible' });
  assert.equal(await assertLayoutPreferencesIsolated(), preferencesBeforeReload, 'Reload changed saved panel preferences');
  assert.equal(Math.round((await toolsPanel().boundingBox()).width), 32);
  assert.equal(Math.round((await panel().boundingBox()).width), 32);
  await expandPanel('tools').click();
  await expandPanel('preview').click();
  assert.equal(await panelWidth('tools'), 192, 'Reload did not restore preferred tools width');
  assert.equal(await panelWidth('preview'), 420, 'Reload did not restore preferred preview width');
  assert.equal(await page.getByLabel('Whiteboard title', { exact: true }).inputValue(), 'Preview smoke B');
  assert.equal(state.documents.get(secondId).data.image, null);
  assert.deepEqual(writesAndPreviewCalls(), callsBeforeLayoutReload, 'UI layout persistence caused API calls or autosave');
  console.log('PASS panel widths/collapse persist across reload under an independent UI-only key; Diagram preferences/document untouched');
  assert.deepEqual(state.forbidden, [], 'Unexpected AI, API, external request or official diagram creation');
  assert.deepEqual(state.routeErrors, [], 'An autosave violated the whiteboard-only storage contract');
  assert.deepEqual(errors, [], 'Browser console or runtime errors occurred');
  console.log('PASS cancel/document-switch discard late results; narrow tabs work; no real AI/S3 calls or diagram creation');
  console.log(`All whiteboard preview smoke checks passed. Screenshots: ${output}`);
} catch (error) {
  await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
  console.error(`FAIL: ${error.message}\nBrowser errors: ${JSON.stringify(errors)}\nBlocked: ${JSON.stringify(state.forbidden)}\nScreenshots: ${output}`);
  process.exitCode = 1;
} finally {
  clearTimeout(watchdog);
  await browser.close();
}
