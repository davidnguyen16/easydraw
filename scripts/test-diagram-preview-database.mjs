// Synthetic rows inside an isolated transactional schema. Always ROLLBACK;
// never copy user data, mutate app tables, or connect to a non-local database.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(new URL('../server/package.json', import.meta.url));
require('dotenv').config({ path: fileURLToPath(new URL('../server/.env', import.meta.url)), quiet: true });
const { Client } = require('pg');

async function main() {
  let url;
  try { url = new URL(process.env.DATABASE_URL); } catch { throw new Error('Local DATABASE_URL is not configured.'); }
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname), 'Refusing a non-local database.');
  const schema = `easydraw_previews_test_${randomUUID().replaceAll('-', '')}`;
  const client = new Client({ connectionString: url.toString(), connectionTimeoutMillis: 5000 });
  let begun = false;
  try {
    await client.connect();
    await client.query('BEGIN'); begun = true;
    await client.query('SET LOCAL statement_timeout = 10000');
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET LOCAL search_path TO "${schema}"`);
    // Only the two existing FK parents, with synthetic data. The migration
    // never ALTERs their content or needs application credentials/sessions.
    await client.query('CREATE TABLE "User" (id TEXT PRIMARY KEY)');
    await client.query('CREATE TABLE "Diagram" (id TEXT PRIMARY KEY, "ownerId" TEXT REFERENCES "User"(id) ON DELETE CASCADE, data JSONB NOT NULL)');
    const owner = randomUUID(), source = randomUUID(), snapshot = randomUUID(), preview = randomUUID(), request = randomUUID();
    const drawing = { version: 1, image: 'synthetic-only' };
    await client.query('INSERT INTO "User" VALUES ($1)', [owner]);
    await client.query('INSERT INTO "Diagram" VALUES ($1,$2,$3)', [source, owner, drawing]);
    await client.query(await readFile(new URL('../server/prisma/migrations/20260925090000_whiteboard_ai_previews/migration.sql', import.meta.url), 'utf8'));
    assert.deepEqual((await client.query('SELECT data FROM "Diagram" WHERE id=$1', [source])).rows[0].data, drawing);
    console.log('PASS: additive migration preserves existing drawing JSON');
    await client.query(`INSERT INTO "PreviewSourceSnapshot" (id,"ownerId","sourceObjectKey","modelInputObjectKey","unpublishedKeys","sourceSHA256","modelInputSHA256",width,height,"byteSize","modelInputWidth","modelInputHeight","cleanupAfter","leaseUntil","updatedAt")
      VALUES ($1,$2,$3,$4,$5,$6,$6,800,600,100,800,600,NOW()+INTERVAL '24 hours',NOW()+INTERVAL '3 minutes',NOW())`,
    [snapshot, owner, `whiteboard-previews/${owner}/${snapshot}/source.png`, `whiteboard-previews/${owner}/${snapshot}/model.png`, [`whiteboard-previews/${owner}/${snapshot}/source.png`, `whiteboard-previews/${owner}/${snapshot}/model.png`], 'a'.repeat(64)]);
    const insert = `INSERT INTO "DiagramPreview" (id,"ownerId","sourceWhiteboardId","sourceSnapshotId","clientRequestId","requestFingerprint","requestedModel","inputPipelineVersion","promptVersion","outputSchemaVersion","converterVersion","expiresAt","leaseUntil")
      VALUES ($1,$2,$3,$4,$5,$6,'gpt-6-sol','1','1','1','1',NOW()+INTERVAL '24 hours',NOW()+INTERVAL '3 minutes')`;
    await client.query(insert, [preview, owner, source, snapshot, request, 'b'.repeat(64)]);
    async function rejects(sql, values, code) {
      await client.query('SAVEPOINT expected_error');
      try { await client.query(sql, values); assert.fail('Invalid write was accepted.'); }
      catch (error) { assert.equal(error.code, code); }
      finally { await client.query('ROLLBACK TO SAVEPOINT expected_error'); }
    }
    await rejects(insert, [randomUUID(), owner, source, snapshot, randomUUID(), 'b'.repeat(64)], '23505');
    await rejects('UPDATE "DiagramPreview" SET status=\'READY\' WHERE id=$1', [preview], '23514');
    await rejects('UPDATE "PreviewSourceSnapshot" SET width=8193 WHERE id=$1', [snapshot], '23514');
    await rejects('UPDATE "PreviewSourceSnapshot" SET width=8192,height=8192 WHERE id=$1', [snapshot], '23514');
    await rejects('UPDATE "PreviewSourceSnapshot" SET "sourceSHA256"=\'bad\' WHERE id=$1', [snapshot], '23514');
    await rejects('UPDATE "DiagramPreview" SET "sourceSnapshotId"=$1 WHERE id=$2', [randomUUID(), preview], '23503');
    console.log('PASS: one-active-owner, READY integrity, image limits, hashes and foreign keys');
    await client.query('UPDATE "DiagramPreview" SET status=\'FAILED\' WHERE id=$1', [preview]);
    await rejects(insert, [randomUUID(), owner, source, snapshot, request, 'b'.repeat(64)], '23505');
    console.log('PASS: failed attempts still prevent request-ID reuse');
    await client.query('DELETE FROM "Diagram" WHERE id=$1', [source]);
    assert.equal((await client.query('SELECT "sourceWhiteboardId" FROM "DiagramPreview" WHERE id=$1', [preview])).rows[0].sourceWhiteboardId, null);
    assert.equal((await client.query('SELECT COUNT(*)::int AS n FROM "PreviewSourceSnapshot"')).rows[0].n, 1);
    await client.query('DELETE FROM "User" WHERE id=$1', [owner]);
    assert.equal((await client.query('SELECT COUNT(*)::int AS n FROM "DiagramPreview"')).rows[0].n, 0);
    const journal = (await client.query('SELECT * FROM "PreviewSourceSnapshot"')).rows[0];
    assert.equal(journal.ownerId, null); assert.equal(journal.unpublishedKeys.length, 2);
    console.log('PASS: source/account deletion retains exact S3 cleanup keys');
  } finally {
    if (begun) await client.query('ROLLBACK');
    await client.end();
    if (begun) console.log('Rolled back isolated test schema. Application data unchanged.');
  }
}
try { await main(); } catch (error) {
  // Do not print connection strings, database driver detail, or local secrets.
  console.error('Preview database check failed.', error?.code ? `Code: ${error.code}` : error?.name ?? 'Error');
  process.exitCode = 1;
}
