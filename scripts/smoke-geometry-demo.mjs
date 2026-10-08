/**
 * Geometry classroom demo smoke against an already running LOCAL frontend.
 * All app APIs/auth are intercepted in memory for a synthetic owner. No real
 * database, cloud, OpenAI, S3 or account requests are allowed.
 *
 * BASE_URL: default http://localhost:5173
 * PLAYWRIGHT_MODULE_PATH: existing playwright-core/playwright package directory
 * BROWSER_EXECUTABLE_PATH: optional installed Chromium/Chrome/Edge executable
 * SMOKE_OUTPUT_DIR: defaults to a fresh OS temporary directory
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright-core');
const base = new URL(process.env.BASE_URL || 'http://localhost:5173');
assert(['localhost', '127.0.0.1', '[::1]'].includes(base.hostname), 'Use a local frontend only.');
const output = process.env.SMOKE_OUTPUT_DIR ? path.resolve(process.env.SMOKE_OUTPUT_DIR)
  : await mkdtemp(path.join(tmpdir(), 'easydraw-geometry-demo-'));
await mkdir(output, { recursive: true });
const state = { documents: new Map(), creations: [], saves: [], previewCalls: [], forbidden: [], errors: [], checks: [] };
const browser = await chromium.launch({ headless: true,
  ...(process.env.BROWSER_EXECUTABLE_PATH ? { executablePath: process.env.BROWSER_EXECUTABLE_PATH } : { channel: 'msedge' }),
  args: ['--disable-background-networking', '--enable-webgl', '--enable-unsafe-swiftshader'],
});
const watchdog = setTimeout(() => {
  state.errors.push('Geometry smoke exceeded its 180-second watchdog.');
  process.exitCode = 1;
  void browser.close();
}, 180_000);
const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, serviceWorkers: 'block' });
const page = await context.newPage();
page.setDefaultTimeout(25_000);
page.on('pageerror', (error) => state.errors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') state.errors.push(message.text()); });
page.on('dialog', (dialog) => dialog.accept());

await context.route('**/*', async (route) => {
  const request = route.request();
  const url = new URL(request.url());
  const method = request.method();
  const headers = { 'access-control-allow-origin': base.origin, 'access-control-allow-credentials': 'true',
    'access-control-allow-methods': 'GET, POST, PATCH, OPTIONS', 'access-control-allow-headers': 'content-type' };
  const reply = (json, status = 200) => route.fulfill({ status, headers, ...(status === 204 ? {} : { json }) });
  const api = !/^\/(?:dashboard|editor|_next)(?:\/|$)/.test(url.pathname)
    && /\/(?:auth|diagrams|diagram-previews|node-library|object-library|templates|ai|generation)(?:\/|$)/.test(url.pathname);
  try {
    if (api && method === 'OPTIONS') return reply(undefined, 204);
    if (api && /\/(?:previews|diagram-previews|ai|generation)(?:\/|$)/.test(url.pathname)) {
      state.previewCalls.push(`${method} ${url.pathname}`);
      return reply({ message: 'This sample must not request AI.' }, 422);
    }
    if (api && url.pathname.endsWith('/auth/me') && method === 'GET') {
      return reply({ id: 'geometry-smoke-owner', email: 'geometry@example.invalid', name: 'Synthetic Teacher', role: 'user' });
    }
    if (api && url.pathname.endsWith('/templates') && method === 'GET') return reply([]);
    if (api && url.pathname.endsWith('/node-library/sections') && method === 'GET') return reply({ sections: [] });
    if (api && url.pathname.endsWith('/object-library/objects') && method === 'GET') return reply([]);
    if (api && url.pathname.endsWith('/diagrams')) {
      if (method === 'GET') return reply([...state.documents.values()].map(({ data, ...document }) => document));
      if (method === 'POST') {
        const payload = request.postDataJSON();
        assert(['whiteboard', 'diagram'].includes(payload.type), 'Unexpected document type');
        assert(payload.type === 'whiteboard' ? payload.data.sample === 'geometry-whiteboard' : Array.isArray(payload.data.pages));
        const now = new Date().toISOString();
        const document = { id: randomUUID(), ownerId: 'geometry-smoke-owner', status: 'draft',
          thumbnailAt: null, createdAt: now, updatedAt: now, ...structuredClone(payload) };
        state.documents.set(document.id, document);
        state.creations.push(document.id);
        return reply(document, 201);
      }
    }
    const match = api && url.pathname.match(/\/diagrams\/([^/]+)(\/thumbnail)?$/);
    const document = match && state.documents.get(match[1]);
    if (document && method === 'GET') {
      if (!match[2]) return reply(document);
      const image = document.thumbnail ?? [...state.documents.values()].find((item) => item.type === 'whiteboard')?.data.image;
      return route.fulfill({ status: 200, headers, contentType: 'image/png', body: Buffer.from(image.split(',')[1], 'base64') });
    }
    if (document && method === 'PATCH') {
      const payload = request.postDataJSON();
      assert(Object.keys(payload).every((key) => (match[2] ? ['image'] : ['title', 'data', 'status', 'category']).includes(key)));
      if (document.type === 'whiteboard' && payload.data) assert.equal(payload.data.sample, 'geometry-whiteboard', 'Autosave lost the sample origin');
      state.saves.push({ id: document.id, thumbnail: Boolean(match[2]) });
      if (match[2]) Object.assign(document, { thumbnail: payload.image, thumbnailAt: new Date().toISOString() });
      else Object.assign(document, structuredClone(payload));
      return reply(document);
    }
    if (url.origin === base.origin && method === 'POST' && url.pathname === '/__nextjs_original-stack-frames') return route.continue();
    if (url.origin === base.origin && ['GET', 'HEAD'].includes(method) && !api) return route.continue();
    state.forbidden.push(`${method} ${url.origin}${url.pathname}`);
    return route.abort('blockedbyclient');
  } catch (error) {
    state.errors.push(`Route: ${error.message}`);
    return reply({ message: 'Invalid synthetic request' }, 422);
  }
});
if (context.routeWebSocket) await context.routeWebSocket('**/*', (socket) => {
  if (new URL(socket.url()).host === base.host) socket.connectToServer();
  else { state.forbidden.push(`WS ${socket.url()}`); socket.close(); }
});

async function until(predicate, message, timeout = 25_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 75));
  }
  throw new Error(message);
}
const screenshot = (name) => page.screenshot({ path: path.join(output, name) });
const preview = () => page.getByTestId('diagram-preview-viewer');
const previewPanel = () => page.getByRole('complementary', { name: 'Diagram preview', exact: true });
async function ready3D(root = page) {
  const scene = root.getByTestId('diagram3d-scene');
  await scene.waitFor({ state: 'visible', timeout: 60_000 });
  await scene.locator('canvas').waitFor({ state: 'visible', timeout: 60_000 });
  await until(async () => Boolean(await scene.locator('canvas').getAttribute('data-camera-position')), '3D camera did not initialize');
  assert(Number(await scene.getAttribute('data-node-count')) > 8, 'Geometry scene is missing editable objects');
  return scene;
}
async function generate() {
  const started = Date.now();
  await page.getByRole('button', { name: /^(Generate preview|Generate from drawing)$/ }).click();
  await until(async () => await previewPanel().getAttribute('data-preview-status') === 'loading', 'No demo loading state');
  await until(async () => await previewPanel().getAttribute('data-preview-status') === 'ready', 'Demo result did not settle');
  const elapsed = Date.now() - started;
  assert(elapsed >= 1_950, `Demo loading pause was too short: ${elapsed} ms`);
  assert.equal(await preview().getAttribute('data-preview-view'), '3D', 'Geometry result should initially open in 3D');
  await ready3D(preview());
  return elapsed;
}

let failure;
try {
  await page.goto(new URL('/dashboard/whiteboards', base).href, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  const sample = page.getByRole('region', { name: /Triangular\s+Prism.*sample$/ });
  await sample.getByRole('button', { name: 'Use sample', exact: true }).click();
  await page.waitForURL(/\/editor\/[^/?]+$/);
  const boardId = new URL(page.url()).pathname.split('/').at(-1);
  const board = state.documents.get(boardId);
  assert.equal(board.type, 'whiteboard');
  assert.equal(board.data.sample, 'geometry-whiteboard');
  assert.match(board.data.image, /^data:image\/png;base64,/);
  const prompt = page.getByRole('textbox', { name: 'Describe your idea', exact: true });
  await prompt.waitFor({ state: 'visible' });
  const initialPrompt = await prompt.inputValue();
  assert.match(initialPrompt, /right prism ABC\.A'B'C'/);
  assert.match(initialPrompt, /angle between planes \(ABC\) and \(A'BC\) is 60 degrees/);
  assert.match(initialPrompt, /distance from M to plane \(AB'C'\)/);
  assert.match(initialPrompt, /midpoint of AA'/);
  const canvas = page.getByLabel('Whiteboard canvas', { exact: true });
  await canvas.waitFor({ state: 'visible' });
  await until(async () => Number(await page.getByRole('combobox', { name: 'Zoom level', exact: true }).inputValue()) < 1,
    'Sample should fit its whiteboard on entry');
  assert.equal(await page.getByRole('button', { name: 'Colors', exact: true }).getAttribute('aria-pressed'), 'false', 'Sample palette obscures the teaching sketch');
  await screenshot('01-teacher-whiteboard.png');

  // A real drawing gesture forces autosave, then reload exercises saved origin.
  const bounds = await canvas.boundingBox();
  await page.getByRole('radio', { name: 'Pencil', exact: true }).click();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 + 24, bounds.y + bounds.height / 2 + 6, { steps: 5 });
  await page.mouse.up();
  await until(() => state.saves.some((save) => save.id === boardId && !save.thumbnail), 'Whiteboard did not autosave');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await prompt.waitFor({ state: 'visible' });
  assert.equal(await prompt.inputValue(), initialPrompt, 'Reload lost the sample prompt');
  await canvas.waitFor({ state: 'visible' });
  assert.equal(state.documents.get(boardId).data.sample, 'geometry-whiteboard');
  state.checks.push('Whiteboard sample, preloaded prompt, autosave and reload');
  console.log('PASS sample creation, prompt, save and reload');

  await page.getByRole('button', { name: 'Generate preview', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel preview', exact: true }).click();
  await until(async () => await previewPanel().getAttribute('data-preview-status') === 'idle', 'Cancel did not reset loading');
  await page.waitForTimeout(2_150);
  assert.equal(await previewPanel().getAttribute('data-preview-id'), '', 'Cancelled result published late');
  assert.equal(state.creations.length, 1, 'Cancelled preview created a diagram');
  state.checks.push('Cancellation blocks delayed result and diagram creation');
  console.log('PASS cancellation');

  state.loadingMs = await generate();
  await screenshot('02-geometry-preview-3d.png');
  await page.getByRole('button', { name: '2D preview', exact: true }).click();
  assert.equal(await preview().getAttribute('data-preview-view'), '2D');
  await page.getByTestId('diagram-preview-canvas').waitFor({ state: 'visible' });
  await until(async () => page.getByTestId('diagram-preview-canvas').locator('.react-flow__viewport').evaluate((element) => {
    const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform);
    return matrix.a > 0.1 && element.querySelectorAll('.react-flow__node').length > 8;
  }), '2D preview did not fit visible geometry and captions');
  await page.waitForTimeout(250);
  await screenshot('03-geometry-preview-2d.png');
  await page.getByRole('button', { name: '3D preview', exact: true }).click();
  await ready3D(preview());
  state.checks.push('Two-second local result starts in actual 3D; 2D/3D switch reuses result');
  console.log('PASS delayed 3D preview and dimension switches');

  await page.getByRole('button', { name: 'Create diagram', exact: true }).click();
  await page.waitForURL(/\/editor\/[^/?]+\?view=3d$/);
  const createdId = new URL(page.url()).pathname.split('/').at(-1);
  const diagram = state.documents.get(createdId);
  assert.equal(diagram.type, 'diagram');
  assert.equal(state.creations.length, 2);
  assert(state.documents.has(boardId), 'Create removed the whiteboard');
  const labels = diagram.data.pages.flatMap((item) => item.nodes).map((node) => String(node.data.label));
  assert(labels.some((label) => label.includes('V = 3√3 a³ / 8')), 'Triangular-prism volume solution is missing');
  assert(labels.some((label) => label.includes('MF = 3a / 8')), 'Perpendicular distance to the target plane is missing');
  await ready3D();
  await page.getByRole('button', { name: 'Present', exact: true }).waitFor({ state: 'visible' });
  await screenshot('04-editable-geometry-3d.png');
  state.checks.push('Create saves the geometry document and opens its editable 3D view');
  console.log('PASS diagram creation');

  await page.getByRole('button', { name: 'Present', exact: true }).click();
  await until(async () => await page.getByRole('button', { name: 'Present', exact: true }).count() === 0, 'Present left editor chrome visible');
  assert.equal(await page.getByRole('button', { name: 'Save', exact: true }).count(), 0, 'Present left editing toolbar visible');
  assert.equal(await page.getByRole('textbox', { name: 'Document file name', exact: true }).count(), 0, 'Present left document controls visible');
  await page.mouse.move(1000, 650);
  await page.waitForFunction(() => {
    const bar = document.querySelector('header');
    return bar && bar.getBoundingClientRect().bottom <= 1;
  });
  await screenshot('05-present-geometry-3d.png');
  await page.getByRole('button', { name: '2D view', exact: true }).click();
  await until(async () => await page.getByRole('button', { name: '2D view', exact: true }).getAttribute('aria-pressed') === 'true', 'Present 2D switch failed');
  await page.getByRole('button', { name: '3D view', exact: true }).click();
  await ready3D();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Present', exact: true }).waitFor({ state: 'visible' });
  state.checks.push('Present hides editor controls, auto-hides header, switches 2D/3D and exits');
  assert.deepEqual(state.previewCalls, [], 'Built-in sample attempted an AI/preview API request');
  assert.deepEqual(state.forbidden, [], 'Unexpected external request or API write');
  assert.deepEqual(state.errors, [], 'Browser reported an error');
  state.checks.push('Zero AI requests or real cloud calls');
} catch (error) {
  failure = error;
  process.exitCode = 1;
  await screenshot('failure.png').catch(() => {});
} finally {
  clearTimeout(watchdog);
  const report = { passed: !failure, loadingMs: state.loadingMs, checks: state.checks,
    documentsCreated: state.creations.length, autosaves: state.saves.length,
    previewCalls: state.previewCalls, forbidden: state.forbidden, errors: state.errors,
    ...(failure ? { failure: failure.message } : {}), output };
  await writeFile(path.join(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}
if (failure) throw failure;
