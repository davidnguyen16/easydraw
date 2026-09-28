#!/usr/bin/env node
/**
 * One-time upgrade for diagrams saved while 3D looks were still named
 * presets (`visual3d: { version: 1, kind }`). Each such node gets the part
 * list of the matching starter object embedded, exactly as the editor would
 * store it today; nodes naming an unknown kind are left alone (they render
 * as their plain shape).
 *
 *   node scripts/upgrade-visual3d.mjs --api http://localhost:3000 --token <access_token jwt>
 *   node scripts/upgrade-visual3d.mjs --api https://api.easydraw.net --email you@example.com --password '…'
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
let token = args.token;
if (!token && !(args.email && args.password)) {
  console.error('Provide --token <jwt> or --email <address> --password <password>.');
  process.exit(2);
}

async function call(pathname, init = {}) {
  const res = await fetch(`${api}${pathname}`, {
    ...init,
    headers: { ...(typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Cookie: `access_token=${token}` } : {}) },
  });
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${pathname} → ${res.status} ${(await res.text()).slice(0, 300)}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function login() {
  const res = await fetch(`${api}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: args.email, password: args.password }) });
  if (!res.ok) throw new Error(`Login failed (${res.status}).`);
  token = res.headers.get('set-cookie')?.match(/access_token=([^;]+)/)?.[1] ?? (await res.json().catch(() => ({}))).access_token;
  if (!token) throw new Error('Login succeeded but no access token was returned.');
}

async function main() {
  if (!token) await login();
  const byKind = new Map();
  for (const file of (await readdir(RECIPES)).filter((f) => f.endsWith('.json'))) {
    const object = JSON.parse(await readFile(path.join(RECIPES, file), 'utf8'));
    byKind.set(object.id, { version: 2, parts: object.recipe.parts });
  }
  const diagrams = await call('/diagrams');
  let touched = 0;
  for (const summary of diagrams) {
    const diagram = await call(`/diagrams/${summary.id}`);
    const pages = Array.isArray(diagram.data?.pages) ? diagram.data.pages : null;
    if (!pages) continue;
    let changed = 0;
    for (const page of pages) {
      for (const node of page.nodes ?? []) {
        const recipe = node.data?.visual3d;
        if (recipe?.version === 1 && byKind.has(recipe.kind)) {
          node.data.visual3d = byKind.get(recipe.kind);
          changed += 1;
        }
      }
    }
    if (!changed) continue;
    await call(`/diagrams/${summary.id}`, { method: 'PATCH', body: JSON.stringify({ data: diagram.data }) });
    touched += 1;
    console.log(`  ✓ ${summary.title}: ${changed} object${changed === 1 ? '' : 's'} upgraded`);
  }
  console.log(`Done: ${touched} diagram${touched === 1 ? '' : 's'} updated.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
