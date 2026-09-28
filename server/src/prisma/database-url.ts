import { readFileSync } from 'node:fs';
import type { ConnectionOptions } from 'node:tls';

/**
 * DATABASE_URL follows libpq: `sslmode` is disable | require | verify-ca |
 * verify-full, and `sslrootcert` (or PGSSLROOTCERT) names a PEM CA file.
 *
 * Neither consumer reads that correctly on its own. node-postgres lets TLS
 * settings in the URL override the `ssl` object it is given, and Prisma's
 * schema engine silently treats `verify-full` as "no verification". So the URL
 * is parsed once here and handed to each in the form it does understand.
 *
 * Production must verify the server: anything weaker than verify-full is
 * refused at startup rather than connecting unverified. Error messages never
 * include the URL, which carries the database password.
 */
export type SslMode = 'disable' | 'require' | 'verify-ca' | 'verify-full';

/** Parameters interpreted here; the drivers must never see them. */
const TLS_PARAMS = [
  'sslmode',
  'sslrootcert',
  'sslaccept',
  'sslcert',
  'sslkey',
  'sslpassword',
  'sslidentity',
  'uselibpqcompat',
  'ssl',
];
const SSL_MODES: readonly string[] = [
  'disable',
  'require',
  'verify-ca',
  'verify-full',
];

interface ParsedDatabaseUrl {
  url: URL;
  mode: SslMode | null;
  rootCert: string | null;
}

type Env = Record<string, string | undefined>;

function parse(raw: string | undefined, env: Env): ParsedDatabaseUrl {
  if (!raw) throw new Error('DATABASE_URL is not set.');
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('DATABASE_URL is not a valid URL.');
  }
  if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
    throw new Error('DATABASE_URL must be a postgresql:// URL.');
  }
  for (const param of [
    'sslcert',
    'sslkey',
    'sslpassword',
    'sslidentity',
    'ssl',
    'uselibpqcompat',
    'sslaccept',
  ]) {
    if (url.searchParams.has(param)) {
      throw new Error(
        `DATABASE_URL parameter "${param}" is not supported; use sslmode and sslrootcert.`,
      );
    }
  }

  const mode = url.searchParams.get('sslmode');
  if (mode !== null && !SSL_MODES.includes(mode)) {
    throw new Error(
      `DATABASE_URL sslmode must be one of ${SSL_MODES.join(', ')}.`,
    );
  }
  if (env.NODE_ENV === 'production' && mode !== 'verify-full') {
    throw new Error('DATABASE_URL must use sslmode=verify-full in production.');
  }

  const rootCert =
    url.searchParams.get('sslrootcert') ?? env.PGSSLROOTCERT ?? null;
  for (const param of TLS_PARAMS) url.searchParams.delete(param);
  return { url, mode: mode as SslMode | null, rootCert: rootCert || null };
}

/** Pool settings for @prisma/adapter-pg (node-postgres). */
export function pgConnection(
  raw: string | undefined,
  env: Env = process.env,
  readCa: (path: string) => string = (path) => readFileSync(path, 'utf8'),
): {
  connectionString: string;
  ssl: ConnectionOptions | false | undefined;
  schema?: string;
} {
  const { url, mode, rootCert } = parse(raw, env);
  // Prisma's own URL parameter; the adapter takes it as an option instead.
  const schema = url.searchParams.get('schema') ?? undefined;
  const ca = () => (rootCert ? { ca: readCa(rootCert) } : {});

  let ssl: ConnectionOptions | false | undefined;
  switch (mode) {
    case null:
      ssl = undefined;
      break;
    case 'disable':
      ssl = false;
      break;
    case 'require':
      // libpq: with a root certificate, require behaves like verify-ca.
      ssl = rootCert
        ? {
            ...ca(),
            rejectUnauthorized: true,
            checkServerIdentity: () => undefined,
          }
        : { rejectUnauthorized: false };
      break;
    case 'verify-ca':
      ssl = {
        ...ca(),
        rejectUnauthorized: true,
        checkServerIdentity: () => undefined,
      };
      break;
    case 'verify-full':
      // Without sslrootcert, Node's bundled public CAs are trusted.
      ssl = { ...ca(), rejectUnauthorized: true };
      break;
  }
  return { connectionString: url.toString(), ssl, schema };
}

/**
 * The same database in the form Prisma's schema engine (migrate, db
 * execute) understands: `sslaccept=strict` verifies the chain and hostname,
 * and `sslcert` is the trusted CA. That engine reads only the FIRST
 * certificate of the file, so that must be the server's root CA.
 */
export function prismaCliUrl(
  raw: string | undefined,
  env: Env = process.env,
): string | undefined {
  if (!raw) return undefined;
  const { url, mode, rootCert } = parse(raw, env);
  if (mode === 'disable') url.searchParams.set('sslmode', 'disable');
  if (mode === 'require' && !rootCert)
    url.searchParams.set('sslmode', 'require');
  if (
    mode === 'verify-ca' ||
    mode === 'verify-full' ||
    (mode === 'require' && rootCert)
  ) {
    url.searchParams.set('sslmode', 'require');
    url.searchParams.set('sslaccept', 'strict');
    if (rootCert) url.searchParams.set('sslcert', rootCert);
  }
  return url.toString();
}
