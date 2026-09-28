/**
 * Sketch + intent + iterative refinement browser regression. Run against an
 * already running LOCAL frontend. All app API traffic is fulfilled in memory;
 * no real authentication, database, S3, OpenAI or diagram creation is allowed.
 *
 * PLAYWRIGHT_MODULE_PATH: existing playwright-core / playwright directory.
 * BASE_URL: defaults to http://localhost:5173.
 * BROWSER_EXECUTABLE_PATH: optional Chromium executable; defaults to Edge.
 * SMOKE_OUTPUT_DIR: defaults to a fresh OS temporary directory.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright-core');
const base = new URL(process.env.BASE_URL || 'http://localhost:5173');
assert(['localhost', '127.0.0.1', '[::1]'].includes(base.hostname), 'Only a local frontend is allowed.');
const output = process.env.SMOKE_OUTPUT_DIR ? path.resolve(process.env.SMOKE_OUTPUT_DIR)
  : await mkdtemp(path.join(tmpdir(), 'easydraw-refinement-smoke-'));
await mkdir(output, { recursive: true });

const whiteboard = { id: 'refinement-smoke-whiteboard', title: 'Sketch and intent smoke', type: 'whiteboard',
  status: 'draft', updatedAt: new Date().toISOString(),
  data: { version: 1, pack: 'whiteboard', width: 800, height: 600, image: null } };
const state = { requests: [], previews: new Map(), cancelled: [], recovered: [], saves: [],
  forbidden: [], errors: [], next: 'ready', lost: 0, expectedLost: 0 };
function documentFor(index) {
  return { schemaVersion: 1, activePageId: 'page', pages: [{ id: 'page', name: 'Sketch preview',
    nodes: [{ id: 'api', type: 'RectangleNode', position: { x: 80, y: 80 }, width: 160, height: 70,
      data: { label: `Architecture preview ${index}`, fillColor: '#ffffff' } }], edges: [] }] };
}
const browser = await chromium.launch({ headless: true,
  ...(process.env.BROWSER_EXECUTABLE_PATH ? { executablePath: process.env.BROWSER_EXECUTABLE_PATH } : { channel: 'msedge' }),
  args: ['--renderer-process-limit=1', '--disable-background-networking'] });
const watchdog = setTimeout(() => {
  console.error('FAIL: refinement smoke exceeded 180 seconds.');
  process.exitCode = 1;
  void browser.close();
}, 180_000);
const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, serviceWorkers: 'block' });
const page = await context.newPage();
page.setDefaultTimeout(20_000);
page.on('pageerror', (error) => state.errors.push(error.message));
page.on('console', (message) => {
  if (message.type() !== 'error') return;
  if (state.lost < state.expectedLost && /\/diagrams\/[^/]+\/previews$/.test(message.location().url ?? '') &&
    message.text() === 'Failed to load resource: net::ERR_FAILED') state.lost++;
  else state.errors.push(message.text());
});
await context.route('**/*', async (route) => {
  const request = route.request(), url = new URL(request.url()), method = request.method();
  const api = !/^\/(?:editor|dashboard|_next)(?:\/|$)/.test(url.pathname) &&
    /\/(?:auth|diagrams|diagram-previews|node-library|ai|generation)(?:\/|$)/.test(url.pathname);
  const headers = { 'access-control-allow-origin': base.origin, 'access-control-allow-credentials': 'true',
    'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS', 'access-control-allow-headers': 'content-type' };
  const reply = (json, status = 200) => route.fulfill({ status, headers, ...(status === 204 ? {} : { json }) });
  try {
    if (api && method === 'OPTIONS') return reply(undefined, 204);
    if (url.pathname.endsWith('/auth/me') && method === 'GET')
      return reply({ id: 'refinement-smoke-owner', email: 'refinement@example.invalid', name: 'Synthetic Owner' });
    if (api && url.pathname.endsWith('/diagrams') && method === 'GET') return reply([whiteboard]);
    const attempt = api && url.pathname.match(/\/diagrams\/([^/]+)\/previews\/requests\/([^/]+)$/);
    if (attempt && attempt[1] === whiteboard.id) {
      const id = attempt[2], prior = state.previews.get(id);
      if (method === 'DELETE') {
        state.cancelled.push(id);
        assert(prior, 'Only the pending synthetic request can be cancelled');
        state.previews.set(id, { ...prior, status: 'cancelled', document: null, documentHash: null });
        return reply(undefined, 204);
      }
      if (method === 'GET') {
        state.recovered.push(id);
        return prior ? reply(prior) : reply({ message: 'Not found' }, 404);
      }
    }
    const create = api && url.pathname.match(/\/diagrams\/([^/]+)\/previews$/);
    if (create && create[1] === whiteboard.id && method === 'POST') {
      const payload = request.postDataJSON();
      const keys = ['clientRequestId', 'clientRevision', 'width', 'height', 'image', 'hint'];
      if (payload.basePreviewId) keys.push('basePreviewId', 'feedback');
      assert.deepEqual(Object.keys(payload).sort(), keys.sort(), 'Do not send a client graph or history to refinement');
      assert.match(payload.clientRequestId, /^[\da-f-]{36}$/i);
      assert(!state.requests.some((item) => item.clientRequestId === payload.clientRequestId), 'An existing paid request was re-POSTed');
      assert.match(payload.image, /^data:image\/png;base64,/);
      assert.equal(payload.width, 800); assert.equal(payload.height, 600);
      assert(Number.isSafeInteger(payload.clientRevision));
      assert.equal(typeof payload.hint, 'string'); assert(payload.hint.length <= 4000);
      if (payload.basePreviewId) {
        assert([...state.previews.values()].some((item) => item.id === payload.basePreviewId && item.status === 'ready'),
          'Refinement must refer to a successful server-owned synthetic preview');
        assert.equal(typeof payload.feedback, 'string'); assert(payload.feedback.trim() && payload.feedback.length <= 2000);
      }
      state.requests.push(structuredClone(payload));
      const sample = state.next, now = Date.now();
      const result = { id: `preview-${payload.clientRequestId}`, clientRequestId: payload.clientRequestId,
        clientRevision: payload.clientRevision, status: sample === 'failed' ? 'failed' : 'ready',
        ...(sample === 'legacy' ? {} : { refinementAvailable: true }),
        source: { width: 800, height: 600 }, model: 'synthetic-model',
        document: sample === 'failed' ? null : documentFor(state.requests.length),
        documentHash: sample === 'failed' ? null : 'a'.repeat(64), warnings: [],
        errorCode: sample === 'failed' ? 'provider_refused' : null,
        createdAt: new Date(now).toISOString(), expiresAt: new Date(now + 86_400_000).toISOString() };
      state.previews.set(payload.clientRequestId, { ...result, status: 'processing', document: null, documentHash: null });
      await new Promise((resolve) => setTimeout(resolve, sample === 'slow' ? 1800 : 650));
      if (state.previews.get(payload.clientRequestId)?.status !== 'cancelled') state.previews.set(payload.clientRequestId, result);
      if (sample === 'lost-response') { state.expectedLost++; return route.abort('failed'); }
      // Deliberately deliver a late success even after cancellation. The local
      // abort/request-ID guard must not replace the selected previous result.
      return reply(result);
    }
    const stored = api && url.pathname.match(/\/diagrams\/([^/]+)(\/thumbnail)?$/);
    if (stored && stored[1] === whiteboard.id) {
      if (method === 'GET' && !stored[2]) return reply(whiteboard);
      if (method === 'PATCH') {
        const payload = request.postDataJSON();
        if (stored[2]) {
          assert.deepEqual(Object.keys(payload), ['image']);
          assert.match(payload.image, /^data:image\/(?:png|jpeg|webp);base64,/);
        } else {
          assert(Object.keys(payload).every((key) => ['title', 'data'].includes(key)));
          if (payload.data) {
            assert.deepEqual(Object.keys(payload.data).sort(), ['version', 'pack', 'width', 'height', 'image'].sort(),
              'Prompt/preview context leaked into the saved drawing');
            assert.equal(payload.data.pack, 'whiteboard');
            assert.match(payload.data.image, /^data:image\/png;base64,/);
          }
          Object.assign(whiteboard, structuredClone(payload));
        }
        state.saves.push(payload);
        return reply(whiteboard);
      }
    }
    if (url.pathname.endsWith('/node-library/sections') && method === 'GET') return reply({ sections: [] });
    if (url.origin === base.origin && method === 'POST' && url.pathname === '/__nextjs_original-stack-frames') return route.continue();
    if (url.origin === base.origin && ['GET', 'HEAD'].includes(method) && !api) return route.continue();
    state.forbidden.push(`${method} ${url.origin}${url.pathname}`);
    return route.abort('blockedbyclient');
  } catch (error) {
    state.errors.push(`Route contract: ${error.message}`);
    return reply({ message: 'Invalid synthetic request' }, 422);
  }
});
if (context.routeWebSocket) await context.routeWebSocket('**/*', (socket) => {
  if (new URL(socket.url()).host === base.host) socket.connectToServer();
  else { state.forbidden.push(`WEBSOCKET ${socket.url()}`); socket.close(); }
});

const panel = () => page.getByRole('complementary', { name: 'Diagram preview', exact: true });
const board = () => page.getByLabel('Whiteboard canvas', { exact: true });
const idea = () => panel().getByLabel('Describe your idea', { exact: true });
const feedback = () => panel().getByLabel('What should change?', { exact: true });
const refine = () => panel().getByRole('button', { name: 'Refine preview', exact: true });
const previous = () => panel().getByRole('button', { name: 'Use previous preview', exact: true });
const previewId = () => panel().getAttribute('data-preview-id');
async function until(predicate, message, timeout = 20_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 60));
  }
  throw new Error(message);
}
async function status(value) {
  await until(async () => await panel().getAttribute('data-preview-status') === value, `Preview did not enter ${value}`);
  assert(await panel().getByRole('button', { name: 'Create diagram', exact: true }).isDisabled(), 'Refinement must not create an official diagram');
}
async function start({ refine: isRefine = false, sample = 'ready' } = {}) {
  state.next = sample;
  const before = state.requests.length;
  if (!isRefine) await setIdeaExpanded(true);
  await (isRefine ? refine() : panel().getByRole('button', { name: /^(?:Generate preview|Generate from drawing)$/, exact: true })).click();
  await status('loading');
  await until(() => state.requests.length === before + 1, 'No synthetic preview request');
  return state.requests.at(-1);
}
async function setIdeaExpanded(expanded) {
  const composer = panel().locator('details').filter({ has: page.getByText('Idea & new preview', { exact: true }) });
  if (await composer.count() && (await composer.getAttribute('open') !== null) !== expanded) await composer.locator(':scope > summary').click();
}
async function restore(id) {
  await previous().click(); await status('ready');
  assert.equal(await previewId(), id, 'Wrong selected preview restored');
}
const pixels = () => board().evaluate((canvas) => canvas.toDataURL('image/png'));
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
  await page.goto(new URL(`/editor/${whiteboard.id}`, base).href, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await board().waitFor({ state: 'visible' }); await idea().waitFor({ state: 'visible' }); await status('idle');
  await panel().getByText('Ideas for different kinds of drawings', { exact: true }).click();
  for (const kind of ['UML:', 'System architecture:', 'Room layout:', 'Physics:', 'Travel route:'])
    await panel().getByText(kind, { exact: false }).waitFor({ state: 'visible' });
  await panel().getByText('Ideas for different kinds of drawings', { exact: true }).click();
  assert.equal(await idea().getAttribute('maxlength'), '4000');
  const box = await board().boundingBox(); assert(box);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 40, { steps: 8 }); await page.mouse.up();
  await until(async () => !(await page.getByRole('button', { name: 'Undo (Ctrl+Z)', exact: true }).isDisabled()), 'Synthetic sketch was not drawn');
  const drawing = await pixels();
  const description = 'Architecture design: the sketch connects a Web App to an API. Keep the database private.\nRelevant code: if (!authorized) return 401;';
  await idea().fill(description); await idea().pressSequentially(' pstr');
  assert.equal(await pixels(), drawing, 'Typing instructions changed the sketch');
  const first = await start(); await status('ready');
  const firstId = await previewId();
  assert.equal(first.hint, `${description} pstr`); assert(!('basePreviewId' in first));
  for (const height of [960, 768]) {
    await page.setViewportSize({ width: 1366, height });
    await until(canvasFullyVisible, `New successful preview is hidden by its inputs at 1366x${height}`);
    await page.screenshot({ path: path.join(output, `desktop-${height}-default-success.png`) });
  }
  await page.setViewportSize({ width: 1440, height: 960 });
  await panel().getByRole('button', { name: 'Request changes', exact: true }).click();
  assert(await feedback().evaluate((element) => element === document.activeElement), 'Request changes must focus the feedback form');
  assert.equal(await feedback().getAttribute('maxlength'), '2000');
  assert(await refine().isDisabled()); await feedback().fill('   '); assert(await refine().isDisabled());
  assert.equal(await previous().count(), 0);
  console.log('PASS cross-domain examples; sketch + optional code/description; no whiteboard mutations; feedback required');

  const change = 'Add the missing API-to-database connection; preserve the Web App and current layout.';
  await feedback().fill(change);
  const failed = await start({ refine: true, sample: 'failed' }); await status('error');
  assert.equal(failed.basePreviewId, firstId); assert.equal(failed.feedback, change);
  assert.equal(await feedback().inputValue(), change); assert(await refine().isDisabled());
  await restore(firstId);
  const retry = await start({ refine: true }); await status('ready');
  assert.equal(retry.basePreviewId, firstId); assert.notEqual(retry.clientRequestId, failed.clientRequestId);
  assert.equal(await feedback().inputValue(), '');
  const refinedId = await previewId(); assert.notEqual(refinedId, firstId);
  await panel().getByText('Instructions used for this preview', { exact: true }).click();
  await panel().getByText(change, { exact: true }).waitFor();
  await panel().getByText('Instructions used for this preview', { exact: true }).click();
  console.log('PASS failed refinement keeps feedback and restorable base; explicit retry uses same selected base; ready result records submitted instructions');

  await restore(firstId);
  await feedback().fill('Rename the API to Gateway. Keep all connections.');
  const alternate = await start({ refine: true, sample: 'slow' });
  assert.equal(alternate.basePreviewId, firstId, 'Refine used newest result instead of the preview on screen');
  const nextDescription = 'Architecture design: also explain the private network boundary in the next request.';
  await setIdeaExpanded(true);
  await idea().fill(nextDescription);
  const nextFeedback = 'Now label the private network boundary.';
  await feedback().fill(nextFeedback); await status('ready');
  const alternateId = await previewId();
  assert.equal(await feedback().inputValue(), nextFeedback, 'Success erased newer unsent feedback');
  assert.equal(await idea().inputValue(), nextDescription, 'Success erased a newer idea description');
  assert(await idea().isVisible(), 'Success collapsed the composer despite in-flight description edits');
  assert.notEqual(alternate.hint, nextDescription, 'In-flight typing mutated the captured request');
  await setIdeaExpanded(false);
  console.log('PASS selected older preview, not newest result, is the refinement base; in-flight feedback and visible idea edits survive');

  const cancelled = await start({ refine: true, sample: 'slow' });
  await panel().getByRole('button', { name: 'Cancel preview', exact: true }).click(); await status('idle');
  await until(() => state.cancelled.includes(cancelled.clientRequestId), 'Cancel did not use the captured request ID');
  assert.equal(await feedback().inputValue(), nextFeedback);
  await restore(alternateId);
  await page.waitForTimeout(1900);
  assert.equal(await previewId(), alternateId, 'Cancelled late completion replaced the restored preview');
  const recovered = await start({ refine: true, sample: 'lost-response' }); await status('ready');
  assert.equal(recovered.basePreviewId, alternateId);
  assert(state.recovered.includes(recovered.clientRequestId));
  assert.equal(state.requests.filter((item) => item.clientRequestId === recovered.clientRequestId).length, 1);
  console.log('PASS cancel retains feedback/base and discards late completion; lost-response recovery is GET-only');

  await feedback().fill('Unsubmitted feedback must not leak into a fresh attempt.');
  await setIdeaExpanded(true);
  await idea().fill('Travel route design: keep the handwritten stop names and connect them in order.');
  await panel().getByText(/Your drawing or description has changed/).waitFor();
  const fresh = await start(); await status('ready');
  assert(!('basePreviewId' in fresh)); assert(!('feedback' in fresh));
  assert.match(fresh.hint, /^Travel route design:/);
  assert.equal(await pixels(), drawing, 'Generating or refining changed the original painting');
  assert.equal(fresh.image, first.image, 'An unchanged sketch produced a changed frozen source');
  await setIdeaExpanded(true);
  await idea().scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(output, 'sketch-intent-refinement.png') });
  for (const height of [768, 650]) {
    await page.setViewportSize({ width: 1366, height });
    await setIdeaExpanded(true);
    await idea().scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(output, `desktop-${height}-instructions.png`) });
    await setIdeaExpanded(false);
    const canvas = panel().getByTestId('diagram-preview-canvas');
    await canvas.scrollIntoViewIfNeeded();
    await panel().getByRole('button', { name: 'Fit preview', exact: true }).click();
    await until(canvasFullyVisible, `Preview canvas cannot be fully reviewed at 1366x${height}`);
    await page.screenshot({ path: path.join(output, `desktop-${height}-review.png`) });
  }
  await page.setViewportSize({ width: 800, height: 880 });
  await page.getByRole('tab', { name: 'Preview', exact: true }).click();
  await feedback().waitFor({ state: 'visible' });
  await feedback().fill('Keep the first stop at the top.'); assert(await refine().isEnabled());
  await page.screenshot({ path: path.join(output, 'narrow-refinement.png') });
  await page.setViewportSize({ width: 1440, height: 960 });
  await start({ sample: 'legacy' }); await status('ready');
  await feedback().fill('This must not dispatch refinement to a legacy backend.');
  assert(await refine().isDisabled(), 'An old backend without refinement capability must not silently regenerate');
  console.log('PASS missing server refinement capability disables Refine instead of silently starting fresh');
  assert.deepEqual(state.forbidden, [], 'Unexpected external request or real API write');
  assert.deepEqual(state.errors, [], 'Browser/runtime or mock-contract errors');
  console.log('PASS fresh generation omits previous context/feedback; responsive preview form; original drawing preserved');
  console.log(`All refinement smoke checks passed (${state.requests.length} mocked attempts, zero live AI/S3 calls). Screenshots: ${output}`);
} catch (error) {
  await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
  console.error(`FAIL: ${error.message}\nBrowser errors: ${JSON.stringify(state.errors)}\nBlocked: ${JSON.stringify(state.forbidden)}\nScreenshots: ${output}`);
  process.exitCode = 1;
} finally {
  clearTimeout(watchdog);
  await browser.close();
}
