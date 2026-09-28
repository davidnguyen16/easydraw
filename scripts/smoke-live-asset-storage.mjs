/**
 * Opt-in REAL S3 check: creates at most three tiny objects under random test
 * keys, then deletes only those exact keys. No database/user/diagram writes.
 * Browser POST/GET enforce real CORS from http://localhost:5173.
 * Requires an existing playwright-core installation and a built backend.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

assert.deepEqual(process.argv.slice(2), ['--live'], 'Pass --live to permit temporary S3 test objects.');
const require = createRequire(new URL('../server/package.json', import.meta.url));
require('dotenv').config({ path: fileURLToPath(new URL('../server/.env', import.meta.url)), quiet: true });
require('reflect-metadata');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright-core');
const { S3Client, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { S3AssetsService } = require('../server/dist/node-library/s3-assets.service.js');
const { processUploadedImage } = require('../server/dist/node-library/image-processing.js');
const storage = new S3AssetsService();
storage.requireConfiguration();
const client = new S3Client({ region: process.env.AWS_REGION, maxAttempts: 1 });
const ownerId = `smoke-${randomUUID()}`;
const assetId = randomUUID();
const attemptId = randomUUID();
const keys = [
  `pending/${ownerId}/${assetId}/${attemptId}`,
  `assets/${ownerId}/${assetId}/${attemptId}/image.png`,
  `assets/${ownerId}/${assetId}/${attemptId}/thumbnail.png`,
];
const attempted = new Set();
const origin = 'http://localhost:5173';
const source = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="24"><rect x="2" y="2" width="28" height="20" rx="3" fill="#2563eb"/></svg>';
let browser;
let stage = 'browser setup';
let passed = false;
try {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.BROWSER_EXECUTABLE_PATH ? { executablePath: process.env.BROWSER_EXECUTABLE_PATH } : {}),
    args: ['--renderer-process-limit=1'],
  });
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  const form = await storage.createUpload(keys[0], 'image/svg+xml', Buffer.byteLength(source));
  const s3Origin = new URL(form.url).origin;
  assert.equal(new URL(s3Origin).protocol, 'https:');
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.href === `${origin}/__easydraw-s3-check__`) {
      return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>S3 storage check</title>' });
    }
    // S3 responses are real; no application API or other site may be touched.
    return url.origin === s3Origin ? route.continue() : route.abort();
  });
  await page.goto(`${origin}/__easydraw-s3-check__`);
  stage = 'browser presigned POST';
  attempted.add(keys[0]);
  const uploadStatus = await page.evaluate(async ({ form, source }) => {
    const body = new FormData();
    for (const [key, value] of Object.entries(form.fields)) body.append(key, value);
    body.append('file', new Blob([source], { type: 'image/svg+xml' }), 'storage-check.svg');
    const response = await fetch(form.url, { method: 'POST', body, signal: AbortSignal.timeout(30_000) });
    return response.status;
  }, { form, source });
  assert.equal(uploadStatus, 204, 'Presigned browser POST must succeed.');
  console.log('PASS browser upload with real localhost CORS.');

  stage = 'server validation and PNG publication';
  const input = await storage.readUpload(keys[0], Buffer.byteLength(source), 'image/svg+xml');
  assert.equal(input.toString(), source);
  const processed = await processUploadedImage(input, 'image/svg+xml', 16_000_000);
  assert.equal(processed.width, 32);
  assert.equal(processed.height, 24);
  for (const [key, body] of [[keys[1], processed.image], [keys[2], processed.thumbnail]]) {
    attempted.add(key);
    await storage.putImage(key, body);
    stage = 'browser signed image read';
    const url = await storage.signRead(key);
    assert.equal(new URL(url).origin, s3Origin);
    const decoded = await page.evaluate(async (url) => {
      const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!response.ok) return { status: response.status };
      const blob = await response.blob();
      const bitmap = await createImageBitmap(blob);
      const result = { status: response.status, type: blob.type, width: bitmap.width, height: bitmap.height };
      bitmap.close();
      return result;
    }, url);
    assert.deepEqual(decoded, { status: 200, type: 'image/png', width: 32, height: 24 });
  }
  console.log('PASS server HEAD/GET, safe image conversion, immutable PUT, browser image/thumbnail decoding.');

  stage = 'unsigned access check';
  const unsignedUrl = new URL(await storage.signRead(keys[1]));
  unsignedUrl.search = '';
  const unsignedResponse = await fetch(unsignedUrl, { signal: AbortSignal.timeout(10_000) });
  await unsignedResponse.body?.cancel();
  assert.equal(unsignedResponse.status, 403, 'The test image must not be publicly readable.');
  console.log('PASS unsigned access is denied.');
  passed = true;
} catch (error) {
  // Never print presigned URLs, credentials, or browser request diagnostics.
  console.error(`FAIL ${stage} (${error.name}; HTTP ${error.$metadata?.httpStatusCode ?? 'n/a'}).`);
  process.exitCode = 1;
} finally {
  await browser?.close();
  let cleaned = 0;
  for (const key of attempted) {
    assert(keys.includes(key) && key.includes(`/${ownerId}/${assetId}/${attemptId}`), 'Refuse unrelated cleanup.');
    try {
      await storage.deletePendingOrUnpublished(key);
      try {
        await client.send(new HeadObjectCommand({ Bucket: process.env.AWS_S3_ASSETS_BUCKET, Key: key }), {
          abortSignal: AbortSignal.timeout(10_000),
        });
        throw new Error('Test object is still readable.');
      } catch (error) {
        if (error.$metadata?.httpStatusCode !== 404) throw error;
      }
      cleaned++;
    } catch {
      console.error(`Cleanup needs operator attention for exact test key: ${key}`);
      process.exitCode = 1;
    }
  }
  client.destroy();
  console.log(`Cleanup: ${cleaned}/${attempted.size} test keys deleted and confirmed absent. No database records changed.`);
  if (passed && !process.exitCode) console.log('Live S3 storage smoke passed.');
}
