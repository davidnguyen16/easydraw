/**
 * Public landing-page browser smoke against an existing LOCAL frontend.
 * Auth/session/list reads are synthetic. Every application write and external
 * request is blocked: no real user data, auth changes, AI, S3 or database calls.
 * Set PLAYWRIGHT_MODULE_PATH to an existing playwright-core installation.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { OrthographicCamera, Vector3 } from 'three';
import { createServer } from 'vite';

const focus = process.env.LANDING_SMOKE_FOCUS;
assert(!focus || ['reduced-motion', 'webgl', 'remaining'].includes(focus), 'Unknown landing smoke focus.');
if (focus) console.log(`Running focused landing checks: ${focus}`);

// The public sample now shares extensionless TypeScript modules with Dashboard.
// Use the installed Vite loader without a listening server, rather than copying
// a second fixture or installing a loader solely for this read-only smoke.
const fixtureLoader = await createServer({ configFile: false,
  root: fileURLToPath(new URL('../client', import.meta.url)),
  server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' });
let fixture;
try { fixture = await fixtureLoader.ssrLoadModule('/src/lib/components/landing/landing-data.ts'); }
finally { await fixtureLoader.close(); }
const { LANDING_EQUIPMENT, LANDING_PAGE, LANDING_SCENE, LANDING_TITLE, LANDING_CAMERA } = fixture;
assert.equal(LANDING_PAGE.nodes.length, 59, 'Expected the complete Dashboard campus, not a miniature replacement.');
assert.equal(LANDING_EQUIPMENT.length, 29);
assert.equal(LANDING_SCENE.edges.length, 13);

const require = createRequire(import.meta.url);
const sharp = require('sharp'); // Already installed with Next; decode QA screenshots only.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright-core');
const base = new URL(process.env.BASE_URL || 'http://localhost:5173');
assert(['localhost', '127.0.0.1', '[::1]'].includes(base.hostname), 'Use only a local frontend.');
const output = process.env.SMOKE_OUTPUT_DIR ? path.resolve(process.env.SMOKE_OUTPUT_DIR)
  : await mkdtemp(path.join(tmpdir(), 'easydraw-landing-smoke-'));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true,
  ...(process.env.BROWSER_EXECUTABLE_PATH ? { executablePath: process.env.BROWSER_EXECUTABLE_PATH } : { channel: 'msedge' }),
  args: ['--renderer-process-limit=1', '--disable-background-networking', '--enable-webgl', '--enable-unsafe-swiftshader'] });
const sessions = [];
const watchdog = setTimeout(() => { console.error('FAIL: landing smoke exceeded 180 seconds.'); process.exit(1); }, 180_000);

async function until(predicate, message, timeout = 15_000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 60));
  }
  throw new Error(message);
}
async function createSession({ name, user = false, viewport = { width: 1440, height: 1000 }, reducedMotion = false, webgl = true } = {}) {
  const context = await browser.newContext({ viewport, hasTouch: viewport.width < 600,
    reducedMotion: reducedMotion ? 'reduce' : 'no-preference', serviceWorkers: 'block' });
  const state = { name, context, page: await context.newPage(), sockets: new Set(), errors: [], forbidden: [], reads: [],
    expectedUnauthorized: 0, unauthorized: 0, closed: false };
  sessions.push(state);
  const page = state.page;
  page.setDefaultTimeout(15_000); page.setDefaultNavigationTimeout(45_000);
  if (!webgl) await context.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
      if (['webgl', 'webgl2', 'experimental-webgl'].includes(kind)) return null;
      return original.call(this, kind, ...args);
    };
  });
  page.on('pageerror', (error) => state.errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    if (state.unauthorized < state.expectedUnauthorized && /\/auth\/me$/.test(message.location().url ?? '') &&
      /Failed to load resource:.*401/.test(message.text())) state.unauthorized++;
    else state.errors.push(message.text());
  });
  await context.route('**/*', async (route) => {
    const request = route.request(), url = new URL(request.url()), method = request.method();
    const api = /^\/(?:api\/)?(?:auth|diagrams|diagram-previews|node-library|object-library|templates)(?:\/|$)/.test(url.pathname);
    const headers = { 'access-control-allow-origin': base.origin, 'access-control-allow-credentials': 'true',
      'access-control-allow-methods': 'GET, OPTIONS', 'access-control-allow-headers': 'content-type' };
    const reply = (json, status = 200) => route.fulfill({ status, headers, ...(status === 204 ? {} : { json }) });
    if (api && method === 'OPTIONS') return reply(undefined, 204);
    if (api && method === 'GET') {
      state.reads.push(url.pathname);
      if (url.pathname.endsWith('/auth/me')) {
        if (!user) state.expectedUnauthorized++;
        return reply(user ? { id: 'landing-smoke-owner', email: 'landing@example.invalid', name: 'Landing Visitor' }
          : { message: 'Synthetic guest' }, user ? 200 : 401);
      }
      if (/^\/(?:api\/)?(?:diagrams|templates)$/.test(url.pathname)) return reply([]);
    }
    if (url.origin === base.origin && method === 'POST' && url.pathname === '/__nextjs_original-stack-frames') return route.continue();
    if (url.origin === base.origin && ['GET', 'HEAD'].includes(method) && !api) return route.continue();
    state.forbidden.push(`${method} ${url.origin}${url.pathname}`); return route.abort('blockedbyclient');
  });
  if (context.routeWebSocket) await context.routeWebSocket('**/*', (socket) => {
    if (new URL(socket.url()).host === base.host) { state.sockets.add(socket); state.sockets.add(socket.connectToServer()); }
    else { state.forbidden.push(`WEBSOCKET ${socket.url()}`); void socket.close(); }
  });
  await page.goto(new URL('/', base).href, { waitUntil: 'domcontentloaded' });
  await page.locator('main h1').waitFor();
  // Next's development badge occupies the same top-right corner as the mobile
  // navigation. It is not shipped in production; hide only this dev portal in
  // the isolated test page. Runtime/console errors still fail the suite.
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
  await until(() => state.reads.some((item) => item.endsWith('/auth/me')), 'Home did not check the synthetic session.');
  return state;
}
async function assertNoOverflow(page, location) {
  const dimensions = await page.evaluate(() => ({ viewport: innerWidth,
    document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
  assert(dimensions.document <= dimensions.viewport + 1 && dimensions.body <= dimensions.viewport + 1,
    `${location} overflows horizontally: ${JSON.stringify(dimensions)}`);
}
async function assertLinksAndAnchors(page) {
  const links = await page.locator('a[href]').evaluateAll((elements) => elements.map((element) => ({
    href: element.getAttribute('href'), text: element.textContent?.trim(),
  })));
  assert(links.some(({ href }) => href === '/terms'), 'Terms link is missing.');
  assert(links.some(({ href }) => href === '/privacy'), 'Privacy link is missing.');
  for (const { href } of links.filter(({ href }) => href.startsWith('#'))) {
    assert(href.length > 1, 'Placeholder # link has no destination.');
    assert.equal(await page.locator(`[id="${href.slice(1)}"]`).count(), 1, `Anchor target ${href} is missing or duplicated.`);
  }
}
async function assertSafe(state) {
  assert.deepEqual(state.forbidden, [], `${state.name} attempted a real/external API call.`);
  assert.deepEqual(state.errors, [], `${state.name} has unexpected browser errors.`);
}
async function closeSession(state) {
  if (state.closed) return;
  // An HMR socket may stop acknowledging close when its page is navigating.
  // Do not let its handshake prevent context.close from releasing that page.
  let socketDeadline;
  await Promise.race([Promise.allSettled([...state.sockets].map((socket) => socket.close())),
    new Promise((resolve) => { socketDeadline = setTimeout(resolve, 2_000); })]);
  clearTimeout(socketDeadline);
  await state.context.close(); state.closed = true;
}
const canvasPixels = async (canvas, screenshotPath) => createHash('sha256').update(await canvas.screenshot(
  screenshotPath ? { path: screenshotPath } : undefined)).digest('hex');

async function checkGuestNavigation(state) {
  const { page } = state;
  assert.equal(await page.locator('main h1').count(), 1);
  await page.locator('header a[href="/register"]').waitFor();
  assert(await page.locator('header a[href="/login"]:visible').isVisible());
  await assertLinksAndAnchors(page);
  for (const href of await page.locator('header nav:visible a[href^="#"]').evaluateAll((links) => links.map((link) => link.getAttribute('href')))) {
    await page.locator(`header nav:visible a[href="${href}"]`).click();
    await until(() => new URL(page.url()).hash === href, `Navigation did not activate ${href}.`);
    await until(async () => {
      const target = await page.locator(`[id="${href.slice(1)}"]`).boundingBox();
      const header = await page.locator('header').boundingBox();
      return target && header && target.y >= header.height - 2 && target.y < (page.viewportSize()?.height ?? 1000);
    }, `${href} heading is hidden behind the sticky navigation.`);
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await assertNoOverflow(page, 'Desktop guest home');
}

async function checkMobileNavigation(state) {
  const { page } = state;
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  const open = page.getByRole('button', { name: 'Open navigation', exact: true });
  await open.waitFor(); assert.equal(await open.getAttribute('aria-expanded'), 'false');
  await open.focus(); await page.keyboard.press('Enter');
  const close = page.getByRole('button', { name: 'Close navigation', exact: true });
  assert.equal(await close.getAttribute('aria-expanded'), 'true');
  await page.keyboard.press('Escape');
  await open.waitFor();
  assert(await open.evaluate((element) => document.activeElement === element), 'Escape must restore navigation-trigger focus.');
  await open.click();
  await page.locator('#landing-mobile-navigation').getByRole('link', { name: 'Workspace', exact: true }).click();
  await open.waitFor(); assert.equal(await open.getAttribute('aria-expanded'), 'false');
  await assertNoOverflow(page, 'Mobile navigation and anchor destination');
}

const showcase = (page) => page.getByTestId('landing-showcase');
const scene = (page) => page.getByTestId('landing-data-centre-scene');
const plan = (page) => page.getByTestId('landing-data-centre-plan');
const mode = (page, dimension) => showcase(page).getByRole('button', { name: dimension, exact: true });
async function readyScene(page) {
  await showcase(page).scrollIntoViewIfNeeded();
  await scene(page).waitFor();
  const canvas = scene(page).locator('canvas');
  await until(async () => await canvas.getAttribute('data-render-ready') === 'true', '3D sample did not render its first frame.');
  assert.equal(await scene(page).getAttribute('data-equipment-count'), String(LANDING_EQUIPMENT.length));
  assert.equal(await scene(page).getAttribute('data-node-count'), String(LANDING_SCENE.nodes.length));
  assert.equal(await scene(page).getAttribute('data-edge-count'), String(LANDING_SCENE.edges.length));
  await showcase(page).getByRole('heading', { name: LANDING_TITLE, exact: true }).waitFor();
  return canvas;
}
async function assertFullCampusPlan(page) {
  const svg = plan(page);
  assert.equal(await svg.getAttribute('data-node-count'), String(LANDING_PAGE.nodes.length));
  assert.equal(await svg.getAttribute('data-edge-count'), String(LANDING_SCENE.edges.length));
  assert.equal(await svg.getAttribute('data-source-title'), LANDING_TITLE);
  const rendered = await svg.locator('[data-node-id]').evaluateAll((nodes) => nodes.map((node) => ({
    id: node.dataset.nodeId, type: node.dataset.nodeType, role: node.dataset.nodeRole,
    x: Number(node.dataset.nodeX), y: Number(node.dataset.nodeY),
    width: Number(node.dataset.nodeWidth), height: Number(node.dataset.nodeHeight),
    label: node.querySelector('text')?.textContent ?? '',
    fill: node.querySelector('rect')?.getAttribute('fill') ?? null,
  })));
  assert.equal(rendered.length, LANDING_PAGE.nodes.length);
  assert.equal(new Set(rendered.map((node) => node.id)).size, LANDING_PAGE.nodes.length);
  for (const source of LANDING_PAGE.nodes) {
    const actual = rendered.find((node) => node.id === source.id);
    assert.deepEqual(actual, { id: source.id, type: source.type,
      role: LANDING_EQUIPMENT.some((node) => node.id === source.id) ? 'equipment' : source.type === 'TextNode' ? 'label' : 'structure',
      x: source.position.x, y: source.position.y, width: source.width ?? source.style?.width ?? 100,
      height: source.height ?? source.style?.height ?? 100,
      label: typeof source.data.label === 'string' ? source.data.label.replaceAll('\n', '') : '',
      fill: source.type === 'TextNode' ? null : source.data.fillColor ?? '#fff',
    }, `The 2D plan changed or omitted source node ${source.id}.`);
  }
  const edges = await svg.locator('[data-edge-id]').evaluateAll((paths) => paths.map((edge) => ({
    id: edge.dataset.edgeId, source: edge.dataset.edgeSource, target: edge.dataset.edgeTarget,
    path: edge.getAttribute('d'), color: edge.getAttribute('stroke'),
  })));
  assert.equal(edges.length, LANDING_SCENE.edges.length);
  for (const edge of LANDING_SCENE.edges) {
    const original = LANDING_PAGE.edges.find((item) => item.id === edge.id);
    assert.deepEqual(edges.find((item) => item.id === edge.id), { id: edge.id, source: original.source,
      target: original.target, color: edge.color,
      path: edge.points.map((point, index) => `${index ? 'L' : 'M'}${(point[0] + LANDING_SCENE.origin[0]) * 100} ${(point[2] + LANDING_SCENE.origin[2]) * 100}`).join(' '),
    }, `The 2D plan changed the Dashboard connection ${edge.id}.`);
  }
  assert.equal(await svg.getByRole('button').count(), LANDING_EQUIPMENT.length);
}
const cameraPosition = async (canvas) => JSON.parse(await canvas.getAttribute('data-camera-position'));
const distance = (a, b) => Math.hypot(...a.map((value, index) => value - b[index]));
async function clickEquipment(page, id) {
  const equipment = LANDING_EQUIPMENT.find((item) => item.id === id); assert(equipment);
  const canvas = await readyScene(page);
  await canvas.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const bounds = await canvas.boundingBox(); assert(bounds);
  const camera = new OrthographicCamera(-bounds.width / 2, bounds.width / 2, bounds.height / 2, -bounds.height / 2, 0.1, 200);
  camera.position.fromArray(await cameraPosition(canvas));
  camera.zoom = Number(await canvas.getAttribute('data-camera-zoom'));
  assert(camera.zoom > 0, 'Scene must expose its actual fitted zoom for pointer projection.');
  camera.lookAt(new Vector3(...JSON.parse(await canvas.getAttribute('data-camera-target'))));
  camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
  // Project the solid equipment's world-space centre using the actual camera;
  // this is a real pointer raycast, not an injected React selection callback.
  const point = new Vector3(...equipment.position).project(camera);
  await page.mouse.click(bounds.x + (point.x + 1) * bounds.width / 2, bounds.y + (1 - point.y) * bounds.height / 2);
  return equipment;
}
async function inspectDesktopScene(state) {
  const { page } = state;
  let canvas = await readyScene(page);
  assert.equal(await showcase(page).getAttribute('data-view'), '3d');
  await until(async () => await scene(page).getAttribute('data-autorotate') === 'true', 'Visible 3D sample does not rotate.');
  await showcase(page).getByRole('button', { name: 'Pause rotation', exact: true }).click();
  await until(async () => await scene(page).getAttribute('data-autorotate') === 'false', 'Pause did not stop sample motion.');
  await showcase(page).getByRole('button', { name: 'Reset view', exact: true }).click();
  canvas = await readyScene(page);
  const initial = await cameraPosition(canvas), initialPixels = await canvasPixels(canvas);
  assert(distance(initial, LANDING_CAMERA.position) < 0.001, 'Reset did not preserve the Dashboard sample camera.');
  const box = await canvas.boundingBox(); assert(box && box.width > 200 && box.height > 200);
  await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.58); await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.74, box.y + box.height * 0.5, { steps: 12 }); await page.mouse.up();
  await until(async () => distance(await cameraPosition(canvas), initial) > 0.5, 'Dragging did not orbit the actual 3D camera.');
  assert.notEqual(await canvasPixels(canvas), initialPixels, '3D orbit did not change rendered pixels.');
  await page.screenshot({ path: path.join(output, 'desktop-3d-orbit.png') });
  await showcase(page).getByRole('button', { name: 'Reset view', exact: true }).click();
  canvas = await readyScene(page);
  await until(async () => distance(await cameraPosition(canvas), initial) < 0.001, 'Reset did not restore the default camera.');
  const wheelBounds = await canvas.boundingBox(); assert(wheelBounds);
  await page.mouse.move(wheelBounds.x + wheelBounds.width / 2, wheelBounds.y + wheelBounds.height / 2);
  const scrollBefore = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, 180);
  await until(async () => await page.evaluate(() => window.scrollY) > scrollBefore + 20, '3D canvas captured normal page-wheel scrolling.');
  await showcase(page).scrollIntoViewIfNeeded();
  await showcase(page).getByRole('button', { name: 'Start rotation', exact: true }).click();
  await until(async () => await scene(page).getAttribute('data-autorotate') === 'true', 'Start rotation did not resume motion.');
  await until(async () => distance(await cameraPosition(canvas), initial) > 0.01, 'Autorotation did not change the camera.');
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
  await until(async () => await scene(page).getAttribute('data-autorotate') === 'false', 'Off-screen sample kept auto-rotating.');
  await showcase(page).scrollIntoViewIfNeeded();
  await until(async () => await scene(page).getAttribute('data-autorotate') === 'true', 'Visible sample did not resume its selected rotation mode.');
  await showcase(page).getByRole('button', { name: 'Pause rotation', exact: true }).click();
  await mode(page, '2D').click();
  await plan(page).waitFor();
  assert.equal(await mode(page, '2D').getAttribute('aria-pressed'), 'true');
  assert.equal(await scene(page).count(), 0, '2D mode must release the hidden 3D canvas.');
  await assertFullCampusPlan(page);
  const devices = plan(page).getByRole('button');
  assert.equal(await devices.count(), LANDING_EQUIPMENT.length, '2D plan does not share the 3D sample equipment.');
  await devices.first().focus(); await page.keyboard.press('Enter');
  assert.equal(await devices.first().getAttribute('aria-pressed'), 'true', '2D equipment cannot be inspected by keyboard.');
  await page.screenshot({ path: path.join(output, 'desktop-2d-plan.png') });
  await showcase(page).getByRole('button', { name: 'Demo instructions', exact: true }).click();
  await showcase(page).getByRole('note').waitFor();
  assert.match(await showcase(page).getByRole('note').textContent(), /doesn.t create or change a saved diagram/);
  await showcase(page).getByRole('button', { name: /^Got it/ }).click();
  await mode(page, '3D').click(); await readyScene(page);
  const expand = showcase(page).getByRole('button', { name: 'Expand demo', exact: true });
  await expand.click();
  const dialog = page.getByRole('dialog', { name: 'Interactive data centre demo', exact: true });
  await dialog.waitFor();
  assert.equal(await dialog.getAttribute('aria-modal'), 'true');
  const modalLayer = await dialog.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const headerBounds = document.querySelector('header').getBoundingClientRect();
    const overlapY = Math.max(bounds.top + 8, headerBounds.top + 8);
    const overlapHit = document.elementFromPoint(bounds.left + 40, overlapY);
    const backdropHit = document.elementFromPoint(8, 8);
    const backdropBounds = backdropHit?.getBoundingClientRect();
    return {
      position: getComputedStyle(element).position,
      fillsViewport: bounds.width >= innerWidth * 0.85 && bounds.height >= innerHeight * 0.85,
      overlapsHeader: overlapY < headerBounds.bottom,
      aboveHeader: overlapHit === element || element.contains(overlapHit),
      backdropAboveHeader: backdropHit && !backdropHit.closest('header') &&
        getComputedStyle(backdropHit).position === 'fixed' &&
        backdropBounds.left === 0 && backdropBounds.top === 0 &&
        backdropBounds.right === innerWidth && backdropBounds.bottom === innerHeight,
    };
  });
  assert.equal(modalLayer.position, 'fixed', 'Expanded demo must use viewport positioning.');
  assert(modalLayer.fillsViewport, 'Expanded demo did not expand to the viewport.');
  assert(modalLayer.overlapsHeader && modalLayer.aboveHeader, 'Frosted navigation is layered over the expanded demo.');
  assert(modalLayer.backdropAboveHeader, 'Expanded demo backdrop does not cover the sticky navigation.');
  const inspected = await clickEquipment(page, 'storage-01');
  await dialog.getByText(`${inspected.label} · ${inspected.zone}`, { exact: true }).waitFor();
  await page.screenshot({ path: path.join(output, 'desktop-expanded-3d-inspect.png') });
  const firstControl = dialog.getByRole('button').first(), lastControl = dialog.getByRole('button').last();
  await lastControl.focus(); await page.keyboard.press('Tab');
  assert(await firstControl.evaluate((element) => document.activeElement === element), 'Tab escaped the expanded demo.');
  await page.keyboard.press('Shift+Tab');
  assert(await lastControl.evaluate((element) => document.activeElement === element), 'Shift+Tab escaped the expanded demo.');
  await page.keyboard.press('Escape');
  await expand.waitFor();
  await until(async () => await expand.evaluate((element) => document.activeElement === element), 'Closing expanded demo did not restore trigger focus.');
  assert.equal(await page.evaluate(() => document.body.style.overflow), '', 'Expanded demo left document scrolling locked.');
  await assertNoOverflow(page, 'Interactive desktop scene');
}

try {
  if (!focus) {
  const desktop = await createSession({ name: 'desktop-guest' });
  await checkGuestNavigation(desktop);
  await readyScene(desktop.page);
  await desktop.page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await desktop.page.screenshot({ path: path.join(output, 'desktop-home.png') });
  await desktop.page.screenshot({ path: path.join(output, 'desktop-full-page.png'), fullPage: true });
  console.log(`Desktop design screenshots ready: ${output}`);
  await inspectDesktopScene(desktop);
  await desktop.page.locator('header a[href="/login"]:visible').click();
  await desktop.page.getByRole('heading', { name: 'Start designing your diagrams', exact: true }).waitFor({ timeout: 45_000 });
  assert.equal(new URL(desktop.page.url()).pathname, '/login');
  await assertSafe(desktop); await closeSession(desktop);
  console.log('PASS desktop guest navigation/anchors; actual3D orbit/pause/start/reset/offscreen gating; shared2D plan; keyboard selection/help/expanded dialog; real login link.');

  const mobile = await createSession({ name: 'mobile-guest', viewport: { width: 390, height: 844 } });
  await checkMobileNavigation(mobile);
  await readyScene(mobile.page);
  await mobile.page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await mobile.page.screenshot({ path: path.join(output, 'mobile-home.png') });
  const mobileCanvas = await readyScene(mobile.page);
  await mobile.page.screenshot({ path: path.join(output, 'mobile-playground.png') });
  const touchPolicies = await mobileCanvas.evaluate((canvas) => {
    const values = [];
    for (let node = canvas; node; node = node.parentElement) values.push(getComputedStyle(node).touchAction);
    return values;
  });
  assert(touchPolicies.includes('pan-y') && !touchPolicies.includes('none'),
    `Canvas/ancestor touch policy prevents vertical scrolling: ${touchPolicies.join(', ')}`);
  const touchBounds = await mobileCanvas.boundingBox(); assert(touchBounds);
  const touchX = touchBounds.x + touchBounds.width / 2;
  const touchY = Math.min(touchBounds.y + touchBounds.height - 20, mobile.page.viewportSize().height - 80);
  const touchScrollBefore = await mobile.page.evaluate(() => window.scrollY);
  const mobileProtocol = await mobile.context.newCDPSession(mobile.page);
  await mobileProtocol.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: touchX, y: touchY }] });
  for (let step = 1; step <= 10; step++) {
    await mobileProtocol.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: touchX, y: touchY - step * 16 }] });
    await new Promise((resolve) => setTimeout(resolve, 16));
  }
  await mobileProtocol.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await until(async () => await mobile.page.evaluate(() => window.scrollY) > touchScrollBefore + 30,
    'Swiping over the mobile 3D scene did not scroll the page.');
  await mobileProtocol.detach();
  await readyScene(mobile.page);
  await assertNoOverflow(mobile.page, '390px sample');
  await mode(mobile.page, '2D').click(); await plan(mobile.page).waitFor();
  await assertFullCampusPlan(mobile.page);
  await mobile.page.locator('footer').scrollIntoViewIfNeeded();
  await assertNoOverflow(mobile.page, 'Mobile footer');
  await mobile.page.screenshot({ path: path.join(output, 'mobile-footer.png') });
  await mobile.page.locator('header a[href="/register"]').click();
  await mobile.page.getByRole('heading', { name: 'Create your account', exact: true }).waitFor({ timeout: 45_000 });
  assert.equal(new URL(mobile.page.url()).pathname, '/register');
  await assertSafe(mobile); await closeSession(mobile);
  console.log('PASS 390px guest home/menu/keyboard/anchors; real canvas touch scrolling; full-campus 2D+3D/footer without horizontal overflow; CTA opens registration without a write.');

  const member = await createSession({ name: 'signed-in', user: true });
  const account = member.page.getByRole('button', { name: 'Account menu', exact: true });
  await account.waitFor();
  assert.equal(await member.page.locator('header a[href="/register"]').count(), 0);
  assert.equal(await member.page.locator('#workspace a[href="/dashboard/diagrams"]').count(), 1);
  assert.equal(await member.page.locator('#workspace a[href="/dashboard/whiteboards"]').count(), 1);
  await account.focus(); await member.page.keyboard.press('ArrowDown');
  const menu = member.page.getByRole('menu', { name: 'Your account', exact: true }); await menu.waitFor();
  await until(async () => await menu.getByRole('menuitem', { name: 'Dashboard', exact: true }).evaluate((element) => document.activeElement === element), 'Account menu did not focus its first item.');
  await member.page.keyboard.press('End');
  assert(await menu.getByRole('menuitem', { name: 'Log out', exact: true }).evaluate((element) => document.activeElement === element));
  await member.page.keyboard.press('Home');
  assert(await menu.getByRole('menuitem', { name: 'Dashboard', exact: true }).evaluate((element) => document.activeElement === element));
  await member.page.keyboard.press('Escape');
  assert(await account.evaluate((element) => document.activeElement === element));
  await member.page.setViewportSize({ width: 390, height: 844 });
  await checkMobileNavigation(member); await assertNoOverflow(member.page, 'Signed-in390px navigation');
  await member.page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await member.page.screenshot({ path: path.join(output, 'mobile-signed-in.png') });
  await member.page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await member.page.locator('#landing-mobile-navigation').getByRole('link', { name: 'Open workspace', exact: true }).click();
  await member.page.getByRole('heading', { name: 'What would you like to work on?', exact: true }).waitFor({ timeout: 45_000 });
  assert.equal(new URL(member.page.url()).pathname, '/dashboard');
  await assertSafe(member); await closeSession(member);
  console.log('PASS signed-in CTAs/workspace links, accessible account menu, mobile header and dashboard navigation; no real auth mutations.');
  }

  if (focus !== 'webgl') {
  const reduced = await createSession({ name: 'reduced-motion', reducedMotion: true });
  const gradientMotion = await reduced.page.locator('#home-main').evaluate((main) => {
    const gradient = getComputedStyle(main.parentElement, '::before');
    return { animationName: gradient.animationName, animationDuration: gradient.animationDuration };
  });
  assert.equal(gradientMotion.animationName, 'none', 'Reduced-motion preference must stop the aurora gradient animation.');
  assert(gradientMotion.animationDuration.split(',').every((duration) => parseFloat(duration) === 0),
    'Reduced-motion aurora gradient still has an animation duration.');
  const reducedCanvas = await readyScene(reduced.page);
  assert.equal(await scene(reduced.page).getAttribute('data-autorotate'), 'false');
  assert(await showcase(reduced.page).getByRole('button', { name: 'Pause rotation', exact: true }).isDisabled());
  await reduced.page.evaluate(() => document.fonts.ready);
  await until(async () => await showcase(reduced.page).getByText('Preparing your 3D perspective…', { exact: true }).count() === 0,
    'Reduced-motion scene never completed its initial loading state.');
  // The first frame can precede font/ResizeObserver layout and the one-off
  // shadow-map update. Permit only a bounded initial settle, then require
  // several naturally static frames (do not disable CSS animations in QA).
  // Capture a fixed integer rectangle without locator-induced autoscroll.
  // Chromium/SwiftShader still alternates background quantization by 1/255 on
  // ~0.22% of pixels. Bound that measured noise to <=1/255 on <=0.5%; camera,
  // zoom and bounds remain exact. Do not disable animations or mask the model.
  const reducedBounds = await reducedCanvas.boundingBox(); assert(reducedBounds);
  const reducedCamera = await cameraPosition(reducedCanvas);
  const reducedZoom = await reducedCanvas.getAttribute('data-camera-zoom');
  const reducedClip = { x: Math.ceil(reducedBounds.x), y: Math.ceil(reducedBounds.y),
    width: Math.floor(reducedBounds.x + reducedBounds.width) - Math.ceil(reducedBounds.x),
    height: Math.floor(reducedBounds.y + reducedBounds.height) - Math.ceil(reducedBounds.y) };
  const reducedPixels = async (screenshotPath) => {
    const png = await reduced.page.screenshot({ clip: reducedClip, ...(screenshotPath ? { path: screenshotPath } : {}) });
    const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height, hash: createHash('sha256').update(data).digest('hex') };
  };
  const staticDifference = (before, after) => {
    assert.equal(after.width, before.width); assert.equal(after.height, before.height);
    let changed = 0, maxChannelDelta = 0;
    for (let pixel = 0; pixel < before.data.length; pixel += 4) {
      let delta = 0;
      for (let channel = 0; channel < 4; channel++) delta = Math.max(delta,
        Math.abs(before.data[pixel + channel] - after.data[pixel + channel]));
      if (delta) changed++;
      maxChannelDelta = Math.max(maxChannelDelta, delta);
    }
    const fraction = changed / (before.width * before.height);
    return { changed, fraction, maxChannelDelta, static: maxChannelDelta <= 1 && fraction <= 0.005 };
  };
  let settledPixels = await reducedPixels();
  let stableSamples = 0;
  let settleSample = 0;
  const settleStarted = Date.now();
  await until(async () => {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const screenshotStarted = Date.now();
    const pixels = await reducedPixels(focus
      ? path.join(output, `reduced-frame-${settleSample++}.png`) : undefined);
    const difference = staticDifference(settledPixels, pixels);
    assert.deepEqual(await cameraPosition(reducedCanvas), reducedCamera, 'Reduced-motion camera changed.');
    assert.equal(await reducedCanvas.getAttribute('data-camera-zoom'), reducedZoom, 'Reduced-motion zoom changed.');
    assert.deepEqual(await reducedCanvas.boundingBox(), reducedBounds, 'Reduced-motion canvas bounds changed.');
    if (focus) console.log(JSON.stringify({
      frame: settleSample, screenshotMs: Date.now() - screenshotStarted, elapsedMs: Date.now() - settleStarted,
      pixels: pixels.hash, difference, camera: await cameraPosition(reducedCanvas),
      zoom: await reducedCanvas.getAttribute('data-camera-zoom'), bounds: await reducedCanvas.boundingBox(),
    }));
    stableSamples = difference.static ? stableSamples + 1 : 0;
    settledPixels = pixels;
    return stableSamples >= 3;
  }, 'Reduced-motion scene did not settle to naturally static rendered pixels.', 5_000);
  const still = await cameraPosition(reducedCanvas), stillPixels = await reducedPixels();
  await new Promise((resolve) => setTimeout(resolve, 350));
  assert.deepEqual(await cameraPosition(reducedCanvas), still, 'Reduced-motion scene moved without input.');
  const finalDifference = staticDifference(stillPixels, await reducedPixels());
  assert(finalDifference.static, `Reduced-motion scene animates without input: ${JSON.stringify(finalDifference)}`);
  assert.equal(await reducedCanvas.getAttribute('data-camera-zoom'), reducedZoom);
  assert.deepEqual(await reducedCanvas.boundingBox(), reducedBounds);
  await reduced.page.screenshot({ path: path.join(output, 'reduced-motion.png') });
  await assertSafe(reduced); await closeSession(reduced);
  console.log('PASS reduced-motion preference keeps3D static and disables automatic rotation.');
  }

  if (focus !== 'reduced-motion') {
  const fallback = await createSession({ name: 'no-webgl', webgl: false });
  await showcase(fallback.page).scrollIntoViewIfNeeded();
  await plan(fallback.page).waitFor();
  await showcase(fallback.page).getByText(/3D isn.t available in this browser/).waitFor();
  assert.equal(await showcase(fallback.page).getAttribute('data-view'), '2d');
  assert(await mode(fallback.page, '3D').isDisabled());
  assert.equal(await scene(fallback.page).count(), 0);
  await assertFullCampusPlan(fallback.page);
  await plan(fallback.page).getByRole('button').first().click();
  assert.equal(await plan(fallback.page).getByRole('button').first().getAttribute('aria-pressed'), 'true');
  await showcase(fallback.page).getByRole('button', { name: 'Retry 3D', exact: true }).click();
  await plan(fallback.page).waitFor();
  await fallback.page.screenshot({ path: path.join(output, 'webgl-unavailable-2d.png') });
  await assertNoOverflow(fallback.page, 'WebGL fallback'); await assertSafe(fallback); await closeSession(fallback);
  console.log('PASS WebGL-unavailable browser receives a usable interactive2D plan without runtime errors.');
  }
  console.log(`${focus ? `Focused ${focus} checks` : 'All landing smoke checks'} passed. No real API writes, cloud assets or paid requests. Screenshots: ${output}`);
} catch (error) {
  console.error(error);
  for (const state of sessions.filter((item) => !item.closed)) {
    console.error(JSON.stringify({ name: state.name, errors: state.errors, forbidden: state.forbidden }));
    await state.page.screenshot({ path: path.join(output, `failure-${state.name}.png`), fullPage: true }).catch(() => {});
  }
  console.error(`Artifacts: ${output}`); process.exitCode = 1;
} finally {
  const cleanupDeadline = setTimeout(() => { console.error('FAIL: own landing browser cleanup exceeded 15 seconds.'); process.exit(1); }, 15_000);
  for (const state of sessions) await closeSession(state);
  await browser.close(); clearTimeout(cleanupDeadline); clearTimeout(watchdog);
}
