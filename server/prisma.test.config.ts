import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

// Load test environment variables instead of development variables.
config({
  path: '.env.test',
  override: true,
});

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is missing from .env.test');
}

const parsedDatabaseUrl = new URL(databaseUrl);

// Prevent Prisma from accidentally modifying the development
// or production database.
if (
  parsedDatabaseUrl.hostname !== '127.0.0.1' ||
  parsedDatabaseUrl.port !== '5433' ||
  parsedDatabaseUrl.pathname !== '/easydraw_test'
) {
  throw new Error(
    `Refusing to use a non-test database: ${databaseUrl}`,
  );
}

export default defineConfig({
  schema: 'prisma/schema.prisma',

  migrations: {
    path: 'prisma/migrations',
  },

  datasource: {
    url: databaseUrl,
  },
});