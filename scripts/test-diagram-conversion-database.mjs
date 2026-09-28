// Synthetic records in an isolated LOCAL PostgreSQL schema. Never copy user
// rows, mutate application tables, apply application migrations, or contact S3.
// Every DDL/data write is enclosed in one transaction that is always rolled back.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(new URL('../server/package.json', import.meta.url));
require('dotenv').config({ path: fileURLToPath(new URL('../server/.env', import.meta.url)), quiet: true });
const { Client } = require('pg');
const SOURCE_HASH = 'a'.repeat(64), DOCUMENT_HASH = 'b'.repeat(64);
const approved = { version: 1, activePageId: 'page', pages: [{ id: 'page', name: 'Approved',
  nodes: [{ id: 'node', type: 'RectangleNode', position: { x: 12, y: 34 }, data: { label: 'Synthetic only' } }], edges: [] }] };

async function main() {
  let url;
  try { url = new URL(process.env.DATABASE_URL); } catch { throw new Error('Local DATABASE_URL is not configured.'); }
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname), 'Refusing a non-local database.');
  const schema = `easydraw_conversions_test_${randomUUID().replaceAll('-', '')}`;
  assert.match(schema, /^easydraw_conversions_test_[a-f0-9]{32}$/);
  const client = new Client({ connectionString: url.toString(), connectionTimeoutMillis: 5000 });
  let begun = false;
  try {
    await client.connect();
    await client.query('BEGIN'); begun = true;
    await client.query('SET LOCAL statement_timeout = 10000');
    await client.query('SET LOCAL lock_timeout = 5000');
    await client.query(`CREATE SCHEMA "${schema}"`);
    // No public/application schema appears in search_path. All migration names
    // and test SQL resolve only to the newly generated synthetic schema.
    await client.query(`SET LOCAL search_path TO "${schema}"`);
    await client.query('CREATE TABLE "User" (id TEXT PRIMARY KEY)');
    await client.query('CREATE TABLE "Diagram" (id TEXT PRIMARY KEY, "ownerId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE, data JSONB NOT NULL)');
    const owner = randomUUID(), source = randomUUID();
    const original = { version: 1, pack: 'whiteboard', width: 800, height: 600, image: 'synthetic-only' };
    await client.query('INSERT INTO "User" VALUES ($1)', [owner]);
    await client.query('INSERT INTO "Diagram" (id,"ownerId",data) VALUES ($1,$2,$3)', [source, owner, original]);
    for (const migration of ['20260925090000_whiteboard_ai_previews', '20260927090000_whiteboard_diagram_conversions']) {
      await client.query(await readFile(new URL(`../server/prisma/migrations/${migration}/migration.sql`, import.meta.url), 'utf8'));
    }
    const preserved = (await client.query('SELECT data,"ownerId","visualDocumentId" FROM "Diagram" WHERE id=$1', [source])).rows[0];
    assert.deepEqual(preserved.data, original);
    assert.equal(preserved.ownerId, owner);
    assert.equal(preserved.visualDocumentId, null);
    console.log('PASS: both additive migrations preserve existing drawing JSON, IDs and ownership');

    async function rejects(sql, values, code) {
      await client.query('SAVEPOINT expected_error');
      try { await client.query(sql, values); assert.fail('Invalid write was accepted.'); }
      catch (error) { assert.equal(error.code, code); }
      finally {
        await client.query('ROLLBACK TO SAVEPOINT expected_error');
        await client.query('RELEASE SAVEPOINT expected_error');
      }
    }
    const conversionInsert = `INSERT INTO "DiagramConversion"
      (id,"ownerId","previewId","diagramId","sourceWhiteboardId","sourceSnapshotId","sourceSHA256","approvedDocument","documentHash",
       "requestedModel","resolvedModel","inputPipelineVersion","promptVersion","outputSchemaVersion","converterVersion")
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'synthetic-model',NULL,'1','1','2','2')`;
    function conversionValues(fixture, overrides = {}) {
      const value = { ...fixture, ...overrides };
      return [value.receipt, value.owner, value.preview, value.output, value.source, value.snapshot, SOURCE_HASH, approved, DOCUMENT_HASH];
    }
    async function fixture(existingOwner, existingSource) {
      const item = { owner: existingOwner ?? randomUUID(), source: existingSource ?? randomUUID(), group: randomUUID(),
        output: randomUUID(), snapshot: randomUUID(), preview: randomUUID(), receipt: randomUUID(), request: randomUUID() };
      if (!existingOwner) await client.query('INSERT INTO "User" VALUES ($1)', [item.owner]);
      if (!existingSource) await client.query('INSERT INTO "Diagram" (id,"ownerId",data) VALUES ($1,$2,$3)', [item.source, item.owner, original]);
      await client.query('INSERT INTO "VisualDocument" (id,"ownerId",title,"updatedAt") VALUES ($1,$2,\'Synthetic group\',NOW())', [item.group, item.owner]);
      await client.query('UPDATE "Diagram" SET "visualDocumentId"=$1 WHERE id=$2', [item.group, item.source]);
      await client.query('INSERT INTO "Diagram" (id,"ownerId",data,"visualDocumentId") VALUES ($1,$2,$3,$4)', [item.output, item.owner, approved, item.group]);
      item.keys = [`whiteboard-previews/${item.owner}/${item.snapshot}/source.png`, `whiteboard-previews/${item.owner}/${item.snapshot}/model.png`];
      await client.query(`INSERT INTO "PreviewSourceSnapshot"
        (id,"ownerId","sourceObjectKey","modelInputObjectKey","unpublishedKeys","sourceSHA256","modelInputSHA256",width,height,"byteSize",
         "modelInputWidth","modelInputHeight",status,"cleanupAfter","leaseUntil","updatedAt")
        VALUES ($1,$2,$3,$4,$5,$6,$6,800,600,100,800,600,'READY',NOW()-INTERVAL '1 day',NOW()-INTERVAL '1 hour',NOW())`,
      [item.snapshot, item.owner, item.keys[0], item.keys[1], item.keys, SOURCE_HASH]);
      await client.query(`INSERT INTO "DiagramPreview"
        (id,"ownerId","sourceWhiteboardId","sourceSnapshotId","clientRequestId","sourceSHA256",status,"requestedModel",
         "inputPipelineVersion","promptVersion","outputSchemaVersion","converterVersion","convertedDocument","documentHash","readyAt","expiresAt","leaseUntil")
        VALUES ($1,$2,$3,$4,$5,$6,'READY','synthetic-model','1','1','2','2',$7,$8,NOW(),NOW()+INTERVAL '24 hours',NOW())`,
      [item.preview, item.owner, item.source, item.snapshot, item.request, SOURCE_HASH, approved, DOCUMENT_HASH]);
      await client.query(conversionInsert, conversionValues(item));
      return item;
    }

    const first = await fixture(owner, source);
    const alternateOutput = randomUUID();
    await client.query('INSERT INTO "Diagram" (id,"ownerId",data) VALUES ($1,$2,$3)', [alternateOutput, owner, approved]);
    await rejects(conversionInsert, conversionValues(first, { receipt: randomUUID(), output: alternateOutput }), '23505');
    await rejects(conversionInsert, conversionValues(first, { receipt: randomUUID(), preview: randomUUID() }), '23505');
    await rejects('UPDATE "DiagramConversion" SET "sourceSnapshotId"=NULL WHERE id=$1', [first.receipt], '23514');
    await rejects('UPDATE "DiagramConversion" SET "documentHash"=\'bad\' WHERE id=$1', [first.receipt], '23514');
    await rejects('UPDATE "DiagramConversion" SET "diagramDeletedAt"=NOW() WHERE id=$1', [first.receipt], '23514');
    await rejects('UPDATE "DiagramConversion" SET "sourceSnapshotId"=$1 WHERE id=$2', [randomUUID(), first.receipt], '23503');
    console.log('PASS: unique preview/output receipts, valid hashes, live/deleted payload invariants and foreign keys');

    await client.query('DELETE FROM "VisualDocument" WHERE id=$1', [first.group]);
    const members = (await client.query('SELECT id,data,"visualDocumentId" FROM "Diagram" WHERE id=ANY($1::text[]) ORDER BY id', [[source, first.output]])).rows;
    assert.equal(members.length, 2);
    assert.ok(members.every((row) => row.visualDocumentId === null));
    assert.deepEqual(members.find((row) => row.id === source).data, original);
    assert.deepEqual(members.find((row) => row.id === first.output).data, approved);
    console.log('PASS: deleting a Visual Document unlinks members without deleting either drawing');

    await client.query('DELETE FROM "Diagram" WHERE id=$1', [source]);
    const retained = (await client.query('SELECT * FROM "DiagramConversion" WHERE id=$1', [first.receipt])).rows[0];
    assert.equal(retained.sourceWhiteboardId, null);
    assert.equal(retained.diagramId, first.output);
    assert.equal(retained.sourceSnapshotId, first.snapshot);
    assert.deepEqual(retained.approvedDocument, approved);
    assert.deepEqual((await client.query('SELECT data FROM "Diagram" WHERE id=$1', [first.output])).rows[0].data, approved);
    await rejects('DELETE FROM "PreviewSourceSnapshot" WHERE id=$1', [first.snapshot], '23503');
    console.log('PASS: deleting the source preserves the derived diagram, exact approved JSON and restricted snapshot');

    await client.query(`UPDATE "DiagramPreview" SET status='EXPIRED',"convertedDocument"=NULL,"warnings"=NULL,
      "documentHash"=NULL,"sourceSnapshotId"=NULL WHERE id=$1`, [first.preview]);
    await client.query('DELETE FROM "DiagramPreview" WHERE id=$1', [first.preview]);
    assert.equal((await client.query('SELECT "previewId" FROM "DiagramConversion" WHERE id=$1', [first.receipt])).rows[0].previewId, first.preview);
    await rejects('DELETE FROM "PreviewSourceSnapshot" WHERE id=$1', [first.snapshot], '23503');
    const candidates = (await client.query(`SELECT snapshot.id FROM "PreviewSourceSnapshot" snapshot
      WHERE snapshot."cleanupAfter"<=NOW() AND snapshot."leaseUntil"<=NOW()
        AND NOT EXISTS (SELECT 1 FROM "DiagramConversion" conversion WHERE conversion."sourceSnapshotId"=snapshot.id)
      ORDER BY snapshot."cleanupAfter" LIMIT 10`)).rows;
    assert.ok(!candidates.some((row) => row.id === first.snapshot));
    console.log('PASS: preview expiry/removal cannot erase receipts or queue retained snapshots for cleanup');

    // Match the API's single-transaction output deletion order. The minimal
    // receipt remains unique after its large/private payloads are released.
    await client.query(`UPDATE "DiagramConversion" SET "diagramId"=NULL,"approvedDocument"=NULL,
      "sourceSnapshotId"=NULL,"diagramDeletedAt"=NOW() WHERE id=$1`, [first.receipt]);
    await client.query('DELETE FROM "Diagram" WHERE id=$1', [first.output]);
    const tombstone = (await client.query('SELECT * FROM "DiagramConversion" WHERE id=$1', [first.receipt])).rows[0];
    assert.equal(tombstone.diagramId, null);
    assert.equal(tombstone.sourceSnapshotId, null);
    assert.equal(tombstone.approvedDocument, null);
    assert.ok(tombstone.diagramDeletedAt);
    assert.equal(tombstone.previewId, first.preview);
    assert.equal(tombstone.documentHash, DOCUMENT_HASH);
    await rejects(conversionInsert, conversionValues(first, { receipt: randomUUID(), output: alternateOutput, source: null }), '23505');
    await client.query('DELETE FROM "PreviewSourceSnapshot" WHERE id=$1', [first.snapshot]);
    assert.equal((await client.query('SELECT COUNT(*)::int n FROM "PreviewSourceSnapshot" WHERE id=$1', [first.snapshot])).rows[0].n, 0);
    console.log('PASS: deleted output keeps its retry tombstone while releasing the source for eventual cleanup');

    const deletedAccount = await fixture();
    // Match AuthService: owner row first, owned diagrams, then owner cascade.
    await client.query('SELECT id FROM "User" WHERE id=$1 FOR UPDATE', [deletedAccount.owner]);
    await client.query('DELETE FROM "Diagram" WHERE "ownerId"=$1', [deletedAccount.owner]);
    await client.query('DELETE FROM "User" WHERE id=$1', [deletedAccount.owner]);
    for (const table of ['Diagram', 'VisualDocument', 'DiagramPreview', 'DiagramConversion']) {
      assert.equal((await client.query(`SELECT COUNT(*)::int n FROM "${table}" WHERE "ownerId"=$1`, [deletedAccount.owner])).rows[0].n, 0);
    }
    const journal = (await client.query('SELECT * FROM "PreviewSourceSnapshot" WHERE id=$1', [deletedAccount.snapshot])).rows[0];
    assert.equal(journal.ownerId, null);
    assert.equal(journal.sourceObjectKey, deletedAccount.keys[0]);
    assert.equal(journal.modelInputObjectKey, deletedAccount.keys[1]);
    assert.deepEqual(journal.unpublishedKeys, deletedAccount.keys);
    console.log('PASS: account deletion cascades designs/receipts/groups but preserves ownerless exact-key S3 journals');
    console.log('NOTE: these checks exercise PostgreSQL constraints, not concurrent application transactions.');
  } finally {
    try {
      if (begun) {
        await client.query('ROLLBACK');
        console.log('Rolled back isolated conversion test schema. Application data unchanged.');
      }
    } finally { await client.end(); }
  }
}

try { await main(); } catch (error) {
  // Never print connection strings, SQL values, driver details or local secrets.
  console.error('Conversion database check failed.', error?.code ? `Code: ${error.code}` : error?.name ?? 'Error');
  process.exitCode = 1;
}
