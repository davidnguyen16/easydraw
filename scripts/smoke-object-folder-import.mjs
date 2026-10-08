/**
 * Private-library 3D folder import smoke against an already running LOCAL frontend.
 * Auth and every application API are intercepted in memory for a synthetic user.
 * No database, cloud, S3, OpenAI, or real account requests are allowed.
 * Folder selection uses Playwright's native FileChooser with an actual directory.
 *
 * BASE_URL: default http://localhost:5173
 * PLAYWRIGHT_MODULE_PATH: existing playwright-core/playwright package directory
 * BROWSER_EXECUTABLE_PATH: optional installed Chromium/Chrome/Edge executable
 * SMOKE_OUTPUT_DIR: defaults to a fresh OS temporary directory
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright-core');
const base = new URL(process.env.BASE_URL || 'http://localhost:5173');
const localHosts = ['localhost', '127.0.0.1', '[::1]'];
assert(localHosts.includes(base.hostname), 'Use a local frontend only.');
const output = process.env.SMOKE_OUTPUT_DIR ? path.resolve(process.env.SMOKE_OUTPUT_DIR)
  : await mkdtemp(path.join(tmpdir(), 'easydraw-object-folder-smoke-'));
await mkdir(output, { recursive: true });
const fixtureRoot = await mkdtemp(path.join(tmpdir(), 'easydraw-object-folder-fixtures-'));
const folder = path.join(fixtureRoot, 'network-objects');
await mkdir(path.join(folder, 'nested'), { recursive: true });
const recipes = fileURLToPath(new URL('../packages/objects-3d/recipes/', import.meta.url));
const [rackText, serverText, switchText] = await Promise.all([
  readFile(path.join(recipes, 'rack.json'), 'utf8'),
  readFile(path.join(recipes, 'server-1u.json'), 'utf8'),
  readFile(path.join(recipes, 'switch.json'), 'utf8'),
]);
const rack = JSON.parse(rackText), server = JSON.parse(serverText), networkSwitch = JSON.parse(switchText);
await Promise.all([
  writeFile(path.join(folder, '01-rack.json'), rackText),
  writeFile(path.join(folder, '02-server-1u.json'), serverText),
  writeFile(path.join(folder, 'nested', '03-switch.json'), switchText),
  writeFile(path.join(folder, 'nested', '04-rack-repeat.json'), rackText),
  writeFile(path.join(folder, '90-malformed.json'), '{ "name": "Broken JSON", '),
  writeFile(path.join(folder, '91-invalid-recipe.json'), JSON.stringify({ name: 'Invalid recipe', recipe: { version: 999, parts: [] } })),
  writeFile(path.join(folder, 'readme.txt'), 'Ignore this file. Only JSON object files are candidates.'),
]);

const fixtureId = 'folder-smoke';
const sectionId = 'folder-smoke-network';
const sectionName = 'My Network';
const ownerId = 'folder-smoke-owner';
const failureMessage = 'Synthetic switch upload failed. Retry this object.';
const now = new Date().toISOString();
const state = {
  sections: [{ id: sectionId, name: sectionName, sortOrder: 0, nodes: [] }],
  objects: [{ id: 'folder-smoke-existing-server', sectionId, name: server.name, recipe: server.recipe, updatedAt: now }],
  diagram: { id: fixtureId, ownerId, title: 'Folder import smoke', type: 'flowchart', status: 'draft',
    thumbnailAt: null, createdAt: now, updatedAt: now,
    data: { schemaVersion: 1, activePageId: 'main', pages: [{ id: 'main', name: 'Main', nodes: [], edges: [] }] } },
  posts: [], patches: [], requests: [], blocked: [], errors: [], expectedConsoleErrors: [], checks: [],
  authReads: 0, failedPosts: 0, activePosts: 0, maximumActivePosts: 0, confirmed: false,
};
const browser = await chromium.launch({ headless: true,
  ...(process.env.BROWSER_EXECUTABLE_PATH ? { executablePath: process.env.BROWSER_EXECUTABLE_PATH } : { channel: 'msedge' }),
  args: ['--disable-background-networking', '--enable-webgl', '--enable-unsafe-swiftshader'],
});
const watchdog = setTimeout(() => {
  state.errors.push('Object-folder smoke exceeded its 180-second watchdog.');
  process.exitCode = 1;
  void browser.close();
}, 180_000);
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
// A fresh browser-owned, httpOnly session cookie exercises normal fetchMe().
// This is never an existing account cookie or a localStorage auth shortcut.
await context.addCookies([{ name: 'session', value: 'synthetic-folder-smoke-session', url: base.origin,
  httpOnly: true, sameSite: 'Lax' }]);
const page = await context.newPage();
page.setDefaultTimeout(25_000);
page.on('pageerror', (error) => state.errors.push(error.message));
page.on('console', (message) => {
  if (message.type() !== 'error') return;
  const url = message.location().url;
  if (state.failedPosts === 1 && /\/object-library\/objects(?:\?|$)/.test(url)
    && /Failed to load resource.*500/.test(message.text())) {
    state.expectedConsoleErrors.push(message.text());
  } else state.errors.push(message.text());
});
page.on('dialog', (dialog) => dialog.accept());

await context.route('**/*', async (route) => {
  const request = route.request();
  const url = new URL(request.url());
  const method = request.method();
  const headers = { 'access-control-allow-origin': base.origin, 'access-control-allow-credentials': 'true',
    'access-control-allow-methods': 'GET, POST, PATCH, OPTIONS', 'access-control-allow-headers': 'content-type' };
  const reply = (json, status = 200) => route.fulfill({ status, headers, ...(status === 204 ? {} : { json }) });
  const api = !/^\/(?:dashboard|editor|_next)(?:\/|$)/.test(url.pathname)
    && /\/(?:auth|diagrams|node-library|object-library|templates|diagram-previews|ai|generation)(?:\/|$)/.test(url.pathname);
  try {
    if (api && localHosts.includes(url.hostname)) {
      state.requests.push(`${method} ${url.pathname}`);
      if (method === 'OPTIONS') return reply(undefined, 204);
      if (url.pathname.endsWith('/auth/me') && method === 'GET') {
        state.authReads += 1;
        return reply({ id: ownerId, email: 'folder-smoke@example.invalid', name: 'Synthetic Network Owner', role: 'user' });
      }
      if (url.pathname.endsWith('/templates') && method === 'GET') return reply([]);
      if (url.pathname.endsWith('/node-library/sections') && method === 'GET') return reply({ sections: state.sections });
      if (url.pathname.endsWith('/object-library/objects')) {
        if (method === 'GET') return reply(state.objects);
        if (method === 'POST') {
          const payload = request.postDataJSON();
          const post = { ...structuredClone(payload), status: 'pending' };
          state.posts.push(post);
          assert(state.confirmed, 'Preview wrote to the library before explicit import confirmation');
          assert.deepEqual(Object.keys(payload).sort(), ['name', 'recipe', 'sectionId']);
          assert.equal(payload.sectionId, sectionId, 'Import wrote to a different library');
          assert([rack.name, networkSwitch.name].includes(payload.name), 'A duplicate or invalid object was uploaded');
          assert.deepEqual(payload.recipe, payload.name === rack.name ? rack.recipe : networkSwitch.recipe);
          state.activePosts += 1;
          state.maximumActivePosts = Math.max(state.maximumActivePosts, state.activePosts);
          try {
            // Keep each in-memory request open briefly to detect parallel import.
            await new Promise((resolve) => setTimeout(resolve, 175));
            if (payload.name === networkSwitch.name && state.failedPosts === 0) {
              state.failedPosts += 1;
              post.status = 'failed';
              return await reply({ message: failureMessage }, 500);
            }
            assert(!state.objects.some((object) => object.name === payload.name), 'Retry duplicated an already imported object');
            const created = { id: randomUUID(), ...structuredClone(payload), updatedAt: new Date().toISOString() };
            state.objects.push(created);
            post.status = 'imported';
            return await reply(created, 201);
          } finally { state.activePosts -= 1; }
        }
      }
      if (url.pathname.endsWith('/diagrams') && method === 'GET') return reply([state.diagram]);
      if (url.pathname.endsWith(`/diagrams/${fixtureId}`)) {
        if (method === 'GET') return reply(state.diagram);
        if (method === 'PATCH') {
          const payload = request.postDataJSON();
          assert(Object.keys(payload).every((key) => ['title', 'data', 'status', 'category'].includes(key)), 'Unexpected diagram patch');
          if (payload.data) {
            assert.equal(payload.data.pages.length, 1);
            assert.deepEqual(payload.data.pages[0].nodes, [], 'Library preview changed the editor diagram');
            assert.deepEqual(payload.data.pages[0].edges, [], 'Library preview added editor connections');
          }
          state.patches.push(structuredClone(payload));
          Object.assign(state.diagram, structuredClone(payload));
          return reply(state.diagram);
        }
      }
      if (url.pathname.endsWith(`/diagrams/${fixtureId}/thumbnail`)) {
        if (method === 'PATCH') {
          const payload = request.postDataJSON();
          assert.deepEqual(Object.keys(payload), ['image']);
          assert.match(payload.image, /^data:image\/png;base64,/);
          state.diagram.thumbnail = payload.image;
          state.diagram.thumbnailAt = new Date().toISOString();
          state.patches.push({ thumbnail: true });
          return reply(state.diagram);
        }
        if (method === 'GET' && state.diagram.thumbnail) {
          return route.fulfill({ status: 200, headers, contentType: 'image/png',
            body: Buffer.from(state.diagram.thumbnail.split(',')[1], 'base64') });
        }
      }
    }
    if (url.origin === base.origin && method === 'POST' && url.pathname === '/__nextjs_original-stack-frames') return route.continue();
    if (url.origin === base.origin && ['GET', 'HEAD'].includes(method) && !api) return route.continue();
    state.blocked.push(`${method} ${url.origin}${url.pathname}`);
    return route.abort('blockedbyclient');
  } catch (error) {
    state.errors.push(`Route: ${error.message}`);
    return reply({ message: 'Invalid synthetic request' }, 422);
  }
});
if (context.routeWebSocket) await context.routeWebSocket('**/*', (socket) => {
  if (new URL(socket.url()).host === base.host) socket.connectToServer();
  else { state.blocked.push(`WS ${socket.url()}`); socket.close(); }
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
const dialog = () => page.getByRole('dialog', { name: 'Import 3D folder', exact: true });
const trigger = () => page.getByRole('button', { name: `Import a 3D folder into ${sectionName}`, exact: true });
const row = (suffix) => dialog().locator(`[data-object-folder-row][data-file-path$="/${suffix}"]`);
const checkbox = (suffix) => row(suffix).getByRole('checkbox');
async function chooseFolder() {
  await trigger().click();
  await dialog().waitFor({ state: 'visible' });
  const chooserPromise = page.waitForEvent('filechooser');
  await dialog().getByRole('button', { name: 'Choose folder', exact: true }).click();
  const chooser = await chooserPromise;
  assert(await chooser.element().evaluate((input) => input.webkitdirectory), 'Picker is not a directory input');
  // Playwright populates the browser directory input, including real relative
  // paths. Do not construct a FileList or inject synthetic browser File objects.
  await chooser.setFiles(folder);
  await until(async () => await dialog().locator('[data-object-folder-row]').count() === 6, 'Expected six JSON candidate rows');
  await dialog().getByRole('button', { name: 'Import 2 objects', exact: true }).waitFor({ state: 'visible' });
}
async function readyPreview(name, suffix, { click = true } = {}) {
  const card = row(suffix);
  if (click) await card.getByRole('button', { name: `Preview ${name}`, exact: true }).click();
  const panel = dialog().getByLabel(`3D preview: ${name}`, { exact: true });
  await panel.waitFor({ state: 'visible' });
  const scene = panel.getByTestId('diagram3d-scene');
  const canvas = scene.locator('canvas');
  await canvas.waitFor({ state: 'visible', timeout: 60_000 });
  await until(async () => Boolean(await canvas.getAttribute('data-camera-position')), 'Preview 3D camera did not initialize');
  assert.equal(await scene.getAttribute('data-node-count'), '1', 'Preview includes objects from the main editor');
  const recipe = [rack, server, networkSwitch].find((object) => object.name === name).recipe;
  assert.deepEqual(JSON.parse(await scene.locator('[data-node-size]').getAttribute('data-node-size')),
    [recipe.size.width / 100, recipe.size.depth, recipe.size.height / 100], 'Focused preview did not switch to the chosen object geometry');
  await until(async () => canvas.evaluate((source) => {
    const copy = document.createElement('canvas');
    copy.width = source.width; copy.height = source.height;
    const context = copy.getContext('2d');
    if (!context || !copy.width || !copy.height) return false;
    context.drawImage(source, 0, 0);
    const pixels = context.getImageData(0, 0, copy.width, copy.height).data;
    let colored = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index + 3] && Math.min(pixels[index], pixels[index + 1], pixels[index + 2]) < 170) colored += 1;
    }
    return colored > 100;
  }), 'Interactive preview canvas did not render the 3D object');
  return { scene, canvas };
}

let failure;
try {
  await page.goto(new URL(`/editor/${fixtureId}`, base).href, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  const initialLibrary = page.getByRole('region', { name: `${sectionName} custom library`, exact: true }).filter({ visible: true });
  await initialLibrary.waitFor({ state: 'visible' });
  const initialHeader = initialLibrary.getByRole('button', { name: sectionName, exact: true });
  if (await initialHeader.getAttribute('aria-expanded') === 'false') await initialHeader.click();
  await trigger().waitFor({ state: 'visible' });
  assert(state.authReads > 0, 'Editor bypassed the mocked session check');
  assert((await context.cookies(base.origin)).some((cookie) => cookie.name === 'session' && cookie.httpOnly), 'Synthetic browser session cookie is missing');
  assert.equal(state.posts.length, 0);

  // The manager's launch button unmounts when its dialog closes. Cancelling
  // this path must restore focus to the surviving Custom Libraries trigger.
  const managerTrigger = page.getByRole('button', { name: '+ Custom Libraries', exact: true });
  await managerTrigger.click();
  const manager = page.getByRole('dialog', { name: 'Custom node libraries', exact: true });
  await manager.waitFor({ state: 'visible' });
  await manager.getByRole('button', { name: `Select ${sectionName}`, exact: true }).click();
  await manager.getByRole('button', { name: `Import a 3D folder into ${sectionName}`, exact: true }).click();
  await manager.waitFor({ state: 'hidden' });
  await dialog().waitFor({ state: 'visible' });
  await dialog().getByRole('button', { name: 'Cancel', exact: true }).click();
  await dialog().waitFor({ state: 'hidden' });
  await until(async () => managerTrigger.evaluate((element) => document.activeElement === element),
    'Cancelling folder import launched from the manager did not restore Custom Libraries focus');
  assert.equal(state.posts.length, 0, 'Manager folder preview caused an upload');
  state.checks.push('Manager launches folder preview and cancellation restores the surviving Custom Libraries trigger');
  console.log('PASS manager folder launch and cancellation');

  // Local parsing and preview must stay reversible without a library write.
  await chooseFolder();
  await readyPreview(rack.name, '01-rack.json');
  assert.equal(state.posts.length, 0, 'Choosing a folder wrote to the library');
  await screenshot('01-preview-before-cancel.png');
  await dialog().getByRole('button', { name: 'Cancel', exact: true }).click();
  await dialog().waitFor({ state: 'hidden' });
  assert.equal(state.posts.length, 0, 'Cancelling preview wrote to the library');
  assert.equal(state.objects.length, 1, 'Cancelled preview altered stored objects');
  await until(async () => trigger().evaluate((element) => document.activeElement === element), 'Closing folder preview did not restore trigger focus');
  state.checks.push('Native directory selection, local preview, cancellation and restored focus create no objects');
  console.log('PASS local folder preview and cancel');

  await chooseFolder();
  assert.equal(await dialog().locator('[data-object-folder-row][data-file-path$="/readme.txt"]').count(), 0, 'Non-JSON file became a candidate');
  for (const suffix of ['01-rack.json', 'nested/03-switch.json']) {
    assert.equal(await row(suffix).getAttribute('data-import-status'), 'ready');
    assert(await checkbox(suffix).isChecked(), `New object ${suffix} was not selected`);
    assert(await checkbox(suffix).isEnabled(), `Valid object ${suffix} cannot be selected`);
  }
  for (const suffix of ['02-server-1u.json', 'nested/04-rack-repeat.json']) {
    assert.equal(await row(suffix).getAttribute('data-import-status'), 'duplicate');
    assert(!await checkbox(suffix).isChecked(), `Duplicate ${suffix} was selected by default`);
    assert.match(await row(suffix).innerText(), /already|duplicate|same/i, 'Duplicate explanation is missing');
  }
  for (const suffix of ['90-malformed.json', '91-invalid-recipe.json']) {
    assert.equal(await row(suffix).getAttribute('data-import-status'), 'invalid');
    assert(await checkbox(suffix).isDisabled(), `Invalid file ${suffix} can be selected`);
    assert(!await checkbox(suffix).isChecked(), `Invalid file ${suffix} was selected`);
  }
  assert.match(await row('90-malformed.json').innerText(), /invalid JSON/i);
  assert.match(await row('91-invalid-recipe.json').innerText(), /Not a 3D object file/i);
  for (const suffix of ['01-rack.json', '02-server-1u.json', 'nested/03-switch.json', 'nested/04-rack-repeat.json']) {
    await until(async () => row(suffix).locator('img').evaluate((image) => image.complete && image.naturalWidth > 0
      && image.getAttribute('src')?.startsWith('data:image/png;base64,')), `Local 3D thumbnail is missing for ${suffix}`);
  }
  assert.equal(await dialog().locator('[data-object-folder-row] img').count(), 4, 'Invalid JSON has a misleading object thumbnail');
  // Selection must be independent even when two cards have the same name.
  await checkbox('01-rack.json').uncheck();
  assert(!await checkbox('nested/04-rack-repeat.json').isChecked(), 'Same-name row selection leaked to its duplicate');
  await dialog().getByRole('button', { name: 'Import 1 objects', exact: true }).waitFor({ state: 'visible' });
  await checkbox('01-rack.json').check();
  await dialog().getByRole('button', { name: 'Import 2 objects', exact: true }).waitFor({ state: 'visible' });

  const { scene, canvas } = await readyPreview(networkSwitch.name, 'nested/03-switch.json');
  const before = await canvas.getAttribute('data-camera-position');
  await scene.getByRole('button', { name: 'Top', exact: true }).click();
  await until(async () => await canvas.getAttribute('data-camera-position') !== before, 'Standalone preview camera did not respond');
  await dialog().getByRole('button', { name: '2D preview', exact: true }).click();
  const plan = dialog().getByRole('img', { name: `2D preview: ${networkSwitch.name}`, exact: true });
  await plan.waitFor({ state: 'visible' });
  assert(await plan.evaluate((element) => element.tagName.toLowerCase() === 'svg' || Boolean(element.querySelector('svg'))),
    '2D folder preview did not render its SVG object drawing');
  assert.equal(await dialog().getByTestId('diagram3d-scene').count(), 0, 'Switching to 2D kept the interactive 3D scene mounted');
  assert.equal(state.posts.length, 0, 'Switching to 2D uploaded an object');
  await screenshot('02a-folder-object-2d.png');
  await dialog().getByRole('button', { name: '3D preview', exact: true }).click();
  const remounted = await readyPreview(networkSwitch.name, 'nested/03-switch.json', { click: false });
  const originalCamera = JSON.parse(before);
  await until(async () => {
    const current = JSON.parse(await remounted.canvas.getAttribute('data-camera-position'));
    return Math.hypot(...current.map((value, index) => value - originalCamera[index])) < 0.0001;
  }, 'Remounting folder 3D preview retained the previous temporary camera view');
  await readyPreview(server.name, '02-server-1u.json');
  await readyPreview(rack.name, '01-rack.json');
  assert.equal(state.posts.length, 0, 'Switching preview or camera caused an upload');
  assert.deepEqual(state.diagram.data.pages[0].nodes, [], 'Standalone preview modified main editor nodes');
  await screenshot('02-folder-objects-and-errors.png');
  state.checks.push('Nested JSON, per-file errors, ignored non-JSON, default duplicate skipping and local thumbnails');
  state.checks.push('Focused object preview switches 2D/3D, remounts its camera, and switches objects without touching the editor or library');
  console.log('PASS parsed candidates, duplicate defaults and interactive 3D preview');

  state.confirmed = true;
  const firstImport = dialog().getByRole('button', { name: 'Import 2 objects', exact: true });
  const importColors = await firstImport.evaluate((element) => {
    const style = getComputedStyle(element);
    const rgb = (color) => color.match(/[\d.]+/g).slice(0, 3).map(Number);
    const luminance = (color) => rgb(color).map((value) => {
      const channel = value / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
    const foreground = luminance(style.color), background = luminance(style.backgroundColor);
    return { color: style.color, backgroundColor: style.backgroundColor, background: rgb(style.backgroundColor),
      contrast: (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05) };
  });
  assert.notEqual(importColors.color, importColors.backgroundColor, 'Import button text disappears into its background');
  assert.deepEqual(importColors.background, [166, 25, 46], 'Import button lost its maroon action background');
  assert(importColors.contrast >= 4.5, `Import button text is unreadable: contrast ${importColors.contrast.toFixed(2)}:1`);
  state.checks.push('Primary Import button has a maroon background and readable text contrast of at least 4.5:1');
  await firstImport.click();
  await until(async () => state.posts.length === 2 && state.activePosts === 0
    && await row('01-rack.json').getAttribute('data-import-status') === 'imported'
    && await row('nested/03-switch.json').getAttribute('data-import-status') === 'failed', 'First import did not retain separate success and failure states');
  assert.deepEqual(state.posts.map(({ name }) => name), [rack.name, networkSwitch.name]);
  assert.equal(state.maximumActivePosts, 1, 'Folder import made parallel API writes');
  assert.equal(state.objects.length, 2, 'A failed or duplicate object was added');
  assert.match(await row('01-rack.json').innerText(), /Imported/);
  assert.match(await row('nested/03-switch.json').innerText(), /Synthetic switch upload failed/);
  assert(!await checkbox('01-rack.json').isChecked(), 'Successful import remains selected for retry');
  assert(await checkbox('01-rack.json').isDisabled(), 'Already imported file can be uploaded again');
  assert(await checkbox('nested/03-switch.json').isChecked(), 'Failed object is unavailable for retry');
  await dialog().getByRole('button', { name: 'Import 1 objects', exact: true }).waitFor({ state: 'visible' });
  await screenshot('03-partial-import-and-retry.png');
  state.checks.push('Explicit confirmation imports selected valid objects sequentially and reports one per-file API failure');
  console.log('PASS sequential partial import');

  await dialog().getByRole('button', { name: 'Import 1 objects', exact: true }).click();
  await until(async () => state.posts.length === 3 && state.activePosts === 0
    && await row('nested/03-switch.json').getAttribute('data-import-status') === 'imported', 'Failed object did not import on retry');
  assert.deepEqual(state.posts.map(({ name, status }) => ({ name, status })), [
    { name: rack.name, status: 'imported' }, { name: networkSwitch.name, status: 'failed' },
    { name: networkSwitch.name, status: 'imported' },
  ]);
  assert.equal(state.failedPosts, 1);
  assert.equal(state.objects.length, 3);
  assert.equal(state.objects.filter((object) => object.name === rack.name).length, 1, 'Retry duplicated the successful rack');
  assert.equal(state.objects.filter((object) => object.name === server.name).length, 1, 'Import duplicated the known server');
  assert(state.objects.every((object) => object.sectionId === sectionId), 'Import changed libraries');
  await screenshot('04-import-complete.png');
  await dialog().getByRole('button', { name: 'Close', exact: true }).click();
  await dialog().waitFor({ state: 'hidden' });
  const library = page.getByRole('region', { name: `${sectionName} custom library`, exact: true }).filter({ visible: true });
  const header = library.getByRole('button', { name: sectionName, exact: true });
  if (await header.getAttribute('aria-expanded') !== 'true') await header.click();
  for (const name of [rack.name, server.name, networkSwitch.name]) {
    const tile = library.getByRole('button', { name: `Drag ${name} to canvas`, exact: true });
    await tile.waitFor({ state: 'visible' });
    assert.equal(await tile.count(), 1, `Sidebar contains duplicate ${name}`);
    await until(async () => tile.locator('img').evaluate((image) => image.complete && image.naturalWidth > 0
      && image.getAttribute('src')?.startsWith('data:image/png;base64,')), `Sidebar thumbnail is missing for ${name}`);
  }
  assert.deepEqual(state.diagram.data.pages[0].nodes, []);
  assert.deepEqual(state.diagram.data.pages[0].edges, []);
  assert.deepEqual(state.blocked, [], 'Unexpected cloud request or API mutation');
  assert.deepEqual(state.errors, [], 'Browser reported an unexpected error');
  state.checks.push('Retry uploads only the failed file, keeps successful objects, skips duplicates and updates the same sidebar library');
  state.checks.push('Zero unexpected browser errors, cloud requests or main-editor mutations');
  await screenshot('05-sidebar-imported-objects.png');
  console.log('PASS safe retry, sidebar objects and zero external calls');
} catch (error) {
  failure = error;
  process.exitCode = 1;
  await screenshot('failure.png').catch(() => {});
} finally {
  clearTimeout(watchdog);
  const report = { passed: !failure, checks: state.checks, posts: state.posts, objects: state.objects.map(({ recipe, ...object }) => object),
    maximumActivePosts: state.maximumActivePosts, authReads: state.authReads, diagramWrites: state.patches.length,
    requests: state.requests, blocked: state.blocked, errors: state.errors, expectedConsoleErrors: state.expectedConsoleErrors,
    ...(failure ? { failure: failure.message, stack: failure.stack } : {}), fixtureFolder: folder, output };
  await writeFile(path.join(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ ...report, posts: report.posts.map(({ recipe, ...post }) => post) }, null, 2));
  await context.close();
  await browser.close();
}
if (failure) throw failure;
