import type { ConnectionOptions } from 'node:tls';
import { pgConnection, prismaCliUrl } from './database-url';

const BASE = 'postgresql://app:p%40ss%2Fword@db.example.com:5432/easydraw';
const readCa = jest.fn((path: string) => `CA from ${path}`);
const dev = { NODE_ENV: 'development' };
const prod = { NODE_ENV: 'production' };

function tls(ssl: ConnectionOptions | false | undefined): ConnectionOptions {
  if (!ssl) throw new Error('expected TLS options');
  return ssl;
}

describe('pgConnection (runtime pool)', () => {
  beforeEach(() => readCa.mockClear());

  it('keeps certificate and hostname verification for verify-full (audit R9)', () => {
    const { connectionString, ssl } = pgConnection(
      `${BASE}?sslmode=verify-full&sslrootcert=/certs/rds.pem`,
      dev,
      readCa,
    );

    expect(tls(ssl)).toEqual({
      ca: 'CA from /certs/rds.pem',
      rejectUnauthorized: true,
    });
    // Node's default checkServerIdentity (hostname check) stays in force.
    expect(tls(ssl).checkServerIdentity).toBeUndefined();
    expect(connectionString).toBe(BASE);
  });

  it('trusts the public CA store for verify-full without a root certificate', () => {
    expect(
      pgConnection(`${BASE}?sslmode=verify-full`, dev, readCa).ssl,
    ).toEqual({ rejectUnauthorized: true });
    expect(readCa).not.toHaveBeenCalled();
  });

  it('turns TLS off for sslmode=disable instead of forcing it on (audit R9)', () => {
    expect(pgConnection(`${BASE}?sslmode=disable`, dev).ssl).toBe(false);
  });

  it('leaves TLS unset when the URL says nothing, as before', () => {
    expect(pgConnection(BASE, dev).ssl).toBeUndefined();
  });

  it.each([
    ['sslmode first', `${BASE}?sslmode=require&schema=public`],
    ['sslmode last', `${BASE}?schema=public&sslmode=require`],
    [
      'sslmode between',
      `${BASE}?connect_timeout=5&sslmode=require&schema=public`,
    ],
  ])(
    'keeps the database path and other parameters intact (%s, audit R9)',
    (_, raw) => {
      const { connectionString, schema } = pgConnection(raw, dev);
      const parsed = new URL(connectionString);

      expect(parsed.pathname).toBe('/easydraw');
      expect(parsed.searchParams.get('schema')).toBe('public');
      expect(parsed.searchParams.has('sslmode')).toBe(false);
      expect(parsed.password).toBe('p%40ss%2Fword');
      expect(schema).toBe('public');
    },
  );

  it('encrypts without verification only for plain require, as libpq does', () => {
    expect(pgConnection(`${BASE}?sslmode=require`, dev).ssl).toEqual({
      rejectUnauthorized: false,
    });
  });

  it.each([
    ['verify-ca', `${BASE}?sslmode=verify-ca&sslrootcert=/certs/ca.pem`],
    [
      'require with a root certificate',
      `${BASE}?sslmode=require&sslrootcert=/certs/ca.pem`,
    ],
  ])('verifies the chain but not the hostname for %s', (_, raw) => {
    const ssl = tls(pgConnection(raw, dev, readCa).ssl);

    expect(ssl.rejectUnauthorized).toBe(true);
    expect(ssl.ca).toBe('CA from /certs/ca.pem');
    expect(
      ssl.checkServerIdentity?.('db.example.com', {} as never),
    ).toBeUndefined();
  });

  it('reads the root certificate from PGSSLROOTCERT when the URL has none', () => {
    const ssl = tls(
      pgConnection(
        `${BASE}?sslmode=verify-full`,
        { ...dev, PGSSLROOTCERT: '/env/ca.pem' },
        readCa,
      ).ssl,
    );
    expect(ssl.ca).toBe('CA from /env/ca.pem');
  });

  it.each([
    ['no sslmode', BASE],
    ['disable', `${BASE}?sslmode=disable`],
    ['require', `${BASE}?sslmode=require`],
    ['verify-ca', `${BASE}?sslmode=verify-ca`],
  ])('refuses to start in production with %s', (_, raw) => {
    expect(() => pgConnection(raw, prod, readCa)).toThrow(
      'sslmode=verify-full in production',
    );
  });

  it('accepts verify-full in production', () => {
    expect(
      tls(
        pgConnection(
          `${BASE}?sslmode=verify-full&sslrootcert=/certs/rds.pem`,
          prod,
          readCa,
        ).ssl,
      ).rejectUnauthorized,
    ).toBe(true);
  });

  it.each(['prefer', 'allow', 'VERIFY-FULL'])(
    'rejects sslmode=%s rather than guessing',
    (mode) => {
      expect(() => pgConnection(`${BASE}?sslmode=${mode}`, dev)).toThrow(
        'sslmode must be one of',
      );
    },
  );

  it.each(['sslcert', 'sslkey', 'ssl', 'uselibpqcompat', 'sslaccept'])(
    'rejects the unsupported %s parameter',
    (param) => {
      expect(() =>
        pgConnection(`${BASE}?sslmode=verify-full&${param}=x`, dev),
      ).toThrow(`"${param}" is not supported`);
    },
  );

  it('never puts the password in an error message', () => {
    const attempts = [
      `${BASE}?sslmode=prefer`,
      `${BASE}?sslmode=require`,
      'mysql://app:p%40ss%2Fword@db/x',
      'not a url p%40ss%2Fword',
    ];
    for (const raw of attempts) {
      try {
        pgConnection(raw, prod);
      } catch (error) {
        expect((error as Error).message).not.toContain('p%40ss');
        continue;
      }
      throw new Error(`expected ${raw} to be refused`);
    }
  });

  it('requires DATABASE_URL', () => {
    expect(() => pgConnection(undefined, dev)).toThrow(
      'DATABASE_URL is not set',
    );
  });
});

describe('prismaCliUrl (migrations)', () => {
  it('translates verify-full into strict verification against the root certificate', () => {
    const url = new URL(
      prismaCliUrl(
        `${BASE}?sslmode=verify-full&sslrootcert=/certs/rds.pem&schema=public`,
        dev,
      )!,
    );

    expect(url.searchParams.get('sslmode')).toBe('require');
    expect(url.searchParams.get('sslaccept')).toBe('strict');
    expect(url.searchParams.get('sslcert')).toBe('/certs/rds.pem');
    expect(url.searchParams.has('sslrootcert')).toBe(false);
    expect(url.searchParams.get('schema')).toBe('public');
    expect(url.pathname).toBe('/easydraw');
  });

  it('keeps strict verification for verify-full without a root certificate', () => {
    const url = new URL(prismaCliUrl(`${BASE}?sslmode=verify-full`, dev)!);
    expect(url.searchParams.get('sslaccept')).toBe('strict');
    expect(url.searchParams.has('sslcert')).toBe(false);
  });

  it('passes require and disable through unchanged', () => {
    expect(new URL(prismaCliUrl(`${BASE}?sslmode=require`, dev)!).search).toBe(
      '?sslmode=require',
    );
    expect(new URL(prismaCliUrl(`${BASE}?sslmode=disable`, dev)!).search).toBe(
      '?sslmode=disable',
    );
    expect(prismaCliUrl(BASE, dev)).toBe(BASE);
  });

  it('applies the same production rule as the API', () => {
    expect(() => prismaCliUrl(`${BASE}?sslmode=require`, prod)).toThrow(
      'verify-full in production',
    );
  });

  it('leaves an absent URL absent so prisma generate works without a database', () => {
    expect(prismaCliUrl(undefined, dev)).toBeUndefined();
  });
});
