// Isolated transactional schema on the configured LOCAL PostgreSQL only.
// Existing tables are never written. ROLLBACK removes all test DDL/data.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(new URL('../server/package.json', import.meta.url));
require('dotenv').config({ path: fileURLToPath(new URL('../server/.env', import.meta.url)), quiet: true });
const { Client } = require('pg');
const url = new URL(process.env.DATABASE_URL);
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname), 'Refusing a non-local database');
const schema = `easydraw_custom_nodes_test_${randomUUID().replaceAll('-', '')}`;
assert.match(schema, /^easydraw_custom_nodes_test_[a-f0-9]{32}$/);
const client = new Client({ connectionString: url.toString(), connectionTimeoutMillis: 5000 });
let begun = false;
await client.connect();
try {
  await client.query('BEGIN'); begun = true;
  await client.query('SET LOCAL statement_timeout = 10000');
  const source = (await client.query('SELECT current_schema() AS name')).rows[0].name;
  assert.match(source, /^[a-zA-Z_][a-zA-Z0-9_]*$/);
  await client.query(`CREATE SCHEMA "${schema}"`);
  await client.query(`SET LOCAL search_path TO "${schema}"`);
  // Copy only table definitions, never personal data. Match the current app's
  // User/Diagram columns so the additive migration is checked against reality.
  await client.query(`CREATE TABLE "User" (LIKE "${source}"."User" INCLUDING ALL)`);
  await client.query(`CREATE TABLE "Diagram" (LIKE "${source}"."Diagram" INCLUDING ALL)`);
  await client.query('ALTER TABLE "Diagram" ADD FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE');
  const owner = randomUUID(); const diagram = randomUUID(); const section = randomUUID(); const asset = randomUUID(); const definition = randomUUID();
  const oldGraph = { pages: [{ id: 'old', name: 'Legacy', nodes: [{ id: 'shape', type: 'RectangleNode', data: { label: 'Kept' } }], edges: [] }], activePageId: 'old' };
  await client.query('INSERT INTO "User" (id,email,"updatedAt") VALUES ($1,$2,NOW())', [owner, `${owner}@test.invalid`]);
  await client.query('INSERT INTO "Diagram" (id,title,type,data,"ownerId","updatedAt") VALUES ($1,$2,$3,$4,$5,NOW())', [diagram, 'Existing diagram', 'erd', oldGraph, owner]);
  const migration = await readFile(new URL('../server/prisma/migrations/20260918000000_custom_node_libraries/migration.sql', import.meta.url), 'utf8');
  await client.query(migration);
  assert.deepEqual((await client.query('SELECT data FROM "Diagram" WHERE id=$1', [diagram])).rows[0].data, oldGraph);
  console.log('PASS: additive migration preserves a pre-existing legacy diagram');
  await client.query('INSERT INTO "CustomNodeSection" (id,"ownerId",name,"updatedAt") VALUES ($1,$2,$3,NOW())', [section, owner, 'Factory']);
  await client.query(`INSERT INTO "Asset" (id,"ownerId","originalName","originalMimeType","mimeType","byteSize","storedBytes","uploadKey","s3Key","thumbnailKey",width,height,checksum,status,"updatedAt") VALUES ($1,$2,'robot.png','image/png','image/png',10,20,'pending/test','assets/test/image.png','assets/test/thumb.png',20,10,'abc','READY',NOW())`, [asset, owner]);
  await client.query('INSERT INTO "CustomNodeDefinition" (id,"sectionId","assetId",name,"updatedAt") VALUES ($1,$2,$3,$4,NOW())', [definition, section, asset, 'Robot']);
  await client.query('INSERT INTO "DiagramAsset" ("diagramId","assetId") VALUES ($1,$2)', [diagram, asset]);
  await client.query('UPDATE "CustomNodeSection" SET "deletedAt"=NOW() WHERE id=$1', [section]);
  assert.equal((await client.query('SELECT COUNT(*)::int AS n FROM "DiagramAsset" WHERE "assetId"=$1', [asset])).rows[0].n, 1);
  console.log('PASS: archiving a library leaves diagram asset references intact');
  async function expectConstraint(sql, values, code) {
    await client.query('SAVEPOINT expected_error');
    try { await client.query(sql, values); assert.fail('Constraint did not reject invalid write'); }
    catch (error) { assert.equal(error.code, code); }
    finally { await client.query('ROLLBACK TO SAVEPOINT expected_error'); }
  }
  await expectConstraint('DELETE FROM "Asset" WHERE id=$1', [asset], '23503');
  await expectConstraint('INSERT INTO "DiagramAsset" ("diagramId","assetId") VALUES ($1,$2)', [diagram, asset], '23505');
  await expectConstraint('UPDATE "CustomNodeDefinition" SET "defaultWidth"=-1 WHERE id=$1', [definition], '23514');
  await expectConstraint('UPDATE "Asset" SET "s3Key"=NULL WHERE id=$1', [asset], '23514');
  console.log('PASS: FK, unique references, dimensions and READY asset constraints');
  await client.query('DELETE FROM "User" WHERE id=$1', [owner]);
  const tombstone = (await client.query('SELECT "ownerId","s3Key" FROM "Asset" WHERE id=$1', [asset])).rows[0];
  assert.equal(tombstone.ownerId, null); assert.equal(tombstone.s3Key, 'assets/test/image.png');
  assert.equal((await client.query('SELECT COUNT(*)::int AS n FROM "DiagramAsset"')).rows[0].n, 0);
  assert.equal((await client.query('SELECT COUNT(*)::int AS n FROM "CustomNodeDefinition"')).rows[0].n, 0);
  console.log('PASS: account deletion cascades library/diagrams but retains S3 cleanup tombstones');
} finally {
  if (begun) await client.query('ROLLBACK');
  await client.end();
  console.log('Rolled back the isolated test schema; existing application data was not changed.');
}
