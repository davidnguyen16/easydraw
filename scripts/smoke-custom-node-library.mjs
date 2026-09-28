/**
 * Custom-library browser smoke against an already running LOCAL frontend.
 * All auth, API, upload, and signed-image traffic is mocked in memory. No real
 * S3 upload, backend mutation, migration, or server restart is performed.
 *
 * BASE_URL defaults to http://localhost:5173. Set PLAYWRIGHT_MODULE_PATH to an
 * existing playwright-core directory and BROWSER_EXECUTABLE_PATH if necessary.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright-core');
const baseUrl = new URL(process.env.BASE_URL || 'http://localhost:5173');
assert(['localhost', '127.0.0.1', '[::1]'].includes(baseUrl.hostname), 'Only local frontends may be tested.');
const output = process.env.SMOKE_OUTPUT_DIR ? path.resolve(process.env.SMOKE_OUTPUT_DIR) : await mkdtemp(path.join(tmpdir(), 'easydraw-custom-library-'));
await mkdir(output, { recursive: true });
const fixtureId = 'custom-library-smoke';
const sectionId = 'smoke-private-section';
const assetId = 'smoke-private-image';
const definitionId = 'smoke-private-definition';
const state = {
  sections: [], patches: [], requests: [], assetReads: [], blocked: [], missingAsset: false, upload: null,
  diagram: { id: fixtureId, title: 'Custom library smoke', type: 'flowchart', status: 'draft', data: {
    schemaVersion: 1, activePageId: 'main', pages: [{ id: 'main', name: 'Main', nodes: [], edges: [] }],
  } },
};
const checks = [];
const errors = [];
const dialogs = [];
let dismissNextConfirmation = false;
let png;
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BROWSER_EXECUTABLE_PATH ? { executablePath: process.env.BROWSER_EXECUTABLE_PATH } : {}),
  args: ['--enable-webgl', '--enable-unsafe-swiftshader', '--renderer-process-limit=2'],
});
const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, serviceWorkers: 'block' });
const page = await context.newPage();
page.setDefaultTimeout(30_000);
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error' && !/net::ERR_BLOCKED_BY_CLIENT|Export to PNG failed/.test(message.text())) errors.push(message.text());
});
page.on('dialog', async (dialog) => {
  dialogs.push(dialog.message());
  if (dialog.type() === 'confirm' && dismissNextConfirmation) {
    dismissNextConfirmation = false;
    await dialog.dismiss();
  } else await dialog.accept();
});
const watchdog = setTimeout(() => { void browser.close(); }, 300_000);

await context.route('**/*', async (route) => {
  const request = route.request();
  const url = new URL(request.url());
  const method = request.method();
  const headers = {
    'access-control-allow-origin': baseUrl.origin,
    'access-control-allow-credentials': 'true',
    'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'access-control-allow-headers': 'content-type',
  };
  const reply = (json, status = 200) => route.fulfill({ status, headers, ...(status === 204 ? {} : { json }) });
  const apiPath = url.pathname.match(/\/(?:auth|diagrams|node-library)(?:\/|$)/);
  if (method === 'OPTIONS' && (apiPath || url.hostname === 'mock-s3.invalid')) return reply(undefined, 204);
  if (url.pathname.endsWith('/auth/me') && method === 'GET') return reply({ id: 'smoke-owner', email: 'smoke@example.invalid', name: 'Synthetic Owner' });
  if (url.pathname.endsWith(`/diagrams/${fixtureId}`)) {
    if (method === 'GET') return reply(state.diagram);
    if (method === 'PATCH') {
      const payload = request.postDataJSON();
      assert(payload.data?.pages?.length === 1 && payload.data.pages[0].id === 'main', 'Unexpected document mutation');
      assert.equal(payload.title, state.diagram.title);
      state.patches.push(structuredClone(payload));
      state.diagram = { ...state.diagram, ...structuredClone(payload) };
      return reply(state.diagram);
    }
  }
  const libraryPath = url.pathname.match(/\/node-library(\/.*)$/)?.[1];
  if (libraryPath) {
    state.requests.push(`${method} ${libraryPath}`);
    if (libraryPath === '/sections' && method === 'GET') return reply({ sections: state.sections });
    if (libraryPath === '/sections' && method === 'POST') {
      const { name } = request.postDataJSON();
      assert.equal(name, 'My devices');
      const section = { id: sectionId, name, sortOrder: 0, nodes: [] };
      state.sections.push(section);
      return reply(section, 201);
    }
    if (libraryPath === `/sections/${sectionId}/uploads` && method === 'POST') {
      state.upload = request.postDataJSON();
      assert.equal(state.upload.contentType, 'image/png');
      assert.equal(state.upload.byteSize, png.length);
      return reply({ assetId, url: 'https://mock-s3.invalid/upload', fields: { key: 'test-only/quarantine/image', policy: 'mock-policy' } });
    }
    if (libraryPath === `/uploads/${assetId}/complete` && method === 'POST') {
      const node = {
        id: definitionId, sectionId, assetId, name: state.upload.name,
        defaultWidth: 160, defaultHeight: 80, sortOrder: 0,
        asset: { id: assetId, mimeType: 'image/png', width: 160, height: 80 },
      };
      state.sections[0].nodes = [node];
      return reply(node, 201);
    }
    if (libraryPath === '/assets/resolve' && method === 'POST') {
      const { assetIds, variant } = request.postDataJSON();
      assert(assetIds.every((id) => id === assetId));
      assert(['image', 'thumbnail'].includes(variant));
      return reply({ assets: state.missingAsset ? [] : [{ id: assetId, url: `https://mock-s3.invalid/${variant}.png?signature=mock`, expiresAt: '2099-01-01T00:00:00Z' }] });
    }
    if (libraryPath === `/nodes/${definitionId}` && method === 'PATCH') {
      const patch = request.postDataJSON();
      assert.deepEqual(Object.keys(patch), ['name'], 'Only the fixture node rename is allowed');
      assert(['blue-device', 'renamed-device'].includes(patch.name), 'Unexpected fixture node name');
      const node = state.sections.find((section) => section.id === sectionId)?.nodes.find((item) => item.id === definitionId);
      assert(node, 'Fixture node template is missing');
      node.name = patch.name;
      return reply(node);
    }
    if (libraryPath === `/nodes/${definitionId}` && method === 'DELETE') {
      const section = state.sections.find((item) => item.id === sectionId);
      assert(section?.nodes.some((node) => node.id === definitionId), 'Fixture node template is missing');
      section.nodes = section.nodes.filter((node) => node.id !== definitionId);
      // Only the reusable template is archived; asset resolution stays valid.
      return reply(undefined, 204);
    }
    if (libraryPath === `/sections/${sectionId}` && method === 'PATCH') {
      const patch = request.postDataJSON();
      assert.deepEqual(Object.keys(patch), ['name'], 'Only the fixture section rename is allowed');
      assert(['My devices', 'Renamed devices'].includes(patch.name), 'Unexpected fixture section name');
      const section = state.sections.find((item) => item.id === sectionId);
      assert(section, 'Fixture section is missing');
      section.name = patch.name;
      return reply(section);
    }
    if (libraryPath === `/sections/${sectionId}` && method === 'DELETE') {
      state.sections = [];
      return reply(undefined, 204);
    }
  }
  if (url.hostname === 'mock-s3.invalid') {
    assert(!request.headers().cookie, 'S3 must not receive application cookies');
    if (method === 'POST' && url.pathname === '/upload') {
      const body = request.postDataBuffer().toString('latin1');
      assert(body.includes('filename="blue-device.png"') && body.includes('mock-policy'), 'Missing multipart upload file or policy');
      assert(body.lastIndexOf('name="file"') > body.lastIndexOf('name="policy"'), 'S3 file must be the last field');
      state.requests.push('POST mock-s3/upload');
      return reply(undefined, 204);
    }
    if (method === 'GET' && /^\/(?:image|thumbnail)\.png$/.test(url.pathname)) {
      assert.equal(url.search, '?signature=mock', 'Image signatures must not be cache-busted');
      state.assetReads.push(url.href);
      return route.fulfill({ status: 200, headers: { ...headers, 'content-type': 'image/png' }, body: png });
    }
  }
  if (url.origin === baseUrl.origin && method === 'POST' && url.pathname === '/__nextjs_original-stack-frames') return route.continue();
  if (url.origin === baseUrl.origin && ['GET', 'HEAD'].includes(method) && !apiPath) return route.continue();
  state.blocked.push(`${method} ${url.origin}${url.pathname}`);
  return route.abort('blockedbyclient');
});

async function until(predicate, message, timeout = 30_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(message);
}
const nodes = () => state.diagram.data.pages[0].nodes;
const imageNodes = () => nodes().filter((node) => node.type === 'CustomImageNode');
const visible = (locator) => locator.filter({ visible: true });
async function mode(name) {
  await page.getByRole('group', { name: 'Diagram view', exact: true }).getByRole('button', { name: `${name} view`, exact: true }).click();
}
async function save() {
  const count = state.patches.length;
  await page.keyboard.press('Control+s');
  await until(() => state.patches.length > count, 'Explicit save never completed');
}
async function pngExport(name) {
  const download = page.waitForEvent('download');
  await triggerExport();
  const file = await download;
  assert.equal(await file.failure(), null);
  const bytes = await readFile(await file.path());
  assert.equal(bytes.subarray(0, 4).toString('hex'), '89504e47');
  assert(bytes.length > 1000, 'Unexpectedly empty PNG export');
  await file.saveAs(path.join(output, name));
}
async function triggerExport() {
  await visible(page.getByRole('button', { name: 'Export diagram', exact: true })).click();
  await page.getByRole('menu', { name: 'Export diagram', exact: true }).getByRole('menuitem', { name: /^PNG/ }).click();
}
async function get3D() {
  const scene = page.getByLabel('3D diagram', { exact: true });
  await scene.locator('canvas').waitFor({ state: 'visible' });
  await until(async () => !!await scene.locator('canvas').getAttribute('data-camera-position'), '3D camera never initialized');
  return scene;
}
async function assertBlueTexture(scene) {
  await until(async () => scene.locator('canvas').evaluate((source) => {
    const canvas = document.createElement('canvas');
    canvas.width = source.width; canvas.height = source.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(source, 0, 0);
    const rgba = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let blue = 0;
    for (let index = 0; index < rgba.length; index += 4) if (rgba[index] < 65 && rgba[index + 1] > 140 && rgba[index + 2] > 200) blue += 1;
    return blue > 150;
  }), '3D showed a fallback box instead of the uploaded blue image');
}

try {
  // Synthetic transparent PNG fixture; never persisted to the user's library.
  png = Buffer.from(await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 80;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#0bbef0'; ctx.fillRect(20, 10, 120, 60);
    return canvas.toDataURL('image/png').split(',')[1];
  }), 'base64');
  await page.goto(new URL(`/editor/${fixtureId}`, baseUrl).href);
  await page.getByRole('button', { name: '+ Custom Libraries', exact: true }).waitFor();
  assert.equal(await page.locator('aside input[type="file"]').count(), 0, 'Built-in sections expose custom uploads');
  assert(await page.locator('[data-custom-libraries]').evaluate((element) => {
    const sections = [...element.parentElement.children].filter((child) => child.tagName === 'SECTION');
    return sections.length === 5 && sections.every((section) => Boolean(section.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING));
  }), 'Private libraries must appear beneath all five built-in sections');
  const customLibrariesCta = page.getByRole('button', { name: '+ Custom Libraries', exact: true });
  await customLibrariesCta.hover();
  await until(() => customLibrariesCta.evaluate((element) => {
    const style = getComputedStyle(element);
    return style.backgroundColor === 'rgb(173, 54, 71)' && style.color === 'rgb(255, 255, 255)';
  }), 'Custom Libraries button must turn burgundy with white text on hover');
  await page.mouse.move(1, 1);
  await until(() => customLibrariesCta.evaluate((element) => getComputedStyle(element).backgroundColor === 'rgb(255, 255, 255)'),
    'Custom Libraries button must return to white when the pointer leaves');
  checks.push('Custom Libraries CTA uses burgundy/white hover colors and returns to a white background');
  await customLibrariesCta.click();
  const libraryDialog = page.getByRole('dialog', { name: 'Custom node libraries', exact: true });
  await libraryDialog.waitFor({ state: 'visible' });
  for (const name of ['Basic', 'Arrows', 'Flowchart', 'Entity Relation', 'UML']) {
    assert(await libraryDialog.getByRole('button', { name, exact: true }).isDisabled(), `${name} must be locked in the custom library dialog`);
  }
  const modalUpload = libraryDialog.getByLabel('Upload images to selected library', { exact: true });
  const modalSingleUpload = libraryDialog.getByLabel('Upload a custom node image', { exact: true });
  assert(await modalUpload.isDisabled() && await modalSingleUpload.isDisabled(), 'Uploads must be disabled until a private section is selected');
  await libraryDialog.screenshot({ path: path.join(output, 'custom-library-modal-empty.png') });
  await page.setViewportSize({ width: 640, height: 600 });
  await until(() => libraryDialog.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return bounds.x >= 0 && bounds.y >= 0 && bounds.right <= innerWidth && bounds.bottom <= innerHeight;
  }), 'Library dialog extends beyond the small viewport');
  await libraryDialog.screenshot({ path: path.join(output, 'custom-library-modal-small.png') });
  await page.setViewportSize({ width: 1360, height: 900 });
  await libraryDialog.getByPlaceholder('e.g. My AWS nodes', { exact: true }).fill('My devices');
  await libraryDialog.getByRole('button', { name: /Add/ }).click();
  await until(async () => await libraryDialog.getByRole('button', { name: 'Select My devices', exact: true }).getAttribute('aria-pressed') === 'true'
    && await modalUpload.isEnabled(), 'Creating a section must select it and enable uploads');
  for (const name of ['Renamed devices', 'My devices']) {
    await libraryDialog.getByRole('button', { name: 'Rename', exact: true }).click();
    await libraryDialog.getByLabel('Section name', { exact: true }).fill(name);
    await libraryDialog.getByRole('button', { name: 'Save name', exact: true }).click();
    await until(async () => state.sections[0]?.name === name
      && await libraryDialog.getByRole('button', { name: `Select ${name}`, exact: true }).getAttribute('aria-pressed') === 'true',
    'Renaming a section must update its selected row');
  }
  assert(await libraryDialog.getByRole('button', { name: 'Move My devices up', exact: true }).isDisabled(), 'The only section cannot move up');
  assert(await libraryDialog.getByRole('button', { name: 'Move My devices down', exact: true }).isDisabled(), 'The only section cannot move down');
  checks.push('Modal section rename persists and single-section reorder controls are disabled');
  await modalUpload.setInputFiles({ name: 'blue-device.png', mimeType: 'image/png', buffer: png });
  await libraryDialog.getByText('blue-device', { exact: true }).first().waitFor();
  await libraryDialog.screenshot({ path: path.join(output, 'custom-library-modal-uploaded.png') });
  await libraryDialog.getByRole('button', { name: 'Close custom libraries', exact: true }).click();
  await libraryDialog.waitFor({ state: 'hidden' });
  checks.push('Library modal locks built-ins, fits a small viewport, creates/selects a private section and uploads through mocked S3');
  const library = visible(page.getByRole('region', { name: 'My devices custom library', exact: true }));
  assert.equal(await page.locator('[data-custom-libraries]').getByRole('heading', { name: 'PRIVATE', exact: true }).count(), 1, 'Private libraries must have one shared group heading');
  assert.equal(await library.getByText('Private', { exact: true }).count(), 0, 'Private label must not repeat on each section');
  const privateHeader = library.getByRole('button', { name: 'My devices', exact: true });
  const privateTitle = privateHeader.getByText('My devices', { exact: true });
  const titleIsUnderlined = () => privateTitle.evaluate((element) => getComputedStyle(element).textDecorationLine.includes('underline'));
  await privateHeader.hover();
  assert(await titleIsUnderlined(), 'Private section title must underline on hover');
  for (const expanded of ['false', 'true']) {
    await privateHeader.click();
    await until(async () => await privateHeader.getAttribute('aria-expanded') === expanded, 'Private section did not toggle');
    // Collapsing may reposition the header; keep the pointer over its new bounds.
    await privateHeader.hover();
    assert(await titleIsUnderlined(), 'Private section title lost its underline while hovered after clicking');
  }
  await page.mouse.move(1, 1);
  assert(!await titleIsUnderlined(), 'Private section underline must disappear when the pointer leaves');
  checks.push('Private section title hover underline survives collapse/expand and clears on pointer leave');
  assert.equal(await page.locator('aside').getByText('Library settings', { exact: true }).count(), 0, 'Sidebar must not expose the former Library settings disclosure');
  assert.equal(await library.getByLabel('Library name', { exact: true }).count(), 0, 'Inline rename form must appear only when requested');
  const libraryMenu = page.getByRole('menu', { name: 'My devices library actions', exact: true });
  const expandedBeforeMenu = await privateHeader.getAttribute('aria-expanded');
  await privateHeader.click({ button: 'right' });
  await libraryMenu.waitFor({ state: 'visible' });
  assert.equal(await privateHeader.getAttribute('aria-expanded'), expandedBeforeMenu, 'Right-click must not toggle the library');
  for (const name of ['Rename library', 'Move up', 'Move down', 'Remove library']) {
    assert(await libraryMenu.getByRole('menuitem', { name, exact: true }).isVisible(), `Missing library menu action: ${name}`);
  }
  assert(await libraryMenu.getByRole('menuitem', { name: 'Move up', exact: true }).isDisabled(), 'The only section cannot move up from its context menu');
  assert(await libraryMenu.getByRole('menuitem', { name: 'Move down', exact: true }).isDisabled(), 'The only section cannot move down from its context menu');
  await until(() => libraryMenu.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return bounds.x >= 0 && bounds.y >= 0 && bounds.right <= innerWidth && bounds.bottom <= innerHeight;
  }), 'Library context menu extends beyond the viewport');
  await page.screenshot({ path: path.join(output, 'custom-library-context-menu.png') });
  await page.keyboard.press('Escape');
  await libraryMenu.waitFor({ state: 'hidden' });
  await until(() => privateHeader.evaluate((element) => document.activeElement === element), 'Escape must restore focus to the library header');
  await page.keyboard.press('Shift+F10');
  await libraryMenu.waitFor({ state: 'visible' });
  assert.equal(await privateHeader.getAttribute('aria-expanded'), expandedBeforeMenu, 'Keyboard context menu must not toggle the library');
  await page.mouse.click(1, 1);
  await libraryMenu.waitFor({ state: 'hidden' });
  checks.push('Library actions use a bounded right-click/keyboard menu with disabled reorder, Escape focus restoration and outside dismissal');

  let currentLibraryName = 'My devices';
  for (const name of ['Renamed devices', 'My devices']) {
    const currentLibrary = visible(page.getByRole('region', { name: `${currentLibraryName} custom library`, exact: true }));
    await currentLibrary.getByRole('button', { name: currentLibraryName, exact: true }).click({ button: 'right' });
    const currentMenu = page.getByRole('menu', { name: `${currentLibraryName} library actions`, exact: true });
    await currentMenu.getByRole('menuitem', { name: 'Rename library', exact: true }).click();
    await currentMenu.waitFor({ state: 'hidden' });
    await currentLibrary.getByLabel('Library name', { exact: true }).fill(name);
    await currentLibrary.getByRole('button', { name: 'Save', exact: true }).click();
    await until(async () => state.sections[0]?.name === name
      && await page.getByRole('region', { name: `${name} custom library`, exact: true }).isVisible(),
    'Context-menu rename did not update the private library');
    currentLibraryName = name;
  }
  await until(async () => await library.getByLabel('Library name', { exact: true }).count() === 0, 'Inline rename form must close after saving');
  const deletesBeforeCancel = state.requests.filter((request) => request === `DELETE /sections/${sectionId}`).length;
  const dialogsBeforeCancel = dialogs.length;
  await privateHeader.click({ button: 'right' });
  dismissNextConfirmation = true;
  await libraryMenu.getByRole('menuitem', { name: 'Remove library', exact: true }).click();
  await until(() => !dismissNextConfirmation && dialogs.length > dialogsBeforeCancel, 'Context-menu removal did not ask for confirmation');
  await libraryMenu.waitFor({ state: 'hidden' });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(state.sections.length, 1, 'Canceling removal deleted the private section');
  assert.equal(state.requests.filter((request) => request === `DELETE /sections/${sectionId}`).length, deletesBeforeCancel,
    'Canceling context-menu removal sent a delete request');
  checks.push('Context-menu rename uses the requested inline form; canceling removal sends no mutation');
  await page.getByLabel('Upload images to My devices', { exact: true }).waitFor();
  const tile = visible(page.getByRole('button', { name: 'Drag blue-device to canvas', exact: true }));
  await tile.waitFor();
  assert.equal(await library.getByText('Manage', { exact: true }).count(), 0, 'Sidebar node tiles must not expose Manage');
  assert((await tile.getAttribute('title'))?.includes('blue-device'), 'Thumbnail tooltip must include the node name');
  assert(await tile.locator('img').evaluate(async (image) => {
    await image.decode();
    return image.naturalWidth > 0 && getComputedStyle(image).objectFit === 'contain';
  }), 'Custom thumbnail must load with object-fit contain');
  assert.equal((await tile.innerText()).trim(), '', 'Sidebar node tiles must display only the thumbnail');
  const basicHeader = page.locator('aside').getByRole('button', { name: 'BASIC', exact: true });
  await basicHeader.click();
  const builtinTile = basicHeader.locator('..').locator('button[draggable="true"]').first();
  await builtinTile.waitFor();
  const builtinTileBox = await builtinTile.boundingBox();
  const customTileBox = await tile.boundingBox();
  assert(builtinTileBox && customTileBox, 'Palette tiles have no bounds');
  assert(Math.abs(customTileBox.width - customTileBox.height) < 1, 'Custom palette tile must be square');
  assert(Math.abs(customTileBox.width - builtinTileBox.width) < 1 && Math.abs(customTileBox.height - builtinTileBox.height) < 1,
    'Custom palette tile dimensions must match the built-in tiles');
  await basicHeader.click();
  await tile.scrollIntoViewIfNeeded();
  await page.locator('aside').screenshot({ path: path.join(output, 'custom-library-square-grid.png') });

  const nodeMenu = page.getByRole('menu', { name: 'blue-device node actions', exact: true });
  await tile.click({ button: 'right' });
  await nodeMenu.waitFor({ state: 'visible' });
  assert.equal(await nodeMenu.getByRole('menuitem').count(), 2, 'Node menu must contain only rename and remove actions');
  assert(await nodeMenu.getByRole('menuitem', { name: 'Rename node', exact: true }).isVisible());
  assert(await nodeMenu.getByRole('menuitem', { name: 'Remove node', exact: true }).isVisible());
  await until(() => nodeMenu.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return bounds.x >= 0 && bounds.y >= 0 && bounds.right <= innerWidth && bounds.bottom <= innerHeight;
  }), 'Node context menu extends beyond the viewport');
  await page.screenshot({ path: path.join(output, 'custom-node-context-menu.png') });
  await page.keyboard.press('Escape');
  await nodeMenu.waitFor({ state: 'hidden' });
  await until(() => tile.evaluate((element) => document.activeElement === element), 'Escape must restore focus to the node tile');
  await page.keyboard.press('Shift+F10');
  await nodeMenu.waitFor({ state: 'visible' });
  await page.mouse.click(1, 1);
  await nodeMenu.waitFor({ state: 'hidden' });

  let currentNodeName = 'blue-device';
  for (const name of ['renamed-device', 'blue-device']) {
    const currentTile = library.getByRole('button', { name: `Drag ${currentNodeName} to canvas`, exact: true });
    await currentTile.click({ button: 'right' });
    await page.getByRole('menu', { name: `${currentNodeName} node actions`, exact: true }).getByRole('menuitem', { name: 'Rename node', exact: true }).click();
    await library.getByLabel('Node name', { exact: true }).fill(name);
    const renamingTileBox = await currentTile.boundingBox();
    const renameInputBox = await library.getByLabel('Node name', { exact: true }).boundingBox();
    assert(renamingTileBox && renameInputBox && Math.abs(renamingTileBox.width - renamingTileBox.height) < 1
      && renameInputBox.y >= renamingTileBox.y + renamingTileBox.height,
    'Inline node rename must sit below the square thumbnail tile');
    await library.getByRole('button', { name: 'Save', exact: true }).click();
    await until(async () => state.sections[0]?.nodes[0]?.name === name
      && await library.getByRole('button', { name: `Drag ${name} to canvas`, exact: true }).isVisible(), 'Node rename did not update its thumbnail');
    currentNodeName = name;
  }
  await until(async () => await library.getByLabel('Node name', { exact: true }).count() === 0, 'Node rename form did not close');
  const nodeDeletesBeforeCancel = state.requests.filter((request) => request === `DELETE /nodes/${definitionId}`).length;
  const nodeDialogsBeforeCancel = dialogs.length;
  await tile.click({ button: 'right' });
  dismissNextConfirmation = true;
  await nodeMenu.getByRole('menuitem', { name: 'Remove node', exact: true }).click();
  await until(() => !dismissNextConfirmation && dialogs.length > nodeDialogsBeforeCancel, 'Node removal did not ask for confirmation');
  await nodeMenu.waitFor({ state: 'hidden' });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(state.sections[0].nodes.length, 1, 'Canceling removal deleted the node template');
  assert.equal(state.requests.filter((request) => request === `DELETE /nodes/${definitionId}`).length, nodeDeletesBeforeCancel,
    'Canceling node removal sent a delete request');
  checks.push('Custom thumbnails match built-in squares; node context menus support keyboard/focus, inline rename and safe removal cancellation');
  assert(state.requests.includes('POST mock-s3/upload'), 'Upload skipped the S3 transfer');
  checks.push('Private section creation, built-in isolation, mocked presigned S3 upload and completion');

  const canvas = page.locator('.react-flow');
  const bounds = await canvas.boundingBox();
  await tile.dragTo(canvas, { targetPosition: { x: bounds.width * 0.48, y: bounds.height * 0.42 } });
  const node2d = page.locator('.react-flow__node-CustomImageNode').first();
  await node2d.locator('[data-custom-image-state="ready"]').waitFor();
  await node2d.dblclick();
  await node2d.getByLabel('Custom node label', { exact: true }).fill('My blue device');
  await node2d.getByLabel('Custom node label', { exact: true }).press('Tab');
  const showStyle = page.getByRole('button', { name: 'Show style panel', exact: true });
  if (await showStyle.isVisible()) await showStyle.click();
  await visible(page.getByRole('tab', { name: 'Arrange', exact: true })).click();
  for (const [label, value] of [['W', '240'], ['H', '120']]) {
    const input = visible(page.getByLabel(label, { exact: true }));
    await input.fill(value); await input.press('Tab');
  }
  await save();
  assert.equal(imageNodes().length, 1);
  assert.equal(imageNodes()[0].data.label, 'My blue device');
  assert.equal(imageNodes()[0].width, 240);
  assert.equal(imageNodes()[0].height, 120);
  assert.deepEqual(Object.keys(imageNodes()[0].data).sort(), ['assetId', 'definitionId', 'fit', 'intrinsicHeight', 'intrinsicWidth', 'label'].sort());
  assert(!/blob:|mock-s3|signature=/.test(JSON.stringify(state.diagram.data)), 'Temporary URLs leaked into diagram JSON');
  const firstId = imageNodes()[0].id;
  const beforeModal = await node2d.evaluate((element) => ({
    width: element.style.width, height: element.style.height,
    label: element.querySelector('textarea').value,
  }));
  await customLibrariesCta.click();
  await libraryDialog.waitFor({ state: 'visible' });
  assert(await libraryDialog.getByRole('button', { name: 'Select My devices', exact: true }).isVisible(), 'Reopening the dialog lost the existing section');
  assert.equal(await libraryDialog.getByRole('button', { name: 'Select My devices', exact: true }).getAttribute('aria-pressed'), 'true');
  await libraryDialog.getByText('blue-device', { exact: true }).first().waitFor();
  await libraryDialog.getByRole('button', { name: 'Close custom libraries', exact: true }).focus();
  for (const shortcut of ['Control+d', 'Delete', 'Control+z']) {
    await page.keyboard.press(shortcut);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await page.locator('.react-flow__node-CustomImageNode').count(), 1, `${shortcut} in the dialog changed canvas nodes`);
    assert.deepEqual(await node2d.evaluate((element) => ({
      width: element.style.width, height: element.style.height,
      label: element.querySelector('textarea').value,
    })), beforeModal, `${shortcut} in the dialog changed canvas content`);
  }
  await page.keyboard.press('Escape');
  await libraryDialog.waitFor({ state: 'hidden' });
  await until(() => customLibrariesCta.evaluate((element) => document.activeElement === element), 'Escape must restore focus to the Custom Libraries button');
  checks.push('Reopened modal retains section/items, isolates canvas shortcuts, and restores button focus on Escape');
  const labelBox = await node2d.getByLabel('Custom node label', { exact: true }).boundingBox();
  const imageBox = await node2d.locator('img').boundingBox();
  assert(labelBox.y >= imageBox.y + imageBox.height - 1, 'Caption overlaps the artwork');
  await pngExport('custom-library-2d.png');
  await page.screenshot({ path: path.join(output, 'custom-library-editor-2d.png') });
  checks.push('2D image drop, caption below artwork, resize, PNG export, stable-ID autosave');

  await page.reload();
  await page.locator(`.react-flow__node[data-id="${firstId}"] [data-custom-image-state="ready"]`).waitFor();
  assert.equal(await page.locator(`.react-flow__node[data-id="${firstId}"]`).getByLabel('Custom node label').inputValue(), 'My blue device');
  await mode('3D');
  const scene = await get3D();
  await assertBlueTexture(scene);
  const size = JSON.parse(await scene.locator(`[data-scene-node="${firstId}"]`).getAttribute('data-node-size'));
  assert(size[1] < 0.1, 'Custom image became a thick fallback box');
  const section = visible(page.getByRole('region', { name: 'My devices custom library', exact: true }));
  await section.getByRole('button', { name: 'My devices', exact: true }).click();
  const sceneBounds = await scene.boundingBox();
  await tile.dragTo(scene, { targetPosition: { x: sceneBounds.width * 0.66, y: sceneBounds.height * 0.66 } });
  await until(() => imageNodes().length === 2, '3D palette drop did not persist a second custom node');
  const second = imageNodes().find((node) => node.id !== firstId);
  assert.deepEqual(second.data, { definitionId, assetId, label: 'blue-device', intrinsicWidth: 160, intrinsicHeight: 80, fit: 'contain' });
  await assertBlueTexture(scene);
  await pngExport('custom-library-3d.png');
  await page.screenshot({ path: path.join(output, 'custom-library-editor-3d.png') });
  checks.push('Reloaded image, actual blue texture in thin 3D tile, shared 3D drop factory and PNG export');

  const placedImagesBeforeRemoval = imageNodes().map((node) => ({ id: node.id, assetId: node.data.assetId, definitionId: node.data.definitionId, label: node.data.label }));
  const imageReadsBeforeRemoval = state.assetReads.filter((url) => url.endsWith('/image.png?signature=mock')).length;
  const nodeRemovalDialogs = dialogs.length;
  await tile.click({ button: 'right' });
  await nodeMenu.getByRole('menuitem', { name: 'Remove node', exact: true }).click();
  await until(() => state.sections[0]?.nodes.length === 0, 'Node template removal did not complete');
  assert(dialogs.length > nodeRemovalDialogs && dialogs.at(-1).includes('blue-device'), 'Node removal must ask for confirmation');
  await tile.waitFor({ state: 'detached' });
  assert.deepEqual(imageNodes().map((node) => ({ id: node.id, assetId: node.data.assetId, definitionId: node.data.definitionId, label: node.data.label })),
    placedImagesBeforeRemoval, 'Removing the template changed placed diagram images');
  await assertBlueTexture(scene);
  await save();
  await page.reload();
  await until(async () => await page.locator('.react-flow__node-CustomImageNode [data-custom-image-state="ready"]').count() === 2,
    'Placed 2D images did not reload after removing their template');
  assert(state.assetReads.filter((url) => url.endsWith('/image.png?signature=mock')).length > imageReadsBeforeRemoval,
    'Reload did not read the retained asset from the same signed S3 location');
  assert.deepEqual(imageNodes().map((node) => ({ id: node.id, assetId: node.data.assetId, definitionId: node.data.definitionId, label: node.data.label })),
    placedImagesBeforeRemoval, 'Reload lost placed images after template removal');
  await mode('3D');
  await get3D();
  await assertBlueTexture(scene);
  checks.push('Removing a reusable node preserves both placed images and their S3 asset across 2D reload and 3D rendering');

  await customLibrariesCta.click();
  await libraryDialog.waitFor({ state: 'visible' });
  await libraryDialog.getByRole('button', { name: 'Select My devices', exact: true }).click();
  const confirmationCount = dialogs.length;
  await libraryDialog.getByRole('button', { name: 'Remove', exact: true }).click();
  await until(() => state.sections.length === 0, 'Library archive did not complete');
  assert(dialogs.length > confirmationCount && /Remove section.*My devices/.test(dialogs.at(-1)), 'Removing a section must ask for confirmation');
  await libraryDialog.getByRole('button', { name: 'Close custom libraries', exact: true }).click();
  await libraryDialog.waitFor({ state: 'hidden' });
  await tile.waitFor({ state: 'detached' });
  assert.equal(imageNodes().length, 2, 'Archiving library removed diagram nodes');
  await assertBlueTexture(scene);
  await save();
  const nativeDownload = page.waitForEvent('download');
  await page.keyboard.press('Control+Shift+s');
  const native = await nativeDownload;
  const nativeText = await readFile(await native.path(), 'utf8');
  assert(nativeText.includes(assetId) && !nativeText.includes('blob:') && !nativeText.includes('mock-s3'), 'Native export must contain stable asset IDs only');
  await native.saveAs(path.join(output, 'custom-library.easydraw'));
  checks.push('Archiving removes palette entries while preserving placed images and stable native export');

  state.missingAsset = true;
  await page.reload();
  await page.locator('[data-custom-image-state="error"]').first().waitFor();
  const expectedDialogs = dialogs.length;
  const unexpectedDownloads = [];
  page.on('download', (download) => unexpectedDownloads.push(download.suggestedFilename()));
  await triggerExport();
  await until(() => dialogs.length > expectedDialogs, 'Missing asset export did not fail visibly');
  assert.match(dialogs.at(-1), /Export to PNG failed/);
  await mode('3D');
  await get3D();
  await visible(page.getByText('Image unavailable', { exact: true })).first().waitFor();
  const nextDialogs = dialogs.length;
  await triggerExport();
  await until(() => dialogs.length > nextDialogs, '3D missing texture export did not fail visibly');
  assert.equal(unexpectedDownloads.length, 0, 'Export downloaded incomplete artwork');
  checks.push('Missing assets show placeholders and prevent incomplete 2D and 3D exports');

  assert.equal(state.blocked.filter((request) => /^(POST|PATCH|DELETE|PUT) /.test(request)).length, 0, `Unexpected write requests: ${state.blocked.join(', ')}`);
  assert.deepEqual(errors, [], 'Browser console/runtime errors');
  console.log(JSON.stringify({ result: 'PASS', checks, artifacts: output, saves: state.patches.length, blocked: state.blocked }, null, 2));
  await writeFile(path.join(output, 'report.json'), JSON.stringify({ result: 'PASS', checks, saves: state.patches.length, requests: state.requests, blocked: state.blocked }, null, 2));
} catch (error) {
  await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
  await writeFile(path.join(output, 'failure.json'), JSON.stringify({ error: String(error), stack: error.stack, checks, errors, dialogs, requests: state.requests, blocked: state.blocked }, null, 2));
  console.error(`Smoke failed; artifacts: ${output}`);
  throw error;
} finally {
  clearTimeout(watchdog);
  await context.close();
  await browser.close();
}
