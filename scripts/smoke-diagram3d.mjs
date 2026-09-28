/**
 * Browser smoke tests for the real shared 2D / editable 3D editor.
 *
 * Start the frontend separately, then run `node scripts/smoke-diagram3d.mjs`.
 * Requires an already installed playwright or playwright-core. Optionally set:
 *   PLAYWRIGHT_MODULE_PATH: absolute path to an existing package directory
 *   BASE_URL: local frontend URL (default http://localhost:3000)
 *   BROWSER_EXECUTABLE_PATH: installed Chromium / Chrome / Edge executable
 *   SMOKE_OUTPUT_DIR: screenshot directory (default a fresh OS temp directory)
 *   SMOKE_SUITE: comma-separated legacy,editing,catalog,fallback,integrity,removed-feature,surface-labels,flat-artwork,spatial-artwork (default all)
 *   SMOKE_DOCUMENT_PATH: optional reviewed diagram JSON for reviewed-artwork suite
 *
 * Uses a fresh browser context and synthetic fixtures only. Authentication and
 * diagram reads/writes are intercepted in memory; unexpected API writes and
 * external requests are blocked. Does not start a server or require credentials.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { deflateSync } from 'node:zlib';

const require = createRequire(import.meta.url);
const baseUrl = new URL(process.env.BASE_URL ?? 'http://localhost:3000');
const availableSuites = ['legacy', 'editing', 'catalog', 'fallback', 'integrity', 'removed-feature', 'surface-labels', 'flat-artwork', 'spatial-artwork', 'reviewed-artwork'];
const suites = new Set((process.env.SMOKE_SUITE ?? availableSuites.filter((name) => name !== 'reviewed-artwork').join(',')).split(','));
assert([...suites].every((suite) => availableSuites.includes(suite)), 'Unknown SMOKE_SUITE');
assert(['localhost', '127.0.0.1', '[::1]'].includes(baseUrl.hostname),
  'BASE_URL must point to a local development/test server, never production.');

function loadPlaywright() {
  const candidates = process.env.PLAYWRIGHT_MODULE_PATH
    ? [process.env.PLAYWRIGHT_MODULE_PATH]
    : ['playwright', 'playwright-core'];
  for (const candidate of candidates) {
    try { return require(candidate); } catch (error) {
      if (error.code !== 'MODULE_NOT_FOUND') throw error;
    }
  }
  throw new Error('Playwright is not installed. Set PLAYWRIGHT_MODULE_PATH to an existing playwright-core package.');
}

const { chromium } = loadPlaywright();
const outputDir = process.env.SMOKE_OUTPUT_DIR
  ? path.resolve(process.env.SMOKE_OUTPUT_DIR)
  : await mkdtemp(path.join(tmpdir(), 'easydraw-diagram3d-'));
await mkdir(outputDir, { recursive: true });
const fixtureId = 'test-3d-smoke';
const otherFixtureId = 'test-3d-smoke-other';
const firstPageId = 'smoke-main';
const secondPageId = 'smoke-second';
const emptyPageId = 'smoke-empty';

const node = (id, type, x, y, label, extra = {}) => ({
  id, type, position: { x, y }, width: 150, height: 90,
  data: { label }, ...extra,
});
const anchor = (id, x, y) => ({
  id, type: 'connection-anchor', position: { x, y }, data: {},
  origin: [0.5, 0.5], width: 12, height: 12, selectable: false, draggable: false,
});
const edge = (id, source, target, label, extra = {}) => ({
  id, type: 'connection', source, target, sourceHandle: 'right', targetHandle: 'left',
  data: { labels: [{ id: `${id}-label`, t: 0.5, text: label }], markerEnd: 'arrow', ...extra },
});

function createFixture() {
  return {
    id: fixtureId, title: '3D smoke fixture', type: 'flowchart', status: 'draft',
    data: {
      // Intentionally omit schemaVersion and view3d: old diagrams must switch
      // to 3D without a migration or previously saved camera configuration.
      activePageId: firstPageId,
      pages: [
        {
          id: firstPageId, name: 'Main page',
          nodes: [
            node('smoke-user', 'RectangleNode', 80, 100, 'Web App', {
              style: 'width: 150px; height: 90px;',
            }),
            node('smoke-api', 'RoundedRectangleNode', 360, 100, 'Auth API'),
            node('smoke-db', 'EntityNode', 660, 100, 'Accounts', {
              height: 125, data: { label: 'Accounts', fields: [{ name: 'id', key: 'PK' }, { name: 'email' }] },
            }),
            node('smoke-unknown', 'FutureCustomNode', 350, 360, 'Future custom shape'),
            anchor('smoke-anchor-a', 90, 370), anchor('smoke-anchor-b', 250, 370),
          ],
          edges: [
            edge('smoke-request', 'smoke-user', 'smoke-api', 'request'),
            edge('smoke-query', 'smoke-api', 'smoke-db', 'query', {
              bendPoints: [{ x: 575, y: 145 }], markerStart: 'circle', markerEnd: 'triangle',
            }),
            { ...edge('smoke-floating', 'smoke-anchor-a', 'smoke-anchor-b', 'floating'),
              sourceHandle: 'a', targetHandle: 'a' },
          ],
        },
        {
          id: secondPageId, name: 'Second page',
          nodes: [node('smoke-second-node', 'CircleNode', 250, 170, 'Second page node')], edges: [],
        },
        { id: emptyPageId, name: 'Empty page', nodes: [], edges: [] },
      ],
    },
  };
}

function createOtherFixture() {
  return {
    id: otherFixtureId, title: 'Other 3D smoke document', type: 'flowchart', status: 'draft',
    data: {
      activePageId: 'smoke-other-page',
      pages: [{ id: 'smoke-other-page', name: 'Other document page',
        nodes: [node('smoke-other-node', 'RectangleNode', 180, 160, 'Other document node')], edges: [] }],
    },
  };
}

const catalogTypes = [
  'RectangleNode', 'RoundedRectangleNode', 'CircleNode', 'DiamondNode', 'TriangleNode',
  'DonutNode', 'StarNode', 'DropNode', 'HalfCircleNode', 'CubeNode', 'DatabaseNode',
  'DocumentNode', 'ActorNode', 'EntityNode', 'WeakEntityNode', 'AssociativeEntityNode',
  'ArrowRightNode', 'BendArrowNode', 'QuadArrowNode', 'UmlPackageNode', 'UmlComponentNode',
  'UmlNoteCommentNode', 'UmlInitialNode', 'UmlFinalNode', 'TextNode',
];

function createCatalogFixture() {
  const fixture = createFixture();
  fixture.data.pages[0].nodes = catalogTypes.map((type, index) => node(
    `catalog-${index}`, type, 60 + (index % 6) * 230, 60 + Math.floor(index / 6) * 190,
    type.replace(/Node$/, ''),
    /Entity/.test(type) ? { data: { label: type.replace(/Node$/, ''), fields: [{ name: 'id', key: 'PK' }, { name: 'value' }] } } : {},
  ));
  fixture.data.pages[0].edges = [];
  return fixture;
}

function createSurfaceLabelFixture() {
  const fixture = createFixture();
  fixture.data.pages[0].nodes = [
    node('surface-label', 'RectangleNode', 80, 70, 'Printed on the object', {
      width: 340, height: 170,
      data: { label: 'Printed on the object', fontSize: 24, textColor: '#111111', fillColor: '#ffffff' },
    }),
    node('surface-entity', 'EntityNode', 510, 70, 'Accounts', {
      width: 290, height: 230,
      data: { label: 'Accounts', fields: [{ name: 'id', key: 'PK' }, { name: 'email' }, { name: 'created_at' }] },
    }),
    node('surface-blank', 'RectangleNode', 80, 365, '', { width: 290, height: 140 }),
    node('surface-text', 'TextNode', 505, 390, 'Ghi chú trên bản vẽ', {
      width: 320, height: 100, data: { label: 'Ghi chú trên bản vẽ', fontSize: 22 },
    }),
  ];
  fixture.data.pages[0].edges = [];
  return fixture;
}

const artworkColors = [[224, 47, 71], [33, 160, 95], [28, 62, 221], [238, 185, 32]];

/** Tiny asymmetric, opaque PNG with valid CRCs. No network fixture, asset file,
 * image library or second browser is needed to exercise the real PNG decoder. */
function createArtworkPng() {
  const chunk = (type, bytes) => {
    const payload = Buffer.concat([Buffer.from(type), bytes]);
    let crc = 0xffffffff;
    for (const byte of payload) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    const length = Buffer.alloc(4), checksum = Buffer.alloc(4);
    length.writeUInt32BE(bytes.length); checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([length, payload, checksum]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(8, 0); header.writeUInt32BE(8, 4); header[8] = 8; header[9] = 6;
  const pixels = Buffer.alloc(8 * (1 + 8 * 4));
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const color = artworkColors[(y < 4 ? 0 : 2) + (x < 4 ? 0 : 1)];
    pixels.set([...color, 255], y * 33 + 1 + x * 4);
  }
  return `data:image/png;base64,${Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header),
    chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0)),
  ]).toString('base64')}`;
}

function createFlatArtworkFixture() {
  const fixture = createFixture();
  const vector = (commands, extra = {}) => ({ version: 1, commands, stroke: '#215c3e', fill: '#21a05f',
    strokeWidth: 2, dash: 'solid', startArrow: false, endArrow: false, ...extra });
  fixture.data.pages[0].nodes = [
    node('artwork-filled', 'VectorPathNode', 60, 70, '', { width: 320, height: 170, data: {
      label: 'SEMANTIC VECTOR MUST NOT PRINT', vector: vector([
        { op: 'M', values: [0, 0] }, { op: 'L', values: [1000, 0] }, { op: 'L', values: [1000, 1000] },
        { op: 'L', values: [0, 1000] }, { op: 'Z', values: [] },
      ]),
    } }),
    node('artwork-source', 'SourceImageNode', 450, 70, '', { width: 320, height: 170, data: {
      label: 'SEMANTIC IMAGE MUST NOT PRINT', image: { version: 1, dataUrl: createArtworkPng(), width: 8, height: 8,
        reason: 'Four colored quadrants preserve source orientation without inferring volume.' },
    } }),
    node('artwork-curve', 'VectorPathNode', 60, 300, '', { width: 320, height: 170, data: {
      label: 'SEMANTIC CURVE MUST NOT PRINT', vector: vector([
        { op: 'M', values: [0, 1000] }, { op: 'Q', values: [500, 0, 1000, 1000] },
      ], { stroke: '#1c3edd', fill: 'none', strokeWidth: 8, startArrow: true, endArrow: true }),
    } }),
    node('artwork-thin', 'VectorPathNode', 415, 320, '', { width: 1, height: 110, data: {
      label: 'SEMANTIC THIN MUST NOT PRINT', vector: vector([
        { op: 'M', values: [500, 0] }, { op: 'L', values: [500, 1000] },
      ], { stroke: '#e02f47', fill: 'none', strokeWidth: 2 }),
    } }),
    node('artwork-text', 'TextNode', 500, 325, 'Visible text stays separate', {
      width: 270, height: 100, data: { label: 'Visible text stays separate', fontSize: 22, textColor: '#111111' },
    }),
  ];
  fixture.data.pages[0].edges = [];
  return fixture;
}

function createSpatialArtworkFixture() {
  const fixture = createFlatArtworkFixture();
  fixture.data.pages[0].nodes.push(node('spatial-entity', 'EntityNode', 900, 70, 'Design entity', {
    width: 240, height: 190, data: { label: 'Design entity', fields: [{ name: 'id', key: 'PK' }, { name: 'description' }] },
  }));
  fixture.data.pages[0].edges = [edge('spatial-link', 'artwork-filled', 'spatial-entity', 'Shared connection', { routing: 'curved' })];
  return fixture;
}

const browser = await chromium.launch({
  headless: true,
  ...(process.env.BROWSER_EXECUTABLE_PATH ? { executablePath: process.env.BROWSER_EXECUTABLE_PATH } : {}),
  args: ['--enable-webgl', '--enable-unsafe-swiftshader'],
});

async function createMockContext({ noWebGL = false, catalog = false, retiredFeaturePayload = false, surfaceLabels = false, flatArtwork = false, spatialArtwork = false, reviewedArtwork = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, serviceWorkers: 'block' });
  const state = { diagram: spatialArtwork ? createSpatialArtworkFixture() : flatArtwork ? createFlatArtworkFixture() : surfaceLabels ? createSurfaceLabelFixture() : catalog ? createCatalogFixture() : createFixture(), otherDiagram: createOtherFixture(),
    patches: [], patchRecords: [], ownershipViolations: [], blocked: [] };
  if (reviewedArtwork) {
    assert(process.env.SMOKE_DOCUMENT_PATH, 'reviewed-artwork requires an explicit local SMOKE_DOCUMENT_PATH');
    const document = JSON.parse(await readFile(path.resolve(process.env.SMOKE_DOCUMENT_PATH), 'utf8'));
    const source = document.pages?.find((entry) => entry.id === document.activePageId) ?? document.pages?.[0];
    assert(source && Array.isArray(source.nodes) && Array.isArray(source.edges), 'Reviewed JSON must contain a paged diagram');
    state.diagram.data.pages[0].nodes = structuredClone(source.nodes);
    state.diagram.data.pages[0].edges = structuredClone(source.edges);
  }
  if (retiredFeaturePayload) {
    // Regression input only: documents written by the removed feature must
    // still open as ordinary editable diagrams without mounting its player.
    state.diagram.data.interactive = {
      version: 1, enabled: true, pack: 'sequence', defaultScenarioId: 'old-scenario',
      scenarios: [{ id: 'old-scenario', name: 'Previously saved scenario', events: [
        { id: 'old-send', type: 'SEND_MESSAGE', order: 0,
          sourceId: 'smoke-user', targetId: 'smoke-api', label: 'Legacy request' },
        { id: 'old-return', type: 'RETURN_MESSAGE', order: 1,
          sourceId: 'smoke-api', targetId: 'smoke-user', label: 'Legacy response' },
      ] }],
    };
    state.diagram.data.pages[0].view3d = {
      version: 1,
      camera: { position: [12, 10, 15], target: [0, 0.5, 0] },
      origin: [4.2, 0, 2.6],
    };
  }
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const headers = {
      'access-control-allow-origin': baseUrl.origin,
      'access-control-allow-credentials': 'true',
      'access-control-allow-methods': 'GET, PATCH, OPTIONS',
      'access-control-allow-headers': 'content-type',
    };
    const auth = url.pathname.endsWith('/auth/me');
    const diagramList = /^\/(?:api\/)?diagrams$/.test(url.pathname);
    const localLibraryRead = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
      && ['/node-library/sections', '/object-library/objects'].includes(url.pathname);
    const templateRead = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && url.pathname === '/templates';
    const diagramKey = url.pathname.endsWith(`/diagrams/${fixtureId}`) ? 'diagram'
      : url.pathname.endsWith(`/diagrams/${otherFixtureId}`) ? 'otherDiagram' : undefined;
    const thumbnailKey = url.pathname.endsWith(`/diagrams/${fixtureId}/thumbnail`) ? 'diagram'
      : url.pathname.endsWith(`/diagrams/${otherFixtureId}/thumbnail`) ? 'otherDiagram' : undefined;
    if ((auth || diagramKey || thumbnailKey || diagramList || localLibraryRead || templateRead) && method === 'OPTIONS') {
      return route.fulfill({ status: 204, headers });
    }
    // The current shared sidebar reads the signed-in user's private libraries.
    // Keep them empty in this synthetic fixture; never reach a real backend or
    // accept library mutations/asset resolution just to make the smoke pass.
    if (localLibraryRead && method === 'GET') {
      return route.fulfill({ status: 200, headers,
        json: url.pathname === '/node-library/sections' ? { sections: [] } : [] });
    }
    if (templateRead && method === 'GET') return route.fulfill({ status: 200, headers, json: [] });
    if (auth && method === 'GET') {
      return route.fulfill({ status: 200, headers, json: {
        id: 'synthetic-smoke-user', email: 'smoke@example.invalid', name: 'Smoke Test',
      } });
    }
    if (diagramList && method === 'GET') {
      return route.fulfill({ status: 200, headers, json: [state.diagram, state.otherDiagram].map((diagram) => ({
        id: diagram.id, title: diagram.title, type: diagram.type, status: diagram.status,
        updatedAt: '2026-01-01T00:00:00.000Z',
      })) });
    }
    if (diagramKey && method === 'GET') return route.fulfill({ status: 200, headers, json: state[diagramKey] });
    if (thumbnailKey && method === 'PATCH') {
      const payload = request.postDataJSON();
      assert.deepEqual(Object.keys(payload), ['image'], 'Only synthetic thumbnail images may be saved');
      assert.match(payload.image, /^data:image\/(?:png|jpeg|webp);base64,/);
      return route.fulfill({ status: 200, headers, json: { id: state[thumbnailKey].id } });
    }
    if (diagramKey && method === 'PATCH') {
      const payload = request.postDataJSON();
      assert(payload?.data?.pages, 'PATCH must contain editor state');
      const expectedPageIds = diagramKey === 'diagram'
        ? [firstPageId, secondPageId, emptyPageId] : ['smoke-other-page'];
      const expectedTitle = diagramKey === 'diagram' ? '3D smoke fixture' : 'Other 3D smoke document';
      if (payload.title !== expectedTitle || payload.data.pages.some((page) => !expectedPageIds.includes(page.id))) {
        state.ownershipViolations.push({ id: state[diagramKey].id, title: payload.title,
          pages: payload.data.pages.map((page) => page.id) });
      }
      state.patches.push(structuredClone(payload));
      state.patchRecords.push({ id: state[diagramKey].id, payload: structuredClone(payload) });
      state[diagramKey] = { ...state[diagramKey], ...structuredClone(payload) };
      return route.fulfill({ status: 200, headers, json: state[diagramKey] });
    }
    // The Next development overlay resolves stack traces through a read-only
    // POST. This exact local diagnostic is not an application/backend write.
    if (url.origin === baseUrl.origin && method === 'POST'
      && url.pathname === '/__nextjs_original-stack-frames') return route.continue();
    // Only frontend documents/assets may reach the local server. All other
    // endpoints (including localhost backend mutations) are denied by default.
    if (url.origin === baseUrl.origin && ['GET', 'HEAD'].includes(method)
      && !/^\/(?:api|auth|diagrams)(?:\/|$)/.test(url.pathname)) return route.continue();
    const blockedRequest = `${method} ${url.origin}${url.pathname}`;
    state.blocked.push(blockedRequest);
    console.error(`BLOCKED unexpected request: ${blockedRequest}`);
    return route.abort('blockedbyclient');
  });
  if (noWebGL) {
    await context.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
        return /^(?:webgl2?|experimental-webgl)$/.test(kind) ? null : original.call(this, kind, ...args);
      };
    });
  }
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
    if (message.type() === 'warning' && /SVGLoader|mergeGeometries|THREE\.(?:BufferGeometry|Color)/.test(message.text())) {
      errors.push(message.text());
    }
  });
  page.on('dialog', (dialog) => dialog.accept());
  page.setDefaultTimeout(30_000);
  return { context, page, state, errors };
}

async function until(predicate, message, timeout = 30_000) {
  const end = Date.now() + timeout;
  let lastError;
  while (Date.now() < end) {
    try { if (await predicate()) return; } catch (error) { lastError = error; }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`${message}${lastError ? `: ${lastError.message}` : ''}`);
}

function graph(document) {
  return document.pages.map((page) => ({
    id: page.id, name: page.name,
    nodes: page.nodes.map(({ measured, selected, dragging, resizing, ...node }) => node),
    edges: page.edges.map(({ selected, ...edge }) => edge),
  }));
}
function cameraFor(state, pageId = firstPageId) {
  return state.diagram.data.pages.find((page) => page.id === pageId)?.view3d?.camera;
}
function cameraDistance(a, b) {
  return Math.hypot(...a.position.map((value, index) => value - b.position[index]),
    ...a.target.map((value, index) => value - b.target[index]));
}
async function switchMode(page, mode) {
  await page.getByRole('group', { name: 'Diagram view', exact: true })
    .getByRole('button', { name: `${mode} view`, exact: true }).click();
}
async function assertNoInteractiveUI(page, stage) {
  const removedButtons = /interactive|^(?:Reset playback|Pause playback|Play scenario|Replay scenario|Run scenario|Step (?:back|forward) one event|Toggle event log|Add scenario|Delete scenario)$/i;
  assert.equal(await page.getByRole('button', { name: removedButtons, includeHidden: true }).count(), 0,
    `${stage}: retired Interactive toolbar, authoring, playback or demo button is still mounted`);
  assert.equal(await page.getByRole('link', { name: /interactive/i, includeHidden: true }).count(), 0,
    `${stage}: retired Interactive navigation link is still mounted`);
  assert.equal(await page.locator([
    '[aria-label="Interactive authoring"]', '[aria-label="Interactive playback"]',
    '[aria-label="Interactive diagram validation"]', '[aria-label="Playback controls"]',
    '#interactive-scenario', '#authoring-scenario',
  ].join(',')).count(), 0, `${stage}: retired Interactive panel or scenario selector is still mounted`);
}
async function waitFor3D(page) {
  const scene = page.getByLabel('3D diagram', { exact: true });
  await scene.waitFor({ state: 'visible' });
  await scene.locator('canvas').waitFor({ state: 'visible', timeout: 60_000 });
  await until(async () => scene.locator('canvas').evaluate((canvas) => canvas.width > 0 && canvas.height > 0),
    '3D canvas never acquired a drawable size');
  await until(async () => {
    const canvas = scene.locator('canvas');
    return !!(await canvas.getAttribute('data-camera-position')) && !!(await canvas.getAttribute('data-camera-target'));
  }, '3D camera controls did not finish initializing');
  await until(async () => await scene.locator('[data-scene-node]').count() === Number(await scene.getAttribute('data-node-count')),
    '3D scene diagnostics did not match the rendered node count');
  await assertNoInteractiveUI(page, '3D editor');
  return scene;
}
async function orbit(page, scene, dx = 110, dy = 45) {
  const orbitTool = page.getByRole('button', { name: 'Orbit', exact: true }).filter({ visible: true });
  if (await orbitTool.count()) await orbitTool.click();
  const box = await scene.locator('canvas').boundingBox();
  assert(box, 'Missing 3D canvas bounds');
  const x = box.x + box.width * 0.7;
  const y = box.y + box.height * 0.7;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 14 });
  await page.mouse.up();
}

function savedPage(state, id = firstPageId) {
  return state.diagram.data.pages.find((page) => page.id === id);
}
function savedNode(state, id = 'smoke-user') {
  return savedPage(state).nodes.find((node) => node.id === id);
}
async function saveNow(page, state) {
  const count = state.patches.length;
  await page.keyboard.press('Control+s');
  await until(() => state.patches.length > count, 'Explicit save did not finish');
}
async function inputValue(page, name, value) {
  const input = page.getByLabel(name, { exact: true }).filter({ visible: true });
  await input.fill(String(value));
  await input.press('Tab');
}
async function select3DNode(scene, id, modifiers) {
  const selecting = await scene.page().getByRole('button', { name: 'Select', exact: true }).filter({ visible: true })
    .getAttribute('aria-pressed');
  const reconnecting = await scene.getByRole('status').filter({ hasText: 'Choose the new' }).count();
  await click3DNode(scene, id, { modifiers });
  if (selecting === 'true' && !reconnecting) {
    await until(async () => await sceneNode(scene, id).getAttribute('data-node-selected') === 'true',
      `Pointer click did not select the actual mesh ${id}`);
  }
}
async function edit3DLabel(scene, id, label) {
  await click3DNode(scene, id, { double: true });
  const input = scene.getByRole('textbox', { name: 'Edit object label', exact: true });
  await input.fill(label);
  await input.press('Enter');
  await input.waitFor({ state: 'detached' });
}
function sceneNode(scene, id) {
  return scene.locator(`[data-scene-node="${id}"]`);
}
async function click3DNode(scene, id, { modifiers, double = false } = {}) {
  const page = scene.page();
  // Shared style chrome overlays the viewport; close it using the normal UI so
  // the mesh, rather than an unrelated panel, receives the pointer event.
  const hideStyle = page.getByRole('button', { name: 'Hide style panel', exact: true }).filter({ visible: true });
  if (await hideStyle.count()) await hideStyle.click();
  // Closing shared chrome can resize/refit the actual R3F viewport. Project
  // the pointer only after React's layout and the demanded WebGL frame agree.
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const diagnostic = sceneNode(scene, id);
  await diagnostic.waitFor({ state: 'attached' });
  const type = await diagnostic.getAttribute('data-node-type');
  // Catalog SVG bodies stop near local Y=.4; the label plane at .5 is not
  // raycastable. Aim inside their real volume so elevated/tilted shapes do not
  // miss merely because a point above the mesh was projected onto the screen.
  const local = type === 'group' ? await visibleGroupCorner(scene, id) : [-0.16, 0.35, 0.12];
  const point = await projectedNodePoint(scene, id, local);
  const canvas = scene.locator('canvas');
  const box = await canvas.boundingBox();
  assert(box && point.x > box.x && point.x < box.x + box.width && point.y > box.y && point.y < box.y + box.height,
    `Mesh ${id} is outside the viewport`);
  const options = { position: { x: point.x - box.x, y: point.y - box.y }, ...(modifiers ? { modifiers } : {}) };
  if (double) await canvas.dblclick(options);
  else await canvas.click(options);
}
// A group is a thin plate under its children, and a click on a child rightly
// picks the child. Children stand on the plate, so they only hide plate area
// behind them: aim at the plate corner nearest the camera, inside the padding
// strip that grouping leaves around its children.
async function visibleGroupCorner(scene, id) {
  const camera = JSON.parse(await scene.locator('canvas').getAttribute('data-camera-position'));
  let nearest;
  let nearestDistance = Infinity;
  for (const [sx, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
    const local = [sx * 0.46, 0.5, sz * 0.46];
    const world = await nodeWorldPoint(scene, id, local);
    const distance = Math.hypot(...world.map((value, index) => value - camera[index]));
    if (distance < nearestDistance) [nearest, nearestDistance] = [local, distance];
  }
  return nearest;
}
async function projectedNodeCenter(scene, id) {
  return projectedNodePoint(scene, id, [0, 0, 0]);
}
async function projectedNodePoint(scene, id, local = [0, 0, 0]) {
  return projectWorldPoint(scene, await nodeWorldPoint(scene, id, local));
}
async function nodeWorldPoint(scene, id, local) {
  const diagnostic = sceneNode(scene, id);
  const origin = JSON.parse(await diagnostic.getAttribute('data-node-position'));
  const size = JSON.parse(await diagnostic.getAttribute('data-node-size'));
  const rotation = JSON.parse(await diagnostic.getAttribute('data-node-rotation'));
  assert(Array.isArray(origin) && Array.isArray(size) && Array.isArray(rotation),
    `Renderer did not expose geometry for mesh ${id}`);
  // Three's default Euler XYZ applies local Z, then Y, then X to the vector.
  let [x, y, z] = local.map((value, index) => value * size[index]);
  const [rx, ry, rz] = rotation;
  [x, y] = [x * Math.cos(rz) - y * Math.sin(rz), x * Math.sin(rz) + y * Math.cos(rz)];
  [x, z] = [x * Math.cos(ry) + z * Math.sin(ry), -x * Math.sin(ry) + z * Math.cos(ry)];
  [y, z] = [y * Math.cos(rx) - z * Math.sin(rx), y * Math.sin(rx) + z * Math.cos(rx)];
  const position = [origin[0] + x, origin[1] + y, origin[2] + z];
  // Diagnostics intentionally keep the editable graph's local coordinates.
  // Upright rotates the entire scene, including edges and label surfaces.
  return await scene.getAttribute('data-orientation') === 'upright'
    ? [position[0], -position[2], position[1]] : position;
}
async function projectWorldPoint(scene, point) {
  const canvas = scene.locator('canvas');
  const box = await canvas.boundingBox();
  const position = JSON.parse(await canvas.getAttribute('data-camera-position'));
  const target = JSON.parse(await canvas.getAttribute('data-camera-target'));
  assert(box && Array.isArray(point), 'Renderer did not expose actual node position for pointer regression');
  const subtract = (a, b) => a.map((value, index) => value - b[index]);
  const dot = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const normalize = (vector) => vector.map((value) => value / Math.hypot(...vector));
  const forward = normalize(subtract(target, position));
  const right = normalize(cross(forward, [0, 1, 0]));
  const up = cross(right, forward);
  const offset = subtract(point, position);
  const depth = dot(offset, forward);
  assert(depth > 0, 'Selected object is behind the camera');
  const tangent = Math.tan(Math.PI / 8); // Renderer perspective camera uses a 45-degree field of view.
  return {
    x: box.x + box.width / 2 * (1 + dot(offset, right) / (depth * tangent * box.width / box.height)),
    y: box.y + box.height / 2 * (1 - dot(offset, up) / (depth * tangent)),
  };
}
async function assertNoFloatingNodeLabels(scene) {
  assert.equal(await scene.locator('button[data-node-id]').count(), 0, 'Persistent floating node label cards remain');
  assert.equal(await scene.getByRole('textbox', { name: 'Edit object label', exact: true }).count(), 0,
    'A node label editor remains mounted outside an editing gesture');
  assert(await scene.locator('[data-scene-node]').evaluateAll((nodes) => nodes.every((node) => node.getClientRects().length === 0)),
    'Noninteractive scene diagnostics must not create visible cards');
}
async function clear3DSelection(scene) {
  const hideStyle = scene.page().getByRole('button', { name: 'Hide style panel', exact: true }).filter({ visible: true });
  if (await hideStyle.count()) await hideStyle.click();
  const canvas = scene.locator('canvas');
  const bounds = await canvas.boundingBox();
  await canvas.click({ position: { x: bounds.width * 0.92, y: bounds.height * 0.89 } });
  await until(async () => await scene.locator('[data-scene-node][data-node-selected="true"]').count() === 0,
    'Blank canvas click did not clear mesh selection');
  await scene.page().evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function captureNodeSurfacePixels(scene, id) {
  const canvas = scene.locator('canvas');
  const bounds = await canvas.boundingBox();
  const corners = await Promise.all([
    [-0.42, 0.501, -0.42], [0.42, 0.501, -0.42], [-0.42, 0.501, 0.42], [0.42, 0.501, 0.42],
  ].map((point) => projectedNodePoint(scene, id, point)));
  const minX = Math.min(...corners.map((point) => point.x)) - bounds.x;
  const minY = Math.min(...corners.map((point) => point.y)) - bounds.y;
  const maxX = Math.max(...corners.map((point) => point.x)) - bounds.x;
  const maxY = Math.max(...corners.map((point) => point.y)) - bounds.y;
  return canvas.evaluateHandle((source, css) => {
    const scaleX = source.width / source.getBoundingClientRect().width;
    const scaleY = source.height / source.getBoundingClientRect().height;
    const x = Math.max(0, Math.floor(css.minX * scaleX));
    const y = Math.max(0, Math.floor(css.minY * scaleY));
    const width = Math.min(source.width - x, Math.ceil((css.maxX - css.minX) * scaleX));
    const height = Math.min(source.height - y, Math.ceil((css.maxY - css.minY) * scaleY));
    if (width < 8 || height < 8) throw new Error('Node surface is too small for the canvas pixel assertion');
    const scratch = document.createElement('canvas');
    scratch.width = width; scratch.height = height;
    const context = scratch.getContext('2d');
    context.drawImage(source, x, y, width, height, 0, 0, width, height);
    return { x, y, width, height, rgba: context.getImageData(0, 0, width, height).data };
  }, { minX, minY, maxX, maxY });
}
async function changedSurfacePixels(scene, snapshot) {
  return scene.locator('canvas').evaluate((source, baseline) => {
    const { x, y, width, height, rgba } = baseline;
    const scratch = document.createElement('canvas');
    scratch.width = width; scratch.height = height;
    const context = scratch.getContext('2d');
    context.drawImage(source, x, y, width, height, 0, 0, width, height);
    const current = context.getImageData(0, 0, width, height).data;
    let changed = 0;
    for (let index = 0; index < current.length; index += 4) {
      if (Math.max(Math.abs(current[index] - rgba[index]), Math.abs(current[index + 1] - rgba[index + 1]),
        Math.abs(current[index + 2] - rgba[index + 2])) > 12) changed++;
    }
    return changed;
  }, snapshot);
}
async function downloadBytes(page, trigger) {
  const pending = page.waitForEvent('download');
  await trigger();
  const download = await pending;
  assert.equal(await download.failure(), null, 'Export download failed');
  const filename = download.suggestedFilename();
  return { filename, bytes: await readFile(await download.path()) };
}

async function artworkPixel(scene, id, u, v) {
  const canvas = scene.locator('canvas');
  const box = await canvas.boundingBox();
  const point = await projectedNodePoint(scene, id, [u - 0.5, 0, v - 0.5]);
  assert(box && point.x > box.x && point.x < box.x + box.width && point.y > box.y && point.y < box.y + box.height,
    `Artwork sample ${id} is outside the viewport`);
  return canvas.evaluate((source, position) => {
    const bounds = source.getBoundingClientRect();
    const x = Math.round(position.x * source.width / bounds.width);
    const y = Math.round(position.y * source.height / bounds.height);
    const scratch = document.createElement('canvas');
    scratch.width = 1; scratch.height = 1;
    const context = scratch.getContext('2d');
    context.drawImage(source, x, y, 1, 1, 0, 0, 1, 1);
    return Array.from(context.getImageData(0, 0, 1, 1).data);
  }, { x: point.x - box.x, y: point.y - box.y });
}

async function surfaceDarkPixels(scene, id) {
  const snapshot = await captureNodeSurfacePixels(scene, id);
  try {
    return await snapshot.evaluate(({ rgba }) => {
      let dark = 0;
      for (let index = 0; index < rgba.length; index += 4) {
        if (rgba[index] < 65 && rgba[index + 1] < 65 && rgba[index + 2] < 65 && rgba[index + 3] > 200) dark++;
      }
      return dark;
    });
  } finally { await snapshot.dispose(); }
}

async function runFlatArtworkChecks({ context, page, state, errors }) {
  const originalNodes = structuredClone(state.diagram.data.pages[0].nodes);
  await page.goto(new URL(`/editor/${fixtureId}`, baseUrl).href, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  const in2D = (id) => page.locator(`.react-flow__node[data-id="${id}"]`);
  await in2D('artwork-filled').waitFor({ state: 'visible' });
  await until(async () => await in2D('artwork-source').locator('[data-source-image-state]').getAttribute('data-source-image-state') === 'ready',
    'Real 2D source image component did not decode the fixture PNG');
  assert.equal(await in2D('artwork-filled').locator('[data-vector-state="ready"]').count(), 1,
    'Main editor used a fallback instead of the vector renderer');
  assert.equal(await in2D('artwork-curve').locator('[data-vector-path]').getAttribute('stroke'), '#1c3edd');
  assert.match(await in2D('artwork-curve').locator('[data-vector-path]').getAttribute('d'), /Q/,
    'Main editor discarded the quadratic curve');
  for (const attribute of ['marker-start', 'marker-end']) {
    assert.match(await in2D('artwork-curve').locator('[data-vector-path]').getAttribute(attribute), /^url\(#/,
      `Main editor dropped ${attribute}`);
  }
  for (const source of originalNodes.filter((item) => item.type !== 'TextNode')) {
    assert.equal(await in2D(source.id).locator('input,textarea,[contenteditable="true"]').count(), 0,
      'Semantic artwork name created an unwanted text editor');
    assert.equal(await in2D(source.id).getByText(source.data.label, { exact: true }).filter({ visible: true }).count(), 0,
      'Semantic artwork name was painted as duplicate visible 2D text');
  }
  await saveNow(page, state);
  for (const source of originalNodes) {
    const saved = savedNode(state, source.id);
    assert.deepEqual(saved.data, source.data, `Opening 2D changed artwork payload ${source.id}`);
    assert.equal(saved.width, source.width); assert.equal(saved.height, source.height);
  }
  const originalGraph = structuredClone(graph(state.diagram.data));
  await page.screenshot({ path: path.join(outputDir, '12-flat-artwork-2d.png') });

  await switchMode(page, '3D');
  const scene = await waitFor3D(page);
  const hideStyle = page.getByRole('button', { name: 'Hide style panel', exact: true }).filter({ visible: true });
  if (await hideStyle.count()) await hideStyle.click();
  await scene.getByRole('group', { name: '3D camera views', exact: true }).getByRole('button', { name: 'Top', exact: true }).click();
  await until(async () => {
    const position = JSON.parse(await scene.locator('canvas').getAttribute('data-camera-position'));
    const target = JSON.parse(await scene.locator('canvas').getAttribute('data-camera-target'));
    return Math.abs(position[0] - target[0]) < 0.01 && position[1] - target[1] > 1;
  }, 'Flat artwork test could not establish the top camera');
  await assertNoFloatingNodeLabels(scene);
  assert.equal(await scene.getAttribute('data-node-count'), '5');
  for (const source of originalNodes.filter((item) => item.type !== 'TextNode')) {
    assert.equal(await sceneNode(scene, source.id).getAttribute('data-node-type'), source.type);
    const size = JSON.parse(await sceneNode(scene, source.id).getAttribute('data-node-size'));
    assert.deepEqual(size, [source.width / 100, source.type === 'VectorPathNode' ? 0.08 : 0.02, source.height / 100],
      `${source.id} acquired a fallback box, inferred depth or a widened 1 px axis`);
    assert.equal(await scene.getByText(source.data.label, { exact: true }).filter({ visible: true }).count(), 0,
      'Semantic artwork name created a duplicate floating 3D caption');
  }

  // This follows the normal export controller, which waits for the source PNG
  // decoding state registered on the actual Three objects before capturing.
  const exported = await downloadBytes(page, async () => {
    await page.getByRole('button', { name: 'Export diagram', exact: true }).filter({ visible: true }).click();
    await page.getByRole('menu', { name: 'Export diagram', exact: true })
      .getByRole('menuitem', { name: /^PNG/ }).click();
  });
  assert(exported.bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')), 'Flat artwork PNG export is invalid');
  const exportedColors = await page.evaluate(async ({ encoded, colors }) => {
    const image = new Image();
    image.src = `data:image/png;base64,${encoded}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    return colors.map((color) => {
      let count = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        if (color.every((value, channel) => Math.abs(value - pixels[index + channel]) < 20) && pixels[index + 3] > 200) count++;
      }
      return count;
    });
  }, { encoded: exported.bytes.toString('base64'), colors: artworkColors });
  assert(exportedColors.every((count) => count > 100),
    `3D export omitted decoded source colors or captured a fallback: ${exportedColors}`);

  const near = (actual, expected) => expected.every((value, index) => Math.abs(value - actual[index]) < 20) && actual[3] > 200;
  for (const [index, [u, v]] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]].entries()) {
    let actual;
    await until(async () => near(actual = await artworkPixel(scene, 'artwork-source', u, v), artworkColors[index]),
      `Source PNG quadrant ${index} is missing or mirrored in the real WebGL canvas`);
  }
  const filledPixel = await artworkPixel(scene, 'artwork-filled', 0.25, 0.25);
  assert(filledPixel[1] > filledPixel[0] * 1.4 && filledPixel[1] > filledPixel[2] * 1.1 && filledPixel[1] > 70 && filledPixel[3] > 200,
    `Lit green vector fill is missing from the actual WebGL surface: ${filledPixel}`);
  const curvePixel = await artworkPixel(scene, 'artwork-curve', 0.5, 0.5);
  assert(curvePixel[2] > curvePixel[0] * 1.4 && curvePixel[2] > curvePixel[1] * 1.3 && curvePixel[2] > 70 && curvePixel[3] > 200,
    `Lit blue quadratic vector stroke disappeared or changed orientation: ${curvePixel}`);
  assert(await surfaceDarkPixels(scene, 'artwork-filled') < 3,
    'A duplicate semantic label was painted into the vector surface');
  assert(await surfaceDarkPixels(scene, 'artwork-source') < 3,
    'A duplicate semantic label was painted over the source PNG');
  assert(await surfaceDarkPixels(scene, 'artwork-text') > 10,
    'Separate recognized TextNode was lost while suppressing semantic artwork labels');
  assert.equal(await scene.getByText(/Artwork unavailable|Loading source image/).filter({ visible: true }).count(), 0,
    'Source artwork remains loading or invalid after successful export');
  await page.screenshot({ path: path.join(outputDir, '13-flat-artwork-3d-top.png') });
  await scene.getByRole('group', { name: '3D camera views', exact: true }).getByRole('button', { name: 'Isometric', exact: true }).click();
  await page.screenshot({ path: path.join(outputDir, '14-flat-artwork-3d-isometric.png') });
  await switchMode(page, '2D');
  await in2D('artwork-filled').waitFor({ state: 'visible' });
  await until(async () => await in2D('artwork-source').locator('[data-source-image-state]').getAttribute('data-source-image-state') === 'ready',
    'Returning to 2D lost the decoded source PNG');
  await saveNow(page, state);
  assert.deepEqual(graph(state.diagram.data), originalGraph, 'Viewing/exporting flat artwork changed source graph or geometry');
  assert.equal(await in2D('artwork-source').locator('img').getAttribute('src'), originalNodes[1].data.image.dataUrl,
    '2D→3D→2D changed the reviewed source PNG bytes');
  assert.deepEqual(errors, [], 'Flat artwork produced browser, image decode or WebGL errors');
  assert.deepEqual(state.ownershipViolations, [], 'Flat artwork autosave crossed document ownership');
  assert.deepEqual(state.blocked, [], 'Flat artwork attempted remote assets or unexpected APIs');
  await context.close();
  console.log('PASS main-editor 2D→3D→2D flat vectors/PNG: real surface pixels, orientation, no duplicate labels, 1 px axes, export readiness and unchanged graph');
}

async function canvasFingerprint(scene) {
  return scene.locator('canvas').evaluate((source) => {
    const copy = document.createElement('canvas'); copy.width = source.width; copy.height = source.height;
    const context = copy.getContext('2d'); context.drawImage(source, 0, 0);
    const pixels = context.getImageData(0, 0, copy.width, copy.height).data;
    let hash = 2166136261;
    for (let i = 0; i < pixels.length; i += 4) hash = Math.imul(hash ^ pixels[i] ^ (pixels[i + 1] << 8) ^ (pixels[i + 2] << 16), 16777619);
    return hash >>> 0;
  });
}

async function runSpatialArtworkChecks({ context, page, state, errors }) {
  await page.goto(new URL(`/editor/${fixtureId}`, baseUrl).href, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.locator('.react-flow__node[data-id="spatial-entity"]').waitFor();
  await saveNow(page, state);
  const originalGraph = structuredClone(graph(state.diagram.data));
  const originalImage = savedNode(state, 'artwork-source').data.image.dataUrl;
  await switchMode(page, '3D');
  let scene = await waitFor3D(page);
  const button = (name) => scene.getByRole('button', { name, exact: true });
  const views = () => scene.getByRole('group', { name: '3D camera views', exact: true });
  const camera = async () => ({ position: JSON.parse(await scene.locator('canvas').getAttribute('data-camera-position')),
    target: JSON.parse(await scene.locator('canvas').getAttribute('data-camera-target')) });
  const localNodes = async () => scene.locator('[data-scene-node]').evaluateAll((nodes) => nodes.map((node) => ({
    id: node.dataset.sceneNode, position: node.dataset.nodePosition, rotation: node.dataset.nodeRotation,
    size: node.dataset.nodeSize, label: node.dataset.nodeLabel,
  })));
  assert.equal(await scene.getAttribute('data-orientation'), 'floor', 'Legacy editor diagrams must default to the floor');
  assert.equal(await button('Floor').getAttribute('aria-pressed'), 'true');
  assert.equal(await button('Grid').getAttribute('aria-pressed'), 'true');
  const originalLocalNodes = await localNodes();
  const floorWithGrid = await canvasFingerprint(scene), floorCamera = await camera();
  await button('Grid').click();
  await until(async () => await scene.getAttribute('data-show-grid') === 'false', 'Grid toggle did not affect scene');
  await until(async () => await canvasFingerprint(scene) !== floorWithGrid, 'Grid toggle did not affect actual WebGL pixels');
  assert(cameraDistance(floorCamera, await camera()) < 0.0001, 'Grid toggle changed the review camera');
  await page.screenshot({ path: path.join(outputDir, '15-spatial-floor.png') });
  const floorWithoutGrid = await canvasFingerprint(scene);
  await button('Upright').click();
  await until(async () => await scene.getAttribute('data-orientation') === 'upright', 'Upright orientation did not activate');
  assert.equal(await button('Upright').getAttribute('aria-pressed'), 'true');
  assert.equal(await button('Floor').getAttribute('aria-pressed'), 'false');
  assert.deepEqual(await localNodes(), originalLocalNodes, 'Whole-scene orientation rewrote local objects, labels or rotations');
  await until(async () => await canvasFingerprint(scene) !== floorWithoutGrid, 'Upright orientation did not change real rendering');
  await views().getByRole('button', { name: 'Front', exact: true }).click();
  await until(async () => { const current = await camera(); return Math.abs(current.position[1] - current.target[1]) < 0.01
    && current.position[2] - current.target[2] > 1; }, 'Could not review upright diagram from the front');
  for (const [index, [u, v]] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]].entries()) {
    await until(async () => {
      const actual = await artworkPixel(scene, 'artwork-source', u, v);
      return artworkColors[index].every((value, channel) => Math.abs(actual[channel] - value) < 20) && actual[3] > 200;
    }, `Upright source PNG quadrant ${index} is missing or mirrored`);
  }
  await assertNoFloatingNodeLabels(scene);
  assert.equal(await scene.getAttribute('data-edge-count'), '1');
  await page.screenshot({ path: path.join(outputDir, '16-spatial-upright-front.png') });
  await views().getByRole('button', { name: 'Isometric', exact: true }).click();
  await page.screenshot({ path: path.join(outputDir, '17-spatial-upright-isometric.png') });
  const beforeOrbit = await camera();
  await orbit(page, scene, 60, 30);
  await until(async () => cameraDistance(beforeOrbit, await camera()) > 0.05, 'Upright scene cannot be orbited');
  await saveNow(page, state);
  assert.deepEqual(graph(state.diagram.data), originalGraph, 'Orientation/grid/camera controls mutated the editable graph');
  assert.equal(savedPage(state).view3d.orientation, 'upright');
  assert.equal(savedPage(state).view3d.showGrid, false);
  console.log('PASS spatial vectors/images/text/entity/edge; whole-scene Floor/Upright/Grid affect actual pixels, not the graph');

  await views().getByRole('button', { name: 'Front', exact: true }).click();
  await page.getByRole('button', { name: 'Select', exact: true }).filter({ visible: true }).click();
  const hideStyle = page.getByRole('button', { name: 'Hide style panel', exact: true }).filter({ visible: true });
  if (await hideStyle.count()) await hideStyle.click();
  const beforeDrag = structuredClone(savedNode(state, 'spatial-entity').position), beforeDragCamera = await camera();
  const center = await projectedNodePoint(scene, 'spatial-entity', [0, 0.5, 0]);
  await page.mouse.move(center.x, center.y); await page.mouse.down();
  await page.mouse.move(center.x + 45, center.y + 25, { steps: 12 }); await page.mouse.up();
  await until(() => Math.hypot(savedNode(state, 'spatial-entity').position.x - beforeDrag.x,
    savedNode(state, 'spatial-entity').position.y - beforeDrag.y) > 5, 'Dragging upright geometry did not update the shared 2D position');
  assert(cameraDistance(beforeDragCamera, await camera()) < 0.0001, 'Dragging upright object also orbited the camera');
  await page.keyboard.press('Control+z');
  await until(() => Math.hypot(savedNode(state, 'spatial-entity').position.x - beforeDrag.x,
    savedNode(state, 'spatial-entity').position.y - beforeDrag.y) < 0.01, 'One undo did not reverse the upright pointer gesture');
  await edit3DLabel(scene, 'spatial-entity', 'Edited upright entity');
  await until(() => savedNode(state, 'spatial-entity').data.label === 'Edited upright entity', 'Upright mesh label edit did not save');
  await switchMode(page, '2D');
  const entity = page.locator('.react-flow__node[data-id="spatial-entity"]');
  await entity.waitFor({ state: 'visible' });
  assert.equal(await entity.locator('input').first().inputValue(), 'Edited upright entity');
  assert.equal(await page.locator('.react-flow__edge').count(), 1);
  assert.equal(await page.locator('.react-flow__node[data-id="artwork-source"] img').getAttribute('src'), originalImage);
  await saveNow(page, state);
  const expectedGraph = structuredClone(originalGraph);
  expectedGraph[0].nodes.find((node) => node.id === 'spatial-entity').data.label = 'Edited upright entity';
  assert.deepEqual(graph(state.diagram.data), expectedGraph, 'Upright editing changed unrelated vectors, PNG, edge or 2D layout');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('.react-flow__node[data-id="spatial-entity"]').waitFor();
  await switchMode(page, '3D'); scene = await waitFor3D(page);
  assert.equal(await button('Upright').getAttribute('aria-pressed'), 'true', 'Reload forgot per-page scene orientation');
  assert.equal(await button('Grid').getAttribute('aria-pressed'), 'false', 'Reload forgot per-page grid preference');
  assert.equal(await sceneNode(scene, 'spatial-entity').getAttribute('data-node-label'), 'Edited upright entity');
  assert.equal(savedNode(state, 'artwork-source').data.image.dataUrl, originalImage);
  assert.deepEqual(errors, [], 'Upright scene caused browser or WebGL errors');
  assert.deepEqual(state.ownershipViolations, []);
  assert.deepEqual(state.blocked, []);
  await context.close();
  console.log('PASS upright pointer dragging/atomic undo, printed-label editing, shared 2D edges and per-page orientation/grid save/reload');
}

async function runReviewedArtworkChecks({ context, page, state, errors }) {
  await page.goto(new URL(`/editor/${fixtureId}`, baseUrl).href, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.locator('.react-flow__node').first().waitFor();
  await saveNow(page, state);
  const originalGraph = structuredClone(graph(state.diagram.data));
  await switchMode(page, '3D');
  const scene = await waitFor3D(page);
  await scene.getByRole('button', { name: 'Upright', exact: true }).click();
  if (await scene.getByRole('button', { name: 'Grid', exact: true }).getAttribute('aria-pressed') === 'true')
    await scene.getByRole('button', { name: 'Grid', exact: true }).click();
  const views = scene.getByRole('group', { name: '3D camera views', exact: true });
  for (const source of savedPage(state).nodes) {
    assert.equal(await sceneNode(scene, source.id).getAttribute('data-node-type'), source.type, 'Generic scene inferred another object type');
    if (source.type === 'VectorPathNode') assert(JSON.parse(await sceneNode(scene, source.id).getAttribute('data-node-size'))[1] > 0.02,
      'Reviewed vector remains a flat texture instead of having authored drawing depth');
  }
  await views.getByRole('button', { name: 'Front', exact: true }).click();
  await page.screenshot({ path: path.join(outputDir, '18-reviewed-upright-front.png') });
  await views.getByRole('button', { name: 'Isometric', exact: true }).click();
  await page.screenshot({ path: path.join(outputDir, '19-reviewed-upright-isometric.png') });
  await orbit(page, scene, 155, 40);
  await page.screenshot({ path: path.join(outputDir, '20-reviewed-upright-orbit.png') });
  await switchMode(page, '2D'); await page.locator('.react-flow__node').first().waitFor(); await saveNow(page, state);
  assert.deepEqual(graph(state.diagram.data), originalGraph, 'Reviewing an existing document mutated its actual drawing');
  assert.deepEqual(errors, []); assert.deepEqual(state.blocked, []); assert.deepEqual(state.ownershipViolations, []);
  await context.close();
  console.log('PASS explicit local reviewed document renders through the same generic spatial path with unchanged graph');
}

async function runEditable3DChecks({ context, page, state, errors }) {
  await page.goto(new URL(`/editor/${fixtureId}`, baseUrl).href);
  await page.locator('.react-flow__node[data-id="smoke-user"]').waitFor();
  await assertNoInteractiveUI(page, '2D editor before shared editing');
  await saveNow(page, state);
  await switchMode(page, '3D');
  let scene = await waitFor3D(page);

  await edit3DLabel(scene, 'smoke-user', 'Editable Web App');
  await until(() => savedNode(state)?.data.label === 'Editable Web App', '3D label edit did not save');
  await select3DNode(scene, 'smoke-user');
  await page.getByRole('button', { name: 'Bold', exact: true }).filter({ visible: true }).click();
  await until(() => savedNode(state)?.data.bold === true, '3D shared toolbar did not apply bold');
  await page.keyboard.press('Control+z');
  await until(() => savedNode(state)?.data.bold !== true, '3D Ctrl+Z did not undo shared style');
  await page.keyboard.press('Control+y');
  await until(() => savedNode(state)?.data.bold === true, '3D Ctrl+Y did not redo shared style');
  console.log('PASS editable 3D selection, inline label, shared text style and undo/redo');

  const showStyle = page.getByRole('button', { name: 'Show style panel', exact: true });
  if (await showStyle.isVisible()) await showStyle.click();
  await page.getByRole('tab', { name: 'Style', exact: true }).filter({ visible: true }).click();
  await page.getByRole('button', { name: 'Fill #0E7E63', exact: true }).filter({ visible: true }).click();
  await until(() => savedNode(state)?.data.fillColor?.toLowerCase() === '#0e7e63', '3D shape style panel did not update shared fill');
  await page.getByRole('tab', { name: 'Arrange', exact: true }).filter({ visible: true }).click();
  await inputValue(page, 'X', 125);
  await inputValue(page, 'Y', 155);
  await inputValue(page, 'W', 185);
  await inputValue(page, 'H', 110);
  await inputValue(page, 'Rotation degrees', 30);
  await until(() => {
    const node = savedNode(state);
    return node.position.x === 125 && node.position.y === 155
      && node.width === 185 && node.height === 110 && node.data.rotation === 30;
  }, '3D arrange did not persist shared position, size and rotation');

  await page.getByRole('tab', { name: '3D', exact: true }).filter({ visible: true }).click();
  await inputValue(page, 'Elevation', 1.25);
  await inputValue(page, 'Depth', 1.5);
  await inputValue(page, 'Tilt X', 15);
  await inputValue(page, 'Tilt Z', 20);
  await until(() => {
    const spatial = savedNode(state)?.data.spatial3d;
    return spatial?.elevation === 1.25 && spatial?.depth === 1.5
      && Math.abs(spatial.rotationX - Math.PI / 12) < 0.0001
      && Math.abs(spatial.rotationZ - Math.PI / 9) < 0.0001;
  }, '3D elevation/depth/tilt did not save in world units/radians');
  const transform = structuredClone(savedNode(state).data.spatial3d);
  const sharedGeometry = { position: { x: 125, y: 155 }, width: 185, height: 110, rotation: 30 };
  await page.getByRole('button', { name: 'Lock object', exact: true }).click();
  await until(() => savedNode(state)?.data.locked === true, '3D object lock did not persist');
  await page.keyboard.press('Delete');
  await page.keyboard.press('Control+b');
  await saveNow(page, state);
  assert(savedNode(state), 'Locked 3D object was deleted');
  assert.equal(savedNode(state).data.bold, true, 'Locked 3D object accepted text-style mutation');
  await page.getByRole('button', { name: 'Unlock object', exact: true }).click();
  await until(() => savedNode(state)?.data.locked !== true, '3D object did not unlock');
  await switchMode(page, '2D');
  const node2D = page.locator('.react-flow__node[data-id="smoke-user"]');
  await node2D.waitFor({ state: 'visible' });
  assert((await node2D.textContent()).includes('Editable Web App'), '3D label not reflected in 2D');
  assert.deepEqual(savedNode(state).position, sharedGeometry.position, '2D lost position edited in 3D');
  assert.equal(savedNode(state).width, sharedGeometry.width, '2D lost width edited in 3D');
  assert.equal(savedNode(state).height, sharedGeometry.height, '2D lost height edited in 3D');
  assert.equal(savedNode(state).data.rotation, sharedGeometry.rotation, '2D lost rotation edited in 3D');
  await switchMode(page, '3D');
  scene = await waitFor3D(page);
  console.log('PASS 3D move/resize/rotation share 2D geometry; spatial depth/elevation/tilt persist separately');

  await select3DNode(scene, 'smoke-user');
  const beforeCopy = new Set(savedPage(state).nodes.map((node) => node.id));
  await page.keyboard.press('Control+c');
  await page.keyboard.press('Control+v');
  await until(() => savedPage(state).nodes.length === beforeCopy.size + 1, '3D copy/paste did not add a node');
  const pasted = savedPage(state).nodes.find((node) => !beforeCopy.has(node.id));
  assert.equal(pasted.data.label, 'Editable Web App');
  assert.deepEqual(pasted.data.spatial3d, transform, 'Copy/paste dropped spatial properties');
  await until(async () => await sceneNode(scene, pasted.id).getAttribute('data-node-selected') === 'true',
    'Paste did not automatically select the new object');
  await page.keyboard.press('Delete');
  await until(() => !savedNode(state, pasted.id), '3D Delete did not remove pasted selection');
  await page.keyboard.press('Control+z');
  await until(() => !!savedNode(state, pasted.id), '3D undo did not restore deleted node');
  await page.keyboard.press('Control+y');
  await until(() => !savedNode(state, pasted.id), '3D redo did not reapply deletion');
  await select3DNode(scene, 'smoke-user');
  await page.keyboard.press('Control+d');
  await until(() => savedPage(state).nodes.length === beforeCopy.size + 1, '3D duplicate shortcut did not add a node');
  const duplicate = savedPage(state).nodes.find((node) => !beforeCopy.has(node.id));
  assert.deepEqual(duplicate.data.spatial3d, transform, 'Duplicate dropped spatial properties');
  await until(async () => await sceneNode(scene, duplicate.id).getAttribute('data-node-selected') === 'true',
    'Duplicate did not automatically select the new object');
  await page.keyboard.press('Delete');
  await until(() => !savedNode(state, duplicate.id), 'Could not remove duplicate');
  console.log('PASS 3D copy/paste/duplicate/delete retain spatial state and shared history');

  await select3DNode(scene, 'smoke-user');
  await select3DNode(scene, 'smoke-api', ['Shift']);
  await page.keyboard.press('Control+g');
  await until(() => savedNode(state)?.parentId && savedNode(state, 'smoke-api')?.parentId === savedNode(state).parentId,
    '3D multi-select/group did not create a shared group');
  const groupId = savedNode(state).parentId;
  await select3DNode(scene, groupId);
  await page.keyboard.press('Control+Shift+g');
  await until(() => !savedNode(state)?.parentId && !savedNode(state, 'smoke-api')?.parentId,
    '3D ungroup did not restore shared graph hierarchy');
  assert.deepEqual(savedNode(state).data.spatial3d, transform, 'Group/ungroup lost spatial properties');
  console.log('PASS 3D multi-selection grouping and ungrouping operate on the shared graph');

  const hidePanel = page.getByRole('button', { name: 'Hide style panel', exact: true });
  if (await hidePanel.isVisible()) await hidePanel.click();
  const rectanglePalette = page.getByRole('button', { name: 'Rectangle', exact: true }).filter({ visible: true });
  if (!(await rectanglePalette.count())) {
    await page.getByRole('button', { name: 'BASIC', exact: true }).filter({ visible: true }).click();
  }
  const beforePalette = new Set(savedPage(state).nodes.map((node) => node.id));
  const dropBounds = await scene.boundingBox();
  assert(dropBounds, '3D palette target has no bounds');
  await rectanglePalette.dragTo(scene, {
    targetPosition: { x: dropBounds.width * 0.4, y: dropBounds.height * 0.72 },
  });
  await until(() => savedPage(state).nodes.length === beforePalette.size + 1, 'Palette drop did not add a shape in 3D');
  const addedId = savedPage(state).nodes.find((node) => !beforePalette.has(node.id)).id;
  await edit3DLabel(scene, addedId, 'Added in 3D');
  await until(() => savedNode(state, addedId)?.data.label === 'Added in 3D', 'Palette shape not editable in 3D');
  const beforeConnect = new Set(savedPage(state).edges.map((edge) => edge.id));
  await page.getByRole('button', { name: 'Connect', exact: true }).filter({ visible: true }).click();
  await select3DNode(scene, addedId);
  await scene.getByRole('status').filter({ hasText: 'Choose the target object' }).waitFor({ state: 'visible' });
  await select3DNode(scene, 'smoke-api');
  await until(() => savedPage(state).edges.length === beforeConnect.size + 1, '3D Connect tool did not create an edge');
  const connectedEdge = savedPage(state).edges.find((edge) => !beforeConnect.has(edge.id));
  assert.equal(connectedEdge.source, addedId, 'Connect tool reversed source');
  assert.equal(connectedEdge.target, 'smoke-api', 'Connect tool used the wrong target');
  await page.getByRole('button', { name: 'Select', exact: true }).filter({ visible: true }).click();
  await scene.locator('[data-edge-id="smoke-request"]').dblclick();
  const connectionLabel = scene.getByRole('textbox', { name: 'Edit connection label', exact: true });
  await connectionLabel.fill('request edited in 3D');
  await connectionLabel.press('Enter');
  await until(() => savedPage(state).edges.find((edge) => edge.id === 'smoke-request')
    ?.data.labels.some((label) => label.text === 'request edited in 3D'), '3D inline connection label did not save');
  await scene.getByRole('button', { name: 'Reconnect target of connection smoke-request', exact: true }).click();
  await scene.getByRole('status').filter({ hasText: 'Choose the new target' }).waitFor({ state: 'visible' });
  await select3DNode(scene, addedId);
  await until(() => savedPage(state).edges.find((edge) => edge.id === 'smoke-request')?.target === addedId,
    '3D reconnect gesture did not change the target');
  await page.keyboard.press('Control+z');
  await until(() => savedPage(state).edges.find((edge) => edge.id === 'smoke-request')?.target === 'smoke-api',
    'Shared undo did not restore the previous connection target');
  await scene.locator('[data-edge-id="smoke-request"]').click();
  const showConnectionStyle = page.getByRole('button', { name: 'Show style panel', exact: true });
  if (await showConnectionStyle.isVisible()) await showConnectionStyle.click();
  const connectionStyle = page.getByLabel('Connection style', { exact: true }).filter({ visible: true });
  await connectionStyle.getByRole('button', { name: 'Curved routing', exact: true }).click();
  await connectionStyle.getByRole('button', { name: 'Increase line width', exact: true }).click();
  await until(() => {
    const edge = savedPage(state).edges.find((edge) => edge.id === 'smoke-request');
    return edge.data.routing === 'curved' && edge.data.strokeWidth > 1.5;
  }, '3D connection style panel did not persist routing/width');
  const hideConnectionStyle = page.getByRole('button', { name: 'Hide style panel', exact: true });
  if (await hideConnectionStyle.isVisible()) await hideConnectionStyle.click();
  await select3DNode(scene, 'smoke-db');
  await page.getByRole('button', { name: 'Show style panel', exact: true }).filter({ visible: true }).click();
  await page.getByRole('tab', { name: 'Fields', exact: true }).filter({ visible: true }).click();
  const fieldName = page.getByRole('textbox', { name: 'Field name', exact: true }).filter({ visible: true }).nth(1);
  await fieldName.fill('email_address_3d');
  await fieldName.press('Tab');
  await until(() => savedNode(state, 'smoke-db')?.data.fields?.[1]?.name === 'email_address_3d',
    '3D entity-specific Fields panel did not persist field edits');
  await page.getByRole('button', { name: 'Hide style panel', exact: true }).filter({ visible: true }).click();
  await switchMode(page, '2D');
  await page.locator(`.react-flow__node[data-id="${addedId}"]`).waitFor({ state: 'visible' });
  await page.locator(`.react-flow__edge[data-id="${connectedEdge.id}"]`).waitFor();
  await switchMode(page, '3D');
  scene = await waitFor3D(page);
  console.log('PASS 3D palette/connect/edge label+routing/width and entity fields use shared 2D graph');

  await select3DNode(scene, 'smoke-user');
  await page.getByRole('button', { name: 'Lock canvas', exact: true }).filter({ visible: true }).click();
  await saveNow(page, state);
  const lockedGraph = structuredClone(graph(state.diagram.data));
  await page.keyboard.press('Delete');
  await page.keyboard.press('Control+d');
  await page.keyboard.press('Control+v');
  await page.keyboard.press('Control+b');
  await page.keyboard.press('Control+z');
  const addPageButton = page.getByRole('button', { name: 'Add page', exact: true });
  if (!(await addPageButton.isDisabled())) await addPageButton.click();
  await saveNow(page, state);
  assert.deepEqual(graph(state.diagram.data), lockedGraph, 'Locked 3D canvas accepted graph mutations');
  await page.getByRole('button', { name: 'Unlock canvas', exact: true }).filter({ visible: true }).click();
  console.log('PASS locked 3D canvas blocks keyboard graph/style mutations');

  await saveNow(page, state);
  const beforePresent = structuredClone(graph(state.diagram.data));
  await page.getByRole('button', { name: 'Present', exact: true }).filter({ visible: true }).click();
  await scene.waitFor({ state: 'visible' });
  await page.keyboard.press('Delete');
  await page.keyboard.press('Control+d');
  await page.keyboard.press('Control+v');
  await page.keyboard.press('Escape');
  await scene.waitFor({ state: 'visible' });
  await saveNow(page, state);
  assert.deepEqual(graph(state.diagram.data), beforePresent, 'Presentation mode allowed diagram mutations');
  console.log('PASS 3D presentation is read-only and returns to the same editing view');

  const nativeFile = await downloadBytes(page, () => page.keyboard.press('Control+Shift+s'));
  assert(nativeFile.filename.endsWith('.easydraw'), 'Native export uses wrong file extension');
  const xml = nativeFile.bytes.toString('utf8');
  const stateMatch = xml.match(/<state>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/state>/);
  assert(stateMatch, 'Native export does not contain the EasyDraw document');
  const exported = JSON.parse(stateMatch[1].replace(/]]]]><!\[CDATA\[>/g, ']]>'));
  assert.deepEqual(exported.pages[0].nodes.find((node) => node.id === 'smoke-user').data.spatial3d,
    transform, 'Native export dropped 3D spatial data');
  assert(exported.pages[0].nodes.some((node) => node.id === addedId), 'Native export dropped shapes added in 3D');
  for (const [name, signature] of [['PNG', '89504e47'], ['JPEG', 'ffd8'], ['PDF', '25504446']]) {
    const exportedFile = await downloadBytes(page, async () => {
      await page.getByRole('button', { name: 'Export diagram', exact: true }).filter({ visible: true }).click();
      await page.getByRole('menu', { name: 'Export diagram', exact: true })
        .getByRole('menuitem', { name: new RegExp(`^${name}`) }).click();
    });
    assert(exportedFile.bytes.toString('hex').startsWith(signature), `${name} export contains invalid file data`);
    assert(exportedFile.bytes.length > 1000, `${name} export is unexpectedly empty`);
  }
  console.log('PASS native/PDF/PNG/JPEG exports work while editing 3D; native export retains spatial data');

  await saveNow(page, state);
  await page.reload();
  await page.locator('.react-flow__node[data-id="smoke-user"]').waitFor();
  await switchMode(page, '3D');
  scene = await waitFor3D(page);
  assert.equal(savedNode(state).data.label, 'Editable Web App');
  assert.deepEqual(savedNode(state).data.spatial3d, transform, 'Reload lost 3D spatial properties');
  const restoredLabel = sceneNode(scene, 'smoke-user');
  const renderedSize = JSON.parse(await restoredLabel.getAttribute('data-node-size'));
  const renderedRotation = JSON.parse(await restoredLabel.getAttribute('data-node-rotation'));
  const renderedPosition = JSON.parse(await restoredLabel.getAttribute('data-node-position'));
  assert(Math.abs(renderedSize[0] - 1.85) < 0.001 && Math.abs(renderedSize[1] - 1.5) < 0.001
    && Math.abs(renderedSize[2] - 1.1) < 0.001, 'Renderer did not restore saved shape dimensions');
  assert(Math.abs(renderedPosition[1] - 2) < 0.001, 'Renderer did not restore saved elevation plus half-depth');
  assert(Math.abs(renderedRotation[0] - Math.PI / 12) < 0.001
    && Math.abs(renderedRotation[1] + Math.PI / 6) < 0.001
    && Math.abs(renderedRotation[2] - Math.PI / 9) < 0.001, 'Renderer did not restore saved rotations');
  await select3DNode(scene, 'smoke-user');
  const styleButton = page.getByRole('button', { name: 'Show style panel', exact: true });
  if (await styleButton.isVisible()) await styleButton.click();
  await page.getByRole('tab', { name: '3D', exact: true }).filter({ visible: true }).click();
  assert.equal(Number(await page.getByLabel('Elevation', { exact: true }).filter({ visible: true }).inputValue()), 1.25,
    'Restored 3D panel does not reflect saved elevation');
  await page.screenshot({ path: path.join(outputDir, '05-editable-3d.png') });
  console.log('PASS editable shared diagram and spatial properties survive save/reload');

  await page.getByRole('button', { name: 'Hide style panel', exact: true }).filter({ visible: true }).click();
  await scene.getByRole('group', { name: '3D camera views', exact: true })
    .getByRole('button', { name: 'Isometric', exact: true }).click();
  await page.getByRole('button', { name: 'Select', exact: true }).filter({ visible: true }).click();
  const dragCanvas = scene.locator('canvas');
  const dragBounds = await dragCanvas.boundingBox();
  await dragCanvas.click({ position: { x: dragBounds.width * 0.9, y: dragBounds.height * 0.85 } });
  const beforeDrag = structuredClone(savedNode(state).position);
  const countBeforeDrag = savedPage(state).nodes.length;
  const cameraBeforeDrag = { position: JSON.parse(await dragCanvas.getAttribute('data-camera-position')),
    target: JSON.parse(await dragCanvas.getAttribute('data-camera-target')) };
  const center = await projectedNodeCenter(scene, 'smoke-user');
  await page.mouse.move(center.x, center.y);
  await page.mouse.down();
  await page.mouse.move(center.x + 20, center.y + 10, { steps: 6 });
  await page.keyboard.press('Control+d');
  await page.keyboard.press('Delete');
  await page.mouse.move(center.x + 45, center.y + 25, { steps: 6 });
  await page.mouse.up();
  await until(() => Math.hypot(savedNode(state).position.x - beforeDrag.x, savedNode(state).position.y - beforeDrag.y) > 1,
    'Dragging the actual 3D mesh did not update shared XY geometry');
  const cameraAfterDrag = { position: JSON.parse(await dragCanvas.getAttribute('data-camera-position')),
    target: JSON.parse(await dragCanvas.getAttribute('data-camera-target')) };
  assert(cameraDistance(cameraBeforeDrag, cameraAfterDrag) < 0.0001, 'Dragging a 3D object also orbited the camera');
  assert.equal(savedPage(state).nodes.length, countBeforeDrag, 'Keyboard mutation during drag corrupted the gesture graph');
  await page.keyboard.press('Control+z');
  await until(() => Math.hypot(savedNode(state).position.x - beforeDrag.x, savedNode(state).position.y - beforeDrag.y) < 0.01,
    'One undo did not restore the complete 3D drag gesture');
  console.log('PASS actual 3D mesh drag edits shared XY and is one atomic undo step');

  const imported = structuredClone(exported);
  const importedPage = imported.pages.find((page) => page.id === firstPageId);
  imported.activePageId = firstPageId;
  const importedCamera = { position: [15, 12, 18], target: [0, 0, 0] };
  importedPage.view3d = { version: 1, camera: importedCamera, origin: [0, 0, 0] };
  importedPage.nodes.find((node) => node.id === 'smoke-user').data.label = 'Imported same-page object';
  const choosingFile = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Open file', exact: true }).filter({ visible: true }).click();
  await (await choosingFile).setFiles({ name: 'same-page.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(imported)) });
  await page.locator('.react-flow__node[data-id="smoke-user"]').waitFor({ state: 'visible' });
  await switchMode(page, '3D');
  scene = await waitFor3D(page);
  await until(async () => {
    const canvas = scene.locator('canvas');
    const position = JSON.parse(await canvas.getAttribute('data-camera-position'));
    const target = JSON.parse(await canvas.getAttribute('data-camera-target'));
    return position && target && cameraDistance({ position, target }, importedCamera) < 0.001;
  }, 'Import with the same page ID retained the previous document camera/origin');
  await until(async () => await sceneNode(scene, 'smoke-user').getAttribute('data-node-label') === 'Imported same-page object',
    'Import with the same page ID retained the previous graph');
  await saveNow(page, state);
  assert.deepEqual(cameraFor(state), importedCamera, 'Imported camera was not preserved by save');
  console.log('PASS importing another document with the same page ID resets graph, camera and origin');

  const originalSetItem = await page.evaluateHandle(() => Storage.prototype.setItem);
  await page.evaluate(() => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'easydraw.editor.v1') throw new DOMException('Synthetic local backup quota failure', 'QuotaExceededError');
      return setItem.call(this, key, value);
    };
  });
  try {
    await saveNow(page, state);
    await until(async () => await page.getByLabel('Saved', { exact: true }).filter({ visible: true }).count() > 0,
      'Successful cloud save remained unsaved after local backup quota failure');
    assert.equal(savedNode(state).data.label, 'Imported same-page object', 'Cloud save lost imported content on local quota failure');
  } finally {
    await page.evaluate((setItem) => { Storage.prototype.setItem = setItem; }, originalSetItem);
    await originalSetItem.dispose();
  }
  console.log('PASS local backup quota failure still permits cloud PATCH and clears saving state');

  assert.deepEqual(errors, [], 'Browser errors occurred while editing in 3D');
  assert.deepEqual(state.blocked, [], '3D editing attempted unexpected external/API requests');
  await context.close();
}

async function runSurfaceLabelChecks({ context, page, state, errors }) {
  await page.goto(new URL(`/editor/${fixtureId}`, baseUrl).href);
  await page.locator('.react-flow__node[data-id="surface-label"]').waitFor({ state: 'visible' });
  assert.equal(await page.getByText('NETWORK', { exact: true }).count(), 0,
    'Retired Network palette section is still visible');
  await switchMode(page, '3D');
  let scene = await waitFor3D(page);
  await scene.getByRole('group', { name: '3D camera views', exact: true }).getByRole('button', { name: 'Top', exact: true }).click();
  await until(() => {
    const camera = cameraFor(state);
    return camera && Math.abs(camera.position[0] - camera.target[0]) < 0.01 && camera.position[1] - camera.target[1] > 1;
  }, 'Surface-label test could not establish the top view');
  await clear3DSelection(scene);
  await assertNoFloatingNodeLabels(scene);
  assert.equal(await sceneNode(scene, 'surface-blank').getAttribute('data-node-label'), '', 'Empty label gained placeholder text');
  const beforeGraph = structuredClone(graph(state.diagram.data));
  const beforeCamera = structuredClone(cameraFor(state));
  const textPixels = await captureNodeSurfacePixels(scene, 'surface-label');
  await page.screenshot({ path: path.join(outputDir, '09-surface-labels-top-before.png') });
  try {
    await click3DNode(scene, 'surface-label', { double: true });
    const text = scene.getByRole('textbox', { name: 'Edit object label', exact: true });
    await text.waitFor({ state: 'visible' });
    assert.equal(await text.evaluate((element) => element.tagName), 'TEXTAREA', 'Multiline label editing requires the transient textarea');
    await text.fill('Cancelled surface edit');
    await text.press('Escape');
    await text.waitFor({ state: 'detached' });
    assert.equal(savedNode(state, 'surface-label').data.label, 'Printed on the object', 'Escape committed a cancelled label');

    await click3DNode(scene, 'surface-label', { double: true });
    await text.fill('Nội dung mới');
    await text.press('End');
    await text.press('Shift+Enter');
    await text.pressSequentially('Second line');
    assert.equal(await text.inputValue(), 'Nội dung mới\nSecond line', 'Shift+Enter did not retain multiline editing');
    await text.press('Enter');
    await text.waitFor({ state: 'detached' });
    await until(() => savedNode(state, 'surface-label').data.label === 'Nội dung mới\nSecond line', 'Surface label edit did not autosave');
    await clear3DSelection(scene);
    await assertNoFloatingNodeLabels(scene);
    assert.deepEqual(cameraFor(state), beforeCamera, 'Editing a printed label changed the camera');
    await until(async () => await changedSurfacePixels(scene, textPixels) > 50,
      'Label changed in state but not in the WebGL canvas surface pixels');
    const expected = structuredClone(beforeGraph);
    expected[0].nodes.find((node) => node.id === 'surface-label').data.label = 'Nội dung mới\nSecond line';
    assert.deepEqual(graph(state.diagram.data), expected, 'Surface label editing changed unrelated graph content');
    await page.screenshot({ path: path.join(outputDir, '10-surface-labels-top-after.png') });
    await page.keyboard.press('Control+z');
    await until(() => savedNode(state, 'surface-label').data.label === 'Printed on the object', 'Shared undo did not restore the surface label');
    await clear3DSelection(scene);
    await until(async () => await changedSurfacePixels(scene, textPixels) < 10,
      'Undo restored text state but not the original rendered surface');
    await page.keyboard.press('Control+y');
    await until(() => savedNode(state, 'surface-label').data.label === 'Nội dung mới\nSecond line', 'Shared redo did not restore the new surface label');
  } finally {
    await textPixels.dispose();
  }
  console.log('PASS real mesh double-click edits printed multiline text; Escape/undo/redo and raw WebGL pixels agree');

  await clear3DSelection(scene);
  const entityPixels = await captureNodeSurfacePixels(scene, 'surface-entity');
  try {
    await select3DNode(scene, 'surface-entity');
    await page.getByRole('button', { name: 'Show style panel', exact: true }).filter({ visible: true }).click();
    await page.getByRole('tab', { name: 'Fields', exact: true }).filter({ visible: true }).click();
    const field = page.getByRole('textbox', { name: 'Field name', exact: true }).filter({ visible: true }).nth(1);
    await field.fill('email_address_on_surface');
    await field.press('Tab');
    await until(() => savedNode(state, 'surface-entity').data.fields[1].name === 'email_address_on_surface', 'Entity field edit did not persist');
    await clear3DSelection(scene);
    await assertNoFloatingNodeLabels(scene);
    await until(async () => await changedSurfacePixels(scene, entityPixels) > 20,
      'Entity fields changed only in DOM/state, not on the WebGL node surface');
  } finally {
    await entityPixels.dispose();
  }
  await edit3DLabel(scene, 'surface-blank', 'Previously blank');
  await until(() => savedNode(state, 'surface-blank').data.label === 'Previously blank', 'Blank-label mesh could not be edited');
  await edit3DLabel(scene, 'surface-text', 'Editable text surface');
  await until(() => savedNode(state, 'surface-text').data.label === 'Editable text surface', 'Text-only node could not be edited');
  await clear3DSelection(scene);
  await assertNoFloatingNodeLabels(scene);
  await scene.getByRole('group', { name: '3D camera views', exact: true }).getByRole('button', { name: 'Isometric', exact: true }).click();
  await until(() => cameraDistance(cameraFor(state), beforeCamera) > 0.1, 'Oblique surface view did not settle');
  await page.screenshot({ path: path.join(outputDir, '11-surface-labels-isometric.png') });
  await switchMode(page, '2D');
  assert((await page.locator('.react-flow__node[data-id="surface-label"]').textContent()).includes('Nội dung mới'),
    'Surface label was not shared with 2D');
  await until(async () => page.locator('.react-flow__node[data-id="surface-entity"] input').evaluateAll((inputs) =>
    inputs.some((input) => input.value === 'email_address_on_surface')), 'Surface field edit was not shared with 2D');
  await switchMode(page, '3D');
  scene = await waitFor3D(page);
  await assertNoFloatingNodeLabels(scene);
  assert.deepEqual(errors, [], 'Surface labels produced browser/WebGL errors');
  assert.deepEqual(state.blocked, [], 'Surface labels fetched unexpected external assets or APIs');
  await context.close();
  console.log('PASS entity fields render on the surface; blank/text-only nodes edit without floating cards; changes synchronize with 2D');
}

async function runGroupConnectionIntegrity({ context, page, state, errors }) {
  await page.goto(new URL(`/editor/${fixtureId}`, baseUrl).href);
  await page.locator('.react-flow__node[data-id="smoke-user"]').waitFor();
  await switchMode(page, '3D');
  const scene = await waitFor3D(page);
  await select3DNode(scene, 'smoke-user');
  await select3DNode(scene, 'smoke-api', ['Shift']);
  await page.keyboard.press('Control+g');
  await until(() => savedNode(state)?.parentId && savedNode(state, 'smoke-api')?.parentId === savedNode(state).parentId,
    'Integrity fixture could not group two objects');
  const groupId = savedNode(state).parentId;
  const hideStyle = page.getByRole('button', { name: 'Hide style panel', exact: true });
  if (await hideStyle.isVisible()) await hideStyle.click();
  const edgeIds = new Set(savedPage(state).edges.map((edge) => edge.id));
  await page.getByRole('button', { name: 'Connect', exact: true }).filter({ visible: true }).click();
  await select3DNode(scene, groupId);
  await scene.getByRole('status').filter({ hasText: 'Choose the target object' }).waitFor({ state: 'visible' });
  await select3DNode(scene, 'smoke-db');
  await until(() => savedPage(state).edges.length === edgeIds.size + 1, 'Could not connect group to another node');
  const groupEdge = savedPage(state).edges.find((edge) => !edgeIds.has(edge.id));
  assert.equal(groupEdge.source, groupId);
  assert.equal(groupEdge.target, 'smoke-db');
  await page.getByRole('button', { name: 'Select', exact: true }).filter({ visible: true }).click();
  await select3DNode(scene, groupId);
  await page.keyboard.press('Control+Shift+g');
  await until(() => !savedNode(state, groupId) && !savedNode(state)?.parentId, 'Ungroup did not remove group container');
  const survivingEdge = savedPage(state).edges.find((edge) => edge.id === groupEdge.id);
  assert(survivingEdge, 'Ungroup dropped the relationship attached to its former group');
  assert.equal(survivingEdge.target, 'smoke-db');
  const floatingEndpoint = savedNode(state, survivingEdge.source);
  assert.equal(floatingEndpoint?.type, 'connection-anchor', 'Ungroup did not retain group endpoint as a floating anchor');
  const validateEndpoints = () => {
    const ids = new Set(savedPage(state).nodes.map((node) => node.id));
    for (const edge of savedPage(state).edges) {
      assert(ids.has(edge.source) && ids.has(edge.target), `Dangling source/target reference on ${edge.id}`);
    }
  };
  validateEndpoints();
  await switchMode(page, '2D');
  await page.locator(`.react-flow__edge[data-id="${groupEdge.id}"]`).waitFor({ state: 'visible' });
  await page.keyboard.press('Control+z');
  await until(() => !!savedNode(state, groupId)
    && savedPage(state).edges.find((edge) => edge.id === groupEdge.id)?.source === groupId,
  'Cross-view undo did not restore the group and its attached relationship together');
  await page.keyboard.press('Control+y');
  await until(() => !savedNode(state, groupId), 'Cross-view redo did not reapply ungroup');
  validateEndpoints();
  await page.screenshot({ path: path.join(outputDir, '07-group-edge-integrity.png') });
  assert.deepEqual(errors, [], 'Group connection regression produced browser errors');
  assert.deepEqual(state.blocked, [], 'Group integrity test attempted unexpected external/API requests');
  await context.close();
  console.log('PASS group-attached relationship survives ungroup as a floating endpoint, including cross-view undo/redo');
}

async function runRemovedFeatureChecks({ context, page, state, errors }) {
  const originalDocument = structuredClone(state.diagram.data);
  const originalGraph = graph(originalDocument);
  // This pre-existing loader normalization is independent of feature removal.
  originalGraph[0].nodes.find((node) => node.id === 'smoke-user').style = { width: '150px', height: '90px' };
  const originalView = structuredClone(originalDocument.pages[0].view3d);
  await page.goto(new URL('/dashboard/diagrams', baseUrl).href);
  await page.getByRole('heading', { name: 'My Diagrams', exact: true }).waitFor({ state: 'visible' });
  await page.getByText('3D smoke fixture', { exact: true }).waitFor({ state: 'visible' });
  await assertNoInteractiveUI(page, 'Dashboard');

  await page.goto(new URL(`/editor/${fixtureId}`, baseUrl).href);
  const user = page.locator('.react-flow__node[data-id="smoke-user"]');
  await user.waitFor({ state: 'visible' });
  await assertNoInteractiveUI(page, 'Legacy document in 2D');
  await saveNow(page, state);
  assert.deepEqual(graph(state.diagram.data), originalGraph, 'Opening retired metadata changed the existing graph');
  assert.deepEqual(savedPage(state).view3d, originalView, 'Opening retired metadata changed the existing camera');
  assert.equal(Object.hasOwn(state.patches.at(-1).data, 'interactive'), false,
    'An ordinary save still emits retired top-level metadata');

  await switchMode(page, '3D');
  const scene = await waitFor3D(page);
  const actualCamera = JSON.parse(await scene.locator('canvas').getAttribute('data-camera-position'));
  assert(Math.hypot(...actualCamera.map((value, index) => value - originalView.camera.position[index])) < 0.01,
    'Ignoring retired metadata changed restored 3D camera position');
  assert.equal(await scene.getAttribute('data-node-count'), '4');
  assert.equal(await scene.getAttribute('data-edge-count'), '3');
  await switchMode(page, '2D');
  await user.waitFor({ state: 'visible' });
  await assertNoInteractiveUI(page, 'Legacy document after returning to 2D');
  await user.dblclick();
  const label = user.getByRole('textbox', { name: 'Node label', exact: true });
  await label.fill('Ordinary editable diagram');
  await label.press('Escape');
  await until(() => savedNode(state)?.data.label === 'Ordinary editable diagram',
    'Diagram containing retired metadata could not edit and autosave');
  const expectedGraph = structuredClone(originalGraph);
  expectedGraph[0].nodes.find((node) => node.id === 'smoke-user').data.label = 'Ordinary editable diagram';
  assert.deepEqual(graph(state.diagram.data), expectedGraph, 'Removing feature state altered unrelated diagram content');
  assert.deepEqual(savedPage(state).view3d, originalView, 'Editing after removal lost existing camera data');
  assert.deepEqual(errors, [], 'Removing Interactive produced browser errors');
  assert.deepEqual(state.blocked, [], 'Removal checks attempted unexpected external/API requests');
  await page.screenshot({ path: path.join(outputDir, '08-without-interactive.png') });
  await context.close();
  console.log('PASS no Interactive dashboard/editor controls; retired metadata does not block 2D/3D, graph/camera preservation or editing');
}

let currentPage;
try {
  if (suites.has('reviewed-artwork')) {
  const reviewed = await createMockContext({ reviewedArtwork: true });
  currentPage = reviewed.page;
  await runReviewedArtworkChecks(reviewed);
  }

  if (suites.has('spatial-artwork')) {
  const spatial = await createMockContext({ spatialArtwork: true });
  currentPage = spatial.page;
  await runSpatialArtworkChecks(spatial);
  }

  if (suites.has('flat-artwork')) {
  const artwork = await createMockContext({ flatArtwork: true });
  currentPage = artwork.page;
  await runFlatArtworkChecks(artwork);
  }

  if (suites.has('surface-labels')) {
  const surfaces = await createMockContext({ surfaceLabels: true });
  currentPage = surfaces.page;
  await runSurfaceLabelChecks(surfaces);
  }

  if (suites.has('removed-feature')) {
  const removed = await createMockContext({ retiredFeaturePayload: true });
  currentPage = removed.page;
  await runRemovedFeatureChecks(removed);
  }

  if (suites.has('legacy')) {
  const { context, page, state, errors } = await createMockContext();
  currentPage = page;
  await page.goto(new URL(`/editor/${fixtureId}`, baseUrl).href);
  await page.locator('.react-flow__node[data-id="smoke-user"]').waitFor();
  await assertNoInteractiveUI(page, 'Legacy 2D editor');
  await until(async () => page.locator('.react-flow__edge').count().then((count) => count === 3),
    'Fixture did not render all three 2D connections');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await until(() => state.patches.length > 0, 'Initial 2D save not intercepted');
  const originalGraph = structuredClone(graph(state.diagram.data));
  await page.locator('.react-flow__node[data-id="smoke-user"]').click();
  await page.getByRole('button', { name: 'Zoom out', exact: true }).click();
  const viewport = await page.locator('.react-flow__viewport').getAttribute('style');
  await page.screenshot({ path: path.join(outputDir, '01-original-2d.png') });
  console.log('PASS legacy diagram loads; mixed shapes and floating connections render in 2D');

  await switchMode(page, '3D');
  let scene = await waitFor3D(page);
  assert.equal(await scene.getAttribute('data-node-count'), '4', '3D dropped a node or rendered internal anchors as solids');
  assert.equal(await scene.getAttribute('data-edge-count'), '3', '3D dropped a connection');
  await orbit(page, scene);
  await until(() => !!cameraFor(state), 'Orbit did not persist a 3D camera');
  const firstCamera = structuredClone(cameraFor(state));
  await orbit(page, scene, -65, -35);
  await until(() => cameraDistance(cameraFor(state), firstCamera) > 0.001,
    'Second orbit did not change the persisted camera');
  const cameraViews = scene.getByRole('group', { name: '3D camera views', exact: true });
  await cameraViews.getByRole('button', { name: 'Top', exact: true }).click();
  await until(() => {
    const camera = cameraFor(state);
    return Math.abs(camera.position[0] - camera.target[0]) < 0.01
      && camera.position[1] - camera.target[1] > 1;
  }, 'Top camera preset did not persist');
  await cameraViews.getByRole('button', { name: 'Front', exact: true }).click();
  await until(() => {
    const camera = cameraFor(state);
    return Math.abs(camera.position[1] - camera.target[1]) < 0.01
      && camera.position[2] - camera.target[2] > 1;
  }, 'Front camera preset did not persist');
  await cameraViews.getByRole('button', { name: 'Isometric', exact: true }).click();
  await until(() => {
    const camera = cameraFor(state);
    return camera.position[0] - camera.target[0] > 1 && camera.position[1] - camera.target[1] > 1;
  }, 'Isometric camera preset did not persist');
  const beforePan = structuredClone(cameraFor(state));
  const canvasBounds = await scene.locator('canvas').boundingBox();
  await page.mouse.move(canvasBounds.x + canvasBounds.width * 0.75, canvasBounds.y + canvasBounds.height * 0.75);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(canvasBounds.x + canvasBounds.width * 0.75 + 65,
    canvasBounds.y + canvasBounds.height * 0.75 + 25, { steps: 10 });
  await page.mouse.up({ button: 'right' });
  await until(() => Math.hypot(...cameraFor(state).target.map((value, index) => value - beforePan.target[index])) > 0.01,
    'Right-drag did not pan and persist the camera target');
  const beforeZoom = structuredClone(cameraFor(state));
  await page.mouse.wheel(0, -120);
  await until(() => cameraDistance(cameraFor(state), beforeZoom) > 0.01, 'Scroll did not zoom and persist camera');
  assert.deepEqual(graph(state.diagram.data), originalGraph, '3D camera changed diagram graph');
  await page.screenshot({ path: path.join(outputDir, '02-orbited-3d.png') });
  console.log('PASS spatial 3D orbit/pan/zoom and camera presets persist without changing nodes or edges');

  await switchMode(page, '2D');
  await page.locator('.react-flow').waitFor({ state: 'visible' });
  assert.equal(await page.locator('.react-flow__viewport').getAttribute('style'), viewport,
    'Returning from 3D changed the 2D viewport');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await until(() => state.patches.at(-1)?.data?.pages?.[0]?.view3d?.camera,
    '2D save did not preserve 3D camera');
  assert.deepEqual(graph(state.diagram.data), originalGraph, 'Switching views changed graph');
  const user = page.locator('.react-flow__node[data-id="smoke-user"]');
  await user.dblclick();
  await user.getByRole('textbox', { name: 'Node label', exact: true }).fill('Updated Web App');
  await user.getByRole('textbox', { name: 'Node label', exact: true }).press('Escape');
  await until(() => state.diagram.data.pages[0].nodes.find((node) => node.id === 'smoke-user')?.data.label === 'Updated Web App',
    '2D label edit did not autosave');
  await switchMode(page, '3D');
  scene = await waitFor3D(page);
  await until(async () => await sceneNode(scene, 'smoke-user').getAttribute('data-node-label') === 'Updated Web App',
    '3D scene did not receive the updated shared node label');
  await until(async () => await sceneNode(scene, 'smoke-unknown').getAttribute('data-node-label') === 'Future custom shape',
    'Unknown node type was dropped instead of receiving a 3D fallback');
  console.log('PASS original 2D viewport survives; 2D edits appear in 3D; unknown type has fallback');

  const graphBeforePageSwitch = structuredClone(graph(state.diagram.data));
  const cameraBeforePageSwitch = structuredClone(cameraFor(state));
  await orbit(page, scene, 75, 25);
  const mainCamera = {
    position: JSON.parse(await scene.locator('canvas').getAttribute('data-camera-position')),
    target: JSON.parse(await scene.locator('canvas').getAttribute('data-camera-target')),
  };
  assert(cameraDistance(mainCamera, cameraBeforePageSwitch) > 0.01,
    'Page-switch test did not create a pending camera change');
  await page.getByRole('tab', { name: /^Second page/ }).click();
  scene = await waitFor3D(page);
  assert.equal(await scene.getAttribute('data-node-count'), '1', 'Page switch retained objects from the previous page');
  await until(async () => await sceneNode(scene, 'smoke-second-node').getAttribute('data-node-label') === 'Second page node',
    'Wrong graph after page switch');
  // Make no new edit on the destination page: completion of the previous
  // page's pending camera save must still clear the shared Saving indicator.
  await until(() => cameraDistance(cameraFor(state), mainCamera) < 0.000001,
    'Pending camera was not saved to its originating page');
  await until(async () => await page.getByLabel('Saved', { exact: true }).filter({ visible: true }).count() > 0
    || await page.locator('header').getByRole('status').filter({ hasText: /^Saved$/ }).filter({ visible: true }).count() > 0,
    'Switching pages before autosave completed left the 3D header stuck on Saving');
  assert.equal(cameraFor(state, secondPageId), undefined, 'First page camera leaked into untouched destination page');
  assert.deepEqual(graph(state.diagram.data), graphBeforePageSwitch, 'Pending camera save changed either page graph');
  console.log('PASS pending camera save completes after immediate page switch; header returns to Saved');
  await orbit(page, scene);
  await until(() => !!cameraFor(state, secondPageId), 'Second page camera was not persisted');
  assert.deepEqual(cameraFor(state), mainCamera, 'Second page camera overwrote first page camera');
  await page.getByRole('tab', { name: /^Empty page/ }).click();
  await page.getByLabel('3D diagram', { exact: true }).waitFor({ state: 'visible' });
  await until(async () => /empty|no (?:objects|nodes|shapes)|(?:add|drag).*(?:shape|object|2D)/i.test(
    await page.getByLabel('3D diagram', { exact: true }).textContent()), 'Empty page has no usable empty-state message');
  await page.getByRole('tab', { name: /^Main page/ }).click();
  await waitFor3D(page);
  assert.deepEqual(cameraFor(state), mainCamera, 'Page switch changed first page camera');
  console.log('PASS page-specific graphs/cameras remain isolated; empty page is supported');

  await switchMode(page, '2D');
  const patchCount = state.patches.length;
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await until(() => state.patches.length > patchCount, 'Final save did not finish');
  await page.reload();
  await page.locator('.react-flow__node[data-id="smoke-user"]').waitFor();
  await switchMode(page, '3D');
  scene = await waitFor3D(page);
  assert.deepEqual(cameraFor(state), mainCamera, 'Saved camera did not survive reload');
  // Canvas sizing precedes the camera rig effect. Wait for the actual camera
  // diagnostic; mocked saved JSON alone cannot prove renderer restoration.
  const cameraDiagnostic = scene.locator('canvas');
  await until(async () => !!(await cameraDiagnostic.getAttribute('data-camera-position')),
    'Reloaded camera rig did not expose its rendered position');
  const position = JSON.parse(await cameraDiagnostic.getAttribute('data-camera-position'));
  assert(Math.hypot(...position.map((value, index) => value - mainCamera.position[index])) < 0.01,
    'Reloaded renderer camera differs from the persisted camera');
  console.log('PASS saved camera survives reload and renderer restores its position');
  await page.screenshot({ path: path.join(outputDir, '03-reloaded-3d.png') });

  // Navigate before the 1-second debounce expires. Native history integration
  // updates Next usePathname (used by useDiagramId) without a full reload, so
  // this exercises ownership of the existing module-level autosave machinery.
  await orbit(page, scene, 145, 35);
  const departingCanvas = scene.locator('canvas');
  const pendingCamera = {
    position: JSON.parse(await departingCanvas.getAttribute('data-camera-position')),
    target: JSON.parse(await departingCanvas.getAttribute('data-camera-target')),
  };
  assert(cameraDistance(pendingCamera, mainCamera) > 0.01, 'Cross-document test did not create a pending camera change');
  await page.evaluate((id) => window.history.pushState(null, '', `/editor/${id}`), otherFixtureId);
  const otherNode = page.locator('.react-flow__node[data-id="smoke-other-node"]');
  await otherNode.waitFor({ state: 'attached' });
  // View mode is shared editor preference across document navigation. Explicitly
  // return to 2D before interacting with the new document's ReactFlow nodes.
  await switchMode(page, '2D');
  await otherNode.waitFor({ state: 'visible' });
  await otherNode.dblclick();
  await otherNode.getByRole('textbox', { name: 'Node label', exact: true }).fill('Updated other document');
  await otherNode.getByRole('textbox', { name: 'Node label', exact: true }).press('Escape');
  await until(() => state.patchRecords.some(({ id, payload }) => id === otherFixtureId
    && payload.data.pages[0].nodes[0].data.label === 'Updated other document'),
  'New diagram edit did not autosave');
  assert.deepEqual(state.ownershipViolations, [], 'A pending autosave wrote one diagram into another');
  assert.deepEqual(cameraFor(state), pendingCamera, 'Leaving a diagram lost its pending 3D camera change');
  assert.equal(state.diagram.data.pages[0].nodes[0].data.label, 'Updated Web App',
    'Another diagram overwrote the original graph');
  console.log('PASS rapid cross-document navigation flushes the correct camera; autosaves retain document ownership');

  assert.deepEqual(errors, [], 'Browser errors occurred in the normal WebGL path');
  assert.deepEqual(state.blocked, [], 'App attempted unexpected external/API requests');
  await context.close();
  }

  if (suites.has('editing')) {
  const editable = await createMockContext();
  currentPage = editable.page;
  await runEditable3DChecks(editable);
  }

  if (suites.has('integrity')) {
  const integrity = await createMockContext();
  currentPage = integrity.page;
  await runGroupConnectionIntegrity(integrity);
  }

  if (suites.has('catalog')) {
  const catalog = await createMockContext({ catalog: true });
  currentPage = catalog.page;
  await catalog.page.goto(new URL(`/editor/${fixtureId}`, baseUrl).href);
  await catalog.page.locator('.react-flow__node[data-id="catalog-0"]').waitFor();
  await switchMode(catalog.page, '3D');
  const catalogScene = await waitFor3D(catalog.page);
  await until(async () => catalogScene.locator('[data-scene-node]').count().then((count) => count === catalogTypes.length),
    '3D visual catalog did not render all representative types');
  await assertNoFloatingNodeLabels(catalogScene);
  await orbit(catalog.page, catalogScene);
  await catalog.page.screenshot({ path: path.join(outputDir, '06-shape-catalog-3d.png') });
  assert.equal(await catalogScene.getAttribute('data-node-count'), String(catalogTypes.length));
  assert.deepEqual(catalog.errors, [], 'SVG/geometry rendering failed for representative shape catalog');
  assert.deepEqual(catalog.state.blocked, [], '3D catalog fetched external fonts or assets');
  await catalog.context.close();
  console.log(`PASS ${catalogTypes.length} representative basic/UML/entity visual recipes render without errors`);
  }

  if (suites.has('fallback')) {
  const fallback = await createMockContext({ noWebGL: true });
  currentPage = fallback.page;
  await fallback.page.goto(new URL(`/editor/${fixtureId}`, baseUrl).href);
  await fallback.page.locator('.react-flow__node[data-id="smoke-user"]').waitFor();
  await switchMode(fallback.page, '3D');
  const fallbackAlert = fallback.page.getByLabel('3D diagram', { exact: true }).getByRole('alert');
  await fallbackAlert.waitFor({ state: 'visible' });
  assert.match(await fallbackAlert.textContent(), /WebGL|3D.*unavailable|cannot.*3D|could not.*3D/i,
    'No-WebGL mode should display an actionable fallback');
  await fallback.page.screenshot({ path: path.join(outputDir, '04-no-webgl-fallback.png') });
  await switchMode(fallback.page, '2D');
  await fallback.page.locator('.react-flow__node[data-id="smoke-user"]').waitFor({ state: 'visible' });
  assert.deepEqual(fallback.state.blocked, [], 'Fallback attempted unexpected external/API requests');
  await fallback.context.close();
  console.log('PASS unavailable WebGL displays fallback and allows returning to 2D');
  }
  console.log(`All selected diagram 3D browser smoke checks passed (${[...suites].join(', ')}). Screenshots: ${outputDir}`);
} catch (error) {
  if (currentPage && !currentPage.isClosed()) {
    await currentPage.screenshot({ path: path.join(outputDir, 'failure.png') }).catch(() => {});
  }
  console.error(`FAIL: ${error.message}\nScreenshots: ${outputDir}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
