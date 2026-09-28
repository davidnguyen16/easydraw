#!/usr/bin/env node
/**
 * Adds the 3D object starter set (packages/objects-3d/recipes) to an
 * account's private libraries through the ordinary API, so the objects are
 * indistinguishable from ones designed in the editor and can be renamed,
 * exported or removed there like any other library entry. Each object goes
 * into the library named by its `group` ("Data centre", "Office"), created
 * if missing; `--library <name>` files everything into that one library.
 *
 * Re-running is safe: objects already present (by name, in any library) are skipped.
 *
 *   node scripts/seed-objects-3d.mjs --api http://localhost:3000 --email you@example.com --password '…'
 *   node scripts/seed-objects-3d.mjs --api https://api.easydraw.net --token <access_token jwt> --library "3D objects"
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RECIPES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../packages/objects-3d/recipes');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[arg.slice(2)] = true;
    else {
      out[arg.slice(2)] = next;
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
const forcedLibrary = typeof args.library === 'string' && args.library.trim() ? args.library.trim() : null;

async function call(pathname, init = {}) {
  const res = await fetch(`${api}${pathname}`, {
    ...init,
    headers: {
      ...(typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Cookie: `access_token=${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${pathname} → ${res.status} ${(await res.text()).slice(0, 300)}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
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

const libraries = new Map();
async function libraryId(name) {
  // Users rename libraries freely ("DATA CENTRE"), so names match case-insensitively.
  const key = name.trim().toLowerCase();
  if (libraries.size === 0) for (const section of (await call('/node-library/sections')).sections) libraries.set(section.name.trim().toLowerCase(), section.id);
  if (!libraries.has(key)) {
    const created = await call('/node-library/sections', { method: 'POST', body: JSON.stringify({ name }) });
    libraries.set(key, created.id);
    console.log(`Created library "${name}".`);
  }
  return libraries.get(key);
}

async function main() {
  if (!token) await login();
  const existing = new Set((await call('/object-library/objects')).map((o) => o.name));
  const files = (await readdir(RECIPES)).filter((f) => f.endsWith('.json')).sort();
  let added = 0;
  let skipped = 0;
  for (const file of files) {
    const object = JSON.parse(await readFile(path.join(RECIPES, file), 'utf8'));
    if (existing.has(object.name)) {
      skipped += 1;
      continue;
    }
    const library = forcedLibrary ?? object.group ?? '3D objects';
    const sectionId = await libraryId(library);
    await call('/object-library/objects', { method: 'POST', body: JSON.stringify({ sectionId, name: object.name, recipe: object.recipe }) });
    added += 1;
    process.stdout.write(`  ✓ ${object.name} → ${library}\n`);
  }
  console.log(`Done: ${added} added, ${skipped} already present.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
