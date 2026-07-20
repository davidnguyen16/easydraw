import { config } from 'dotenv';
import { resolve } from 'node:path';

// Load test variables before Jest imports AppModule.
config({
  path: resolve(process.cwd(), '.env.test'),
  override: true,
});

if (process.env.NODE_ENV !== 'test') {
  throw new Error('E2E tests require NODE_ENV=test');
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is missing');
}

const parsedDatabaseUrl = new URL(databaseUrl);

// Prevent tests from connecting to development or production.
if (
  parsedDatabaseUrl.hostname !== '127.0.0.1' ||
  parsedDatabaseUrl.port !== '5433' ||
  parsedDatabaseUrl.pathname !== '/easydraw_test'
) {
  throw new Error(
    `Refusing to run e2e against: ${databaseUrl}`,
  );
}