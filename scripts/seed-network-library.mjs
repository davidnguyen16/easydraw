#!/usr/bin/env node
/**
 * Adds the Network symbol pack to one account's private node libraries.
 *
 * The 34 vendor-neutral device symbols that used to be the built-in Network
 * palette live as static SVGs in assets/network-library/ (see manifest.json).
 * This script pushes them through the ordinary upload flow — reserve, presigned
 * POST to S3, complete — so they end up as READY assets in a private section,
 * exactly as if they had been dropped into the library manager one by one.
 *
 * Re-running is safe: symbols already present in the section (by name) are
 * skipped.
 *
 *   node scripts/seed-network-library.mjs --api http://localhost:3000 --email you@example.com --password '…'
 *   node scripts/seed-network-library.mjs --api https://api.easydraw.net --token <access_token jwt>
 *   options: --section "Network" (default: the pack's name)
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PACK_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../assets/network-library');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[key] = true;
    else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const api = (args.api ?? 'http://localhost:3000').replace(/\/+$/, '');
if (!args.token && !(args.email && args.password)) {
  console.error('Provide --token <jwt> or --email <address> --password <password>.');
  process.exit(2);
}

let token = args.token;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function call(pathname, init = {}) {
  for (let attempt = 0; ; attempt += 1) {
    const res = await fetch(`${api}${pathname}`, {
      ...init,
      headers: {
        ...(init.body && typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Cookie: `access_token=${token}` } : {}),
        ...init.headers,
      },
    });
    if (res.status === 429 && attempt < 3) {
      // Uploads are rate-limited per minute; wait the window out and continue.
      const wait = Number(res.headers.get('retry-after')) * 1000 || 61_000;
      process.stdout.write(`  … rate limited, waiting ${Math.round(wait / 1000)}s\n`);
      await sleep(wait);
      continue;
    }
    if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${pathname} → ${res.status} ${(await res.text()).slice(0, 300)}`);
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }
}

async function login() {
  const res = await fetch(`${api}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: args.email, password: args.password }),
  });
  if (!res.ok) throw new Error(`Login failed (${res.status}).`);
  const cookie = res.headers.get('set-cookie')?.match(/access_token=([^;]+)/)?.[1];
  const body = await res.json().catch(() => ({}));
  token = cookie ?? body.access_token;
  if (!token) throw new Error('Login succeeded but no access token was returned.');
}

async function uploadToS3(url, fields, bytes, fileName, contentType) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  form.append('file', new Blob([bytes], { type: contentType }), fileName); // S3 requires the file last.
  const res = await fetch(url, { method: 'POST', body: form });
  if (!(res.status >= 200 && res.status < 300)) throw new Error(`S3 rejected the upload (${res.status}): ${(await res.text()).slice(0, 300)}`);
}

async function main() {
  const manifest = JSON.parse(await readFile(path.join(PACK_DIR, 'manifest.json'), 'utf8'));
  const sectionName = args.section ?? manifest.name;
  if (!token) await login();

  const { sections } = await call('/node-library/sections');
  let section = sections.find((s) => s.name === sectionName);
  if (!section) {
    section = await call('/node-library/sections', { method: 'POST', body: JSON.stringify({ name: sectionName }) });
    console.log(`Created private section "${sectionName}".`);
  } else {
    console.log(`Using existing private section "${sectionName}".`);
  }
  const existing = new Set((section.nodes ?? []).map((n) => n.name));

  let added = 0;
  let skipped = 0;
  for (const item of manifest.items) {
    if (existing.has(item.name)) {
      skipped += 1;
      continue;
    }
    const bytes = await readFile(path.join(PACK_DIR, item.file));
    const reservation = await call(`/node-library/sections/${section.id}/uploads`, {
      method: 'POST',
      body: JSON.stringify({ name: item.name, fileName: item.file, contentType: 'image/svg+xml', byteSize: bytes.length }),
    });
    await uploadToS3(reservation.url, reservation.fields, bytes, item.file, 'image/svg+xml');
    await call(`/node-library/uploads/${reservation.assetId}/complete`, { method: 'POST' });
    added += 1;
    process.stdout.write(`  ✓ ${item.name}\n`);
  }
  console.log(`Done: ${added} added, ${skipped} already present, in "${sectionName}".`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
