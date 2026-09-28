// Operator-only cleanup. Dry-run is default; --execute is explicitly destructive.
// Only exact database-recorded keys passing the maintenance safety check qualify.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(new URL('../server/package.json', import.meta.url));
require('dotenv').config({ path: fileURLToPath(new URL('../server/.env', import.meta.url)), quiet: true });
require('reflect-metadata');
const args = process.argv.slice(2);
if (args.some((arg) => arg !== '--execute' && !/^--limit=\d+$/.test(arg))) {
  throw new Error('Usage: node scripts/maintain-node-assets.mjs [--limit=25] [--execute]');
}
const execute = args.includes('--execute');
const limit = Number(args.find((arg) => arg.startsWith('--limit='))?.slice(8) ?? 25);
if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error('Limit must be 1..100.');
const target = new URL(process.env.DATABASE_URL);
console.log(`Asset maintenance: ${execute ? 'EXECUTE (permanent deletion)' : 'DRY RUN (no changes)'}; database ${target.hostname}:${target.port || '5432'}${target.pathname}`);
if (execute && (!process.env.AWS_REGION || !process.env.AWS_S3_ASSETS_BUCKET)) {
  throw new Error('Refusing cleanup without the private S3 bucket and region configured.');
}
let PrismaService, S3AssetsService, NodeLibraryMaintenanceService;
try {
  ({ PrismaService } = require('../server/dist/prisma/prisma.service.js'));
  ({ S3AssetsService } = require('../server/dist/node-library/s3-assets.service.js'));
  ({ NodeLibraryMaintenanceService } = require('../server/dist/node-library/node-library-maintenance.service.js'));
} catch {
  throw new Error('Build the backend first: npm run build:packages && npm run build:server');
}
const prisma = new PrismaService();
try {
  await prisma.$connect();
  const result = await new NodeLibraryMaintenanceService(prisma, new S3AssetsService()).run({ execute, limit });
  console.log(JSON.stringify(result, null, 2));
  if (result.failed.length) process.exitCode = 1;
} finally { await prisma.$disconnect(); }
