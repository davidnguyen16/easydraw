/**
 * Reviewed preview -> editable diagram regression against an existing LOCAL
 * frontend. Every app API is mocked in memory. No real database/auth/S3/OpenAI
 * calls, migrations or server startup; no changes to real user documents.
 *
 * PLAYWRIGHT_MODULE_PATH points to an existing playwright-core installation.
 * BASE_URL defaults to http://localhost:5173; Edge is the default browser.
 */
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright-core');
const base = new URL(process.env.BASE_URL || 'http://localhost:5173');
assert(['localhost', '127.0.0.1', '[::1]'].includes(base.hostname), 'Use only a local frontend.');
const output = process.env.SMOKE_OUTPUT_DIR ? path.resolve(process.env.SMOKE_OUTPUT_DIR)
  : await mkdtemp(path.join(tmpdir(), 'easydraw-preview-commit-'));
await mkdir(output, { recursive: true });
const ids = { first: randomUUID(), second: randomUUID(), owner: randomUUID() };
const boardDocument = (id, title) => ({ id, title, type: 'whiteboard', category: null, status: 'draft',
  thumbnailAt: null, updatedAt: new Date().toISOString(),
  data: { version: 1, pack: 'whiteboard', width: 800, height: 600, image: null } });
const state = { documents: new Map([[ids.first, boardDocument(ids.first, 'Reviewed sketch A')],
  [ids.second, boardDocument(ids.second, 'Reviewed sketch B')]]), previews: new Map(), receipts: new Map(),
  generations: [], commits: [], saves: [], errors: [], forbidden: [], expectedHttpErrors: 0, httpErrors: 0,
  commitMode: 'ready', commitGate: null, saveGate: null, nextLegacy: false, sourceImage: '',
  availabilityReads: [], availabilityMode: 'same' };
const gate = () => { let release; const wait = new Promise((resolve) => { release = resolve; }); return { wait, release }; };
const graph = (index) => ({ schemaVersion: 1, activePageId: 'reviewed-page', pages: [{ id: 'reviewed-page', name: 'Reviewed design',
  nodes: [
    { id: 'system', type: 'RectangleNode', position: { x: 40, y: 40 }, width: 160, height: 80,
      data: { label: `Reviewed option ${index}`, fillColor: '#f8c970', borderColor: '#315a85' } },
    { id: 'curve', type: 'VectorPathNode', position: { x: 280, y: 90 }, width: 160, height: 80,
      data: { label: 'Editable curve', vector: { version: 1,
        commands: [{ op: 'M', values: [0, 900] }, { op: 'Q', values: [500, 0, 1000, 900] }],
        stroke: '#315a85', fill: 'none', strokeWidth: 3, dash: 'solid', startArrow: false, endArrow: true } } },
    { id: 'caption', type: 'TextNode', position: { x: 40, y: 210 }, width: 170, height: 35,
      data: { label: 'Editable reviewed caption', fontSize: 14, textColor: '#253349' } },
    { id: 'image', type: 'SourceImageNode', position: { x: 280, y: 210 }, width: 100, height: 60,
      data: { label: 'Original sketch detail', image: { version: 1, dataUrl: state.sourceImage,
        width: 20, height: 12, reason: 'Preserved source detail.' } } },
  ], edges: [{ id: 'connection', type: 'connection', source: 'system', target: 'curve', sourceHandle: 'right', targetHandle: 'left',
    data: { routing: 'straight', markerEnd: 'triangle', labels: [{ id: 'relationship', text: 'Reviewed relation', t: 0.5 }] } }] }] });

const browser = await chromium.launch({ headless: true,
  ...(process.env.BROWSER_EXECUTABLE_PATH ? { executablePath: process.env.BROWSER_EXECUTABLE_PATH } : { channel: 'msedge' }),
  args: ['--renderer-process-limit=1', '--disable-background-networking', '--enable-webgl', '--enable-unsafe-swiftshader'] });
const watchdog = setTimeout(() => { console.error('FAIL: commit smoke exceeded 180 seconds.'); process.exitCode = 1; void browser.close(); }, 180_000);
const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, serviceWorkers: 'block' });
const page = await context.newPage();
page.setDefaultTimeout(15_000);
page.setDefaultNavigationTimeout(45_000);
page.on('pageerror', (error) => state.errors.push(error.message));
page.on('console', (message) => {
  if (message.type() !== 'error') return;
  if (state.httpErrors < state.expectedHttpErrors && /\/diagram-previews\/[^/]+\/commit$/.test(message.location().url ?? '') &&
    /^Failed to load resource:/.test(message.text())) state.httpErrors++;
  else state.errors.push(message.text());
});
await context.route('**/*', async (route) => {
  const request = route.request(), url = new URL(request.url()), method = request.method();
  const api = /^\/(?:api\/)?(?:auth|diagrams|diagram-previews|node-library|object-library|templates)(?:\/|$)/.test(url.pathname);
  const headers = { 'access-control-allow-origin': base.origin, 'access-control-allow-credentials': 'true',
    'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS', 'access-control-allow-headers': 'content-type' };
  const reply = (json, status = 200) => route.fulfill({ status, headers, ...(status === 204 ? {} : { json }) });
  try {
    if (api && method === 'OPTIONS') return reply(undefined, 204);
    if (api && url.pathname.endsWith('/auth/me') && method === 'GET')
      return reply({ id: ids.owner, email: 'commit@example.invalid', name: 'Synthetic Owner' });
    if (/^\/(?:api\/)?diagrams$/.test(url.pathname) && method === 'GET')
      return reply([...state.documents.values()].map(({ data, ...item }) => item));
    if (api && url.pathname.endsWith('/templates') && method === 'GET') return reply([]);
    if (api && url.pathname.endsWith('/node-library/sections') && method === 'GET') return reply({ sections: [] });
    if (api && url.pathname.endsWith('/object-library/objects') && method === 'GET') return reply([]);
    const availability = api && url.pathname.match(/\/diagram-previews\/([^/]+)$/);
    if (availability && method === 'GET') {
      const frozen = state.previews.get(availability[1]); assert(frozen);
      state.availabilityReads.push(availability[1]);
      return reply({ ...structuredClone(frozen.result), creationAvailable: true,
        ...(state.availabilityMode === 'mismatch' ? { documentHash: '0'.repeat(64) } : {}) });
    }
    const generate = api && url.pathname.match(/\/diagrams\/([^/]+)\/previews$/);
    if (generate && method === 'POST') {
      assert([ids.first, ids.second].includes(generate[1]));
      const payload = request.postDataJSON(), document = graph(state.generations.length + 1), now = Date.now();
      assert.match(payload.image, /^data:image\/png;base64,/);
      state.generations.push({ whiteboardId: generate[1], ...structuredClone(payload) });
      const preview = { id: randomUUID(), clientRequestId: payload.clientRequestId, clientRevision: payload.clientRevision,
        status: 'ready', document, documentHash: createHash('sha256').update(JSON.stringify(document)).digest('hex'),
        warnings: [], errorCode: null, source: { width: payload.width, height: payload.height }, model: 'synthetic-model',
        refinementAvailable: true, ...(state.nextLegacy ? {} : { creationAvailable: true }),
        createdAt: new Date(now).toISOString(), expiresAt: new Date(now + 86_400_000).toISOString() };
      state.nextLegacy = false;
      state.previews.set(preview.id, { result: structuredClone(preview), whiteboardId: generate[1], payload: structuredClone(payload) });
      await new Promise((resolve) => setTimeout(resolve, 150));
      return reply(preview);
    }
    const commit = api && url.pathname.match(/\/diagram-previews\/([^/]+)\/commit$/);
    if (commit && method === 'POST') {
      const payload = request.postDataJSON(), frozen = state.previews.get(commit[1]);
      assert(frozen, 'Only a synthetic server-owned preview may be committed.');
      assert.deepEqual(Object.keys(payload).sort(), ['acknowledgeStale', 'documentHash'].sort(),
        'Commit must send only the reviewed hash and acknowledgement, not client graph/image/hint.');
      assert.equal(payload.documentHash, frozen.result.documentHash, 'Hash does not match selected immutable preview.');
      assert.equal(typeof payload.acknowledgeStale, 'boolean');
      state.commits.push({ previewId: commit[1], ...structuredClone(payload), sourceAtCommit: structuredClone(state.documents.get(frozen.whiteboardId)) });
      const mode = state.commitMode; state.commitMode = 'ready';
      if (mode === 'stale' || mode === 'unavailable') {
        state.expectedHttpErrors++;
        return reply({ code: mode === 'stale' ? 'preview_stale' : 'preview_commit_unavailable', message: 'Synthetic controlled failure' }, mode === 'stale' ? 409 : 503);
      }
      const prior = state.receipts.get(commit[1]);
      let receipt = prior;
      if (!receipt) {
        const diagramId = randomUUID(), visualDocumentId = state.documents.get(frozen.whiteboardId).visualDocumentId ?? randomUUID();
        state.documents.get(frozen.whiteboardId).visualDocumentId = visualDocumentId;
        receipt = { previewId: commit[1], diagramId, visualDocumentId, sourceWhiteboardId: frozen.whiteboardId,
          documentHash: frozen.result.documentHash, created: true };
        state.receipts.set(commit[1], receipt);
        state.documents.set(diagramId, { id: diagramId, title: 'Diagram from reviewed preview', type: 'diagram', category: null,
          status: 'draft', thumbnailAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          visualDocumentId, sourceWhiteboardId: frozen.whiteboardId, sourcePreviewId: commit[1], data: structuredClone(frozen.result.document) });
      }
      if (state.commitGate) await state.commitGate.wait;
      if (mode === 'lost') { state.expectedHttpErrors++; return route.abort('failed'); }
      return reply({ ...receipt, created: !prior });
    }
    const stored = api && url.pathname.match(/\/diagrams\/([^/]+)(\/thumbnail)?$/);
    if (stored && state.documents.has(stored[1])) {
      const document = state.documents.get(stored[1]);
      if (method === 'GET') {
        if (stored[2]) return route.fulfill({ status: 200, headers, contentType: 'image/png', body: Buffer.from(state.sourceImage.split(',')[1], 'base64') });
        return reply(document);
      }
      if (method === 'PATCH') {
        const payload = request.postDataJSON();
        assert(Object.keys(payload).every((key) => (stored[2] ? ['image'] : ['title', 'data', 'status']).includes(key)));
        if (document.type === 'whiteboard' && payload.data) {
          assert.deepEqual(Object.keys(payload.data).sort(), ['version', 'pack', 'width', 'height', 'image'].sort());
          assert.equal(payload.data.pack, 'whiteboard');
        }
        state.saves.push({ id: stored[1], thumbnail: Boolean(stored[2]), payload: structuredClone(payload) });
        if (state.saveGate && !stored[2] && document.type === 'whiteboard') await state.saveGate.wait;
        if (!stored[2]) Object.assign(document, structuredClone(payload));
        return reply(document);
      }
    }
    if (url.origin === base.origin && method === 'POST' && url.pathname === '/__nextjs_original-stack-frames') return route.continue();
    if (url.origin === base.origin && ['GET', 'HEAD'].includes(method) && !api) return route.continue();
    state.forbidden.push(`${method} ${url.origin}${url.pathname}`);
    return route.abort('blockedbyclient');
  } catch (error) { state.errors.push(`Route contract: ${error.message}`); return reply({ message: 'Invalid synthetic request' }, 422); }
});
const routedSockets = new Set();
if (context.routeWebSocket) await context.routeWebSocket('**/*', (socket) => {
  if (new URL(socket.url()).host === base.host) {
    routedSockets.add(socket);
    routedSockets.add(socket.connectToServer());
  }
  else { state.forbidden.push(`WEBSOCKET ${socket.url()}`); socket.close(); }
});

const panel = () => page.getByRole('complementary', { name: 'Diagram preview', exact: true });
const create = () => panel().getByRole('button', { name: 'Create diagram', exact: true });
const retry = () => panel().getByRole('button', { name: 'Retry creation', exact: true });
const acknowledge = () => panel().getByRole('checkbox', { name: /^Create from this preview anyway/ });
async function until(predicate, message, timeout = 15_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { if (await predicate()) return; await new Promise((resolve) => setTimeout(resolve, 50)); }
  throw new Error(message);
}
async function openBoard(id = ids.first) {
  await page.goto(new URL(`/editor/${id}`, base).href, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Whiteboard canvas', { exact: true }).waitFor();
  await until(async () => await panel().getAttribute('data-preview-status') === 'idle', 'Whiteboard did not reset preview state.');
}
async function ideaExpanded() {
  const details = panel().locator('details').filter({ has: page.getByText('Idea & new preview', { exact: true }) });
  if (await details.getAttribute('open') === null) await details.locator(':scope > summary').click();
}
async function generate(hint) {
  await ideaExpanded();
  await panel().getByLabel('Describe your idea', { exact: true }).fill(hint);
  const before = state.generations.length;
  await panel().getByRole('button', { name: /^(Generate preview|Generate from drawing)$/, exact: true }).click();
  await until(async () => state.generations.length === before + 1 && await panel().getAttribute('data-preview-status') === 'ready', 'No READY synthetic preview.');
  const id = await panel().getAttribute('data-preview-id'); assert(state.previews.has(id)); return id;
}
async function draw() {
  const canvas = page.getByLabel('Whiteboard canvas', { exact: true });
  const box = await canvas.boundingBox(); assert(box);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 65, box.y + box.height / 2 + 45, { steps: 8 }); await page.mouse.up();
  await until(async () => await page.getByRole('button', { name: 'Undo (Ctrl+Z)', exact: true }).isEnabled(), 'Synthetic sketch was not drawn.');
}
async function expectNoRerun(count) { assert.equal(state.generations.length, count, 'Create diagram ran AI generation again.'); }
async function canvasFullyVisible() {
  return panel().getByTestId('diagram-preview-canvas').evaluate((element) => {
    let top = 0, bottom = innerHeight;
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      if (/auto|scroll|hidden|clip/.test(getComputedStyle(parent).overflowY)) {
        const bounds = parent.getBoundingClientRect(); top = Math.max(top, bounds.top); bottom = Math.min(bottom, bounds.bottom);
      }
    }
    const bounds = element.getBoundingClientRect();
    return bounds.top >= top - 1 && bounds.bottom <= bottom + 1;
  });
}

try {
  await openBoard();
  state.sourceImage = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 20; canvas.height = 12;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#c73550'; ctx.fillRect(0, 0, 10, 12);
    ctx.fillStyle = '#315a85'; ctx.fillRect(10, 0, 10, 12); return canvas.toDataURL('image/png');
  });
  assert(await create().isDisabled());
  await draw();
  const first = await generate('Draw a system architecture with an editable route and preserved source detail.');
  assert(await create().isEnabled(), 'Ready reviewed preview should be creatable.');
  const second = await generate('Alternative architecture with a different layout.');
  await panel().getByRole('button', { name: 'Use previous preview', exact: true }).click();
  assert.equal(await panel().getAttribute('data-preview-id'), first, 'The older selected preview was not restored.');
  assert.notEqual(first, second);
  await panel().getByLabel('What should change?', { exact: true }).fill('This feedback is deliberately not applied.');
  assert(await acknowledge().isVisible(), 'Unapplied drawing/description/feedback requires acknowledgement.');
  assert(await create().isDisabled()); await acknowledge().check();
  await page.setViewportSize({ width: 1366, height: 768 });
  const createBounds = await create().boundingBox();
  assert(createBounds && createBounds.y >= 0 && createBounds.y + createBounds.height <= 768,
    'Create diagram must remain reachable in the preview footer at desktop 768px height.');
  await page.screenshot({ path: path.join(output, '00-reviewed-stale-acknowledgement-768.png') });
  await page.setViewportSize({ width: 1366, height: 650 });
  await panel().getByTestId('diagram-preview-canvas').scrollIntoViewIfNeeded();
  await panel().getByRole('button', { name: 'Fit preview', exact: true }).click();
  await until(canvasFullyVisible, 'Enabled creation + stale acknowledgement clips the preview canvas at 1366x650.');
  const compactCreateBounds = await create().boundingBox();
  assert(compactCreateBounds && compactCreateBounds.y >= 0 && compactCreateBounds.y + compactCreateBounds.height <= 650);
  assert(await create().isEnabled());
  await page.screenshot({ path: path.join(output, '00-reviewed-stale-acknowledgement-650.png') });
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.getByLabel('Whiteboard title', { exact: true }).fill('Source kept after creation');
  state.saveGate = gate(); state.commitGate = gate();
  const generationCount = state.generations.length, commitCount = state.commits.length;
  // Two same-tick activations exercise the submit lock as well as disabled UI.
  await create().evaluate((button) => { button.click(); button.click(); });
  await until(() => state.saves.some((save) => save.payload.title === 'Source kept after creation'), 'Source flush was not attempted.');
  assert.equal(state.commits.length, commitCount, 'Commit overtook the pending source save.');
  state.saveGate.release(); state.saveGate = null;
  await until(() => state.commits.length === commitCount + 1, 'No exact-preview commit after source saved.');
  assert.equal(state.commits.at(-1).previewId, first);
  assert.equal(state.commits.at(-1).acknowledgeStale, true);
  assert.equal(state.commits.at(-1).sourceAtCommit.title, 'Source kept after creation');
  assert(await panel().getByRole('button', { name: 'Use previous preview', exact: true }).isDisabled());
  assert(await panel().getByRole('button', { name: 'Refine preview', exact: true }).isDisabled());
  await ideaExpanded();
  assert(await panel().getByRole('button', { name: 'Generate from drawing', exact: true }).isDisabled());
  await page.screenshot({ path: path.join(output, '01-exact-selected-preview-pending.png') });
  state.saveGate = gate();
  await page.getByLabel('Whiteboard title', { exact: true }).fill('Source edited while creation was pending');
  state.commitGate.release(); state.commitGate = null;
  const receipt = state.receipts.get(first);
  await until(() => state.saves.some((save) => save.payload.title === 'Source edited while creation was pending'),
    'Edits made during creation were not flushed before navigation.');
  assert.equal(new URL(page.url()).pathname, `/editor/${ids.first}`, 'Navigation overtook the final source save.');
  state.saveGate.release(); state.saveGate = null;
  await until(() => new URL(page.url()).pathname === `/editor/${receipt.diagramId}`, 'Successful commit did not navigate to its diagram.');
  await page.locator('.react-flow__node[data-id="system"]').waitFor();
  assert.deepEqual(state.documents.get(receipt.diagramId).data, state.previews.get(first).result.document, 'Official graph differs from frozen selected preview.');
  assert.equal(state.documents.get(receipt.diagramId).visualDocumentId, state.documents.get(ids.first).visualDocumentId);
  assert.equal(state.documents.get(receipt.diagramId).sourceWhiteboardId, ids.first);
  assert.equal(state.documents.get(ids.first).type, 'whiteboard');
  assert.equal(state.documents.get(ids.first).title, 'Source edited while creation was pending');
  assert.match(state.documents.get(ids.first).data.image, /^data:image\/png;base64,/);
  assert.equal(state.commits.length, commitCount + 1, 'Double-click submitted duplicate commits.');
  await expectNoRerun(generationCount);
  assert.equal(await page.locator('.react-flow__node').count(), 4);
  await page.locator('.react-flow__edge[data-id="connection"]').waitFor();
  assert.equal(await page.locator('.react-flow__edge').count(), 1);
  assert.match(await page.locator('.react-flow__node[data-id="system"]').textContent(), /Reviewed option 1/);
  await page.getByRole('button', { name: '3D view', exact: true }).click();
  const scene = page.getByLabel('3D diagram', { exact: true }); await scene.waitFor();
  await until(async () => await scene.getAttribute('data-node-count') === '4', 'Created diagram cannot render all reviewed nodes in 3D.');
  await scene.locator('canvas').waitFor();
  await new Promise((resolve) => setTimeout(resolve, 450));
  await page.screenshot({ path: path.join(output, '02-created-diagram-3d.png') });
  await page.getByRole('button', { name: '2D view', exact: true }).click();
  await page.locator('.react-flow__node[data-id="image"] img').waitFor();
  assert.equal(await page.locator('.react-flow__node').count(), 4);
  await expectNoRerun(generationCount);
  const editableNode = page.locator('.react-flow__node[data-id="system"]');
  await editableNode.dblclick();
  const label = editableNode.getByRole('textbox', { name: 'Node label', exact: true });
  await label.fill('Edited after creating the reviewed diagram'); await label.press('Escape');
  await until(() => state.documents.get(receipt.diagramId).data.pages[0].nodes.find((node) => node.id === 'system').data.label ===
    'Edited after creating the reviewed diagram', 'The created graph is not editable/autosaved.');
  assert.equal(state.previews.get(first).result.document.pages[0].nodes[0].data.label, 'Reviewed option 1',
    'Editing the official diagram mutated the frozen preview.');
  assert.equal(state.documents.get(ids.first).type, 'whiteboard');
  await page.goto(new URL('/dashboard/diagrams', base).href);
  await page.getByRole('heading', { name: 'My Diagrams', exact: true }).waitFor();
  assert.equal(await page.locator(`a[href="/editor/${receipt.diagramId}"]`).count(), 1, 'Created diagram missing from My Diagrams.');
  await page.goto(new URL('/dashboard/whiteboards', base).href);
  await page.getByRole('heading', { name: 'My Whiteboards', exact: true }).waitFor();
  assert.equal(await page.locator(`a[href="/editor/${ids.first}"]`).count(), 1, 'Original whiteboard disappeared.');
  console.log('PASS selected previous ID/hash, save-before-create, stale acknowledgement, double-click, exact graph, editor 2D/3D, separate dashboard listings and shared lineage.');

  await openBoard();
  const lost = await generate('Plan a route with editable waypoints.');
  const beforeLost = state.generations.length;
  state.commitMode = 'lost'; await create().click();
  await retry().waitFor();
  assert.equal(state.receipts.size, 2, 'Synthetic server did not store the first uncertain commit.');
  assert.equal(new URL(page.url()).pathname, `/editor/${ids.first}`);
  const originalAttempt = structuredClone(state.commits.at(-1));
  await retry().click();
  await until(() => new URL(page.url()).pathname === `/editor/${state.receipts.get(lost).diagramId}`, 'Retry failed to open the already-created diagram.');
  assert.equal(state.commits.at(-1).previewId, originalAttempt.previewId);
  assert.equal(state.commits.at(-1).documentHash, originalAttempt.documentHash);
  assert.equal(state.receipts.size, 2, 'Retry duplicated an official diagram.');
  await expectNoRerun(beforeLost);
  console.log('PASS uncertain commit keeps reviewed ID/hash, explicit idempotent retry opens one diagram, no AI rerun.');

  await openBoard();
  const stale = await generate('Create a manufacturing process layout.');
  state.commitMode = 'stale'; await create().click();
  await acknowledge().waitFor();
  assert(await retry().isDisabled(), 'Server-side stale response must require acknowledgement.');
  await acknowledge().check(); await retry().click();
  await until(() => new URL(page.url()).pathname === `/editor/${state.receipts.get(stale)?.diagramId}`, 'Acknowledged server-stale retry did not create.');
  assert.equal(state.commits.at(-1).previewId, stale); assert.equal(state.commits.at(-1).acknowledgeStale, true);
  console.log('PASS server-side stale state cannot silently commit without acknowledgement.');

  await openBoard();
  const unavailable = await generate('Create a room layout.');
  state.commitMode = 'unavailable'; await create().click();
  await retry().waitFor();
  assert.equal(await panel().getAttribute('data-preview-id'), unavailable);
  assert.equal(new URL(page.url()).pathname, `/editor/${ids.first}`);
  assert(!state.receipts.has(unavailable), 'Controlled failure created an official diagram.');
  await retry().click();
  await until(() => new URL(page.url()).pathname === `/editor/${state.receipts.get(unavailable)?.diagramId}`, 'Explicit transient-error retry failed.');
  console.log('PASS server error retains selected preview and permits same-target explicit retry.');

  await openBoard();
  const late = await generate('Create a code flow diagram.');
  state.commitGate = gate(); await create().click();
  await until(() => state.receipts.has(late), 'Late commit was not dispatched.');
  await page.evaluate((id) => window.history.pushState(null, '', `/editor/${id}`), ids.second);
  await until(async () => await page.getByLabel('Whiteboard title', { exact: true }).inputValue() === 'Reviewed sketch B', 'Second whiteboard did not open.');
  state.commitGate.release(); state.commitGate = null;
  await new Promise((resolve) => setTimeout(resolve, 350));
  assert.equal(new URL(page.url()).pathname, `/editor/${ids.second}`, 'Late response redirected a different document.');
  assert.equal(await panel().getAttribute('data-preview-status'), 'idle');
  assert.equal(await panel().getAttribute('data-preview-id'), '');
  state.nextLegacy = true;
  const legacy = await generate('Legacy backend compatibility.');
  assert(await create().isDisabled(), 'A backend without creationAvailable must fail closed.');
  await page.screenshot({ path: path.join(output, '03-legacy-backend-safe.png') });
  const beforeAvailability = state.generations.length;
  state.availabilityMode = 'mismatch';
  await panel().getByRole('button', { name: 'Check availability', exact: true }).click();
  await panel().getByText(/This preview no longer matches the reviewed version/).waitFor();
  assert(await create().isDisabled(), 'A different document hash must not unlock creation.');
  assert.equal(await panel().getAttribute('data-preview-id'), legacy);
  state.availabilityMode = 'same';
  await panel().getByRole('button', { name: 'Check availability', exact: true }).click();
  await until(async () => await create().isEnabled(), 'Same-preview capability refresh did not enable creation.');
  assert.equal(await panel().getAttribute('data-preview-id'), legacy);
  assert.deepEqual(state.availabilityReads, [legacy, legacy]);
  await expectNoRerun(beforeAvailability);
  console.log('PASS document switch ignores late navigation; older backend without capability cannot create.');
  console.log('PASS manual capability refresh uses read-only GET, refuses mismatched hash, never replaces graph or regenerates.');
  assert.deepEqual(state.forbidden, [], 'Unmocked external/write request occurred.');
  assert.deepEqual(state.errors, [], 'Unexpected browser or route errors.');
  assert.equal(state.generations.length, 7, 'Creation or capability checks dispatched an extra generation.');
  assert.equal(state.commits.length, 8, 'Creation made an unexpected automatic retry.');
  assert.equal(state.receipts.size, 5, 'Explicit retries created duplicate diagram receipts.');
  console.log(`PASS ${state.generations.length} synthetic generations, ${state.commits.length} explicit commit attempts; no real API/database/provider calls.`);
  console.log(`Screenshots: ${output}`);
} catch (error) {
  console.error(error);
  console.error(JSON.stringify({ commits: state.commits.map(({ sourceAtCommit, ...attempt }) => attempt), errors: state.errors, forbidden: state.forbidden }, null, 2));
  await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {});
  console.error(`Failure screenshot: ${output}`); process.exitCode = 1;
} finally {
  state.commitGate?.release(); state.saveGate?.release();
  // Full-page navigation opens multiple HMR socket bridges in dev mode. Close
  // both sides explicitly so a completed smoke does not keep Node alive.
  const cleanupDeadline = setTimeout(() => {
    console.error('FAIL: own browser cleanup exceeded 15 seconds after assertions completed.');
    process.exit(1);
  }, 15_000);
  await Promise.allSettled([...routedSockets].map((socket) => socket.close()));
  await context.close();
  await browser.close();
  clearTimeout(cleanupDeadline);
  clearTimeout(watchdog);
}
