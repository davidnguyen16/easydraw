import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const TEST_EMAIL = 'login-e2e@easydraw.test';
const TEST_PASSWORD = 'password123';
// Browsers send Origin on every cross-origin POST; the API only accepts its own.
const APP_ORIGIN = process.env.CLIENT_URL ?? 'http://localhost:5173';

/** Pulls the session cookie out of a Set-Cookie header, however it arrives. */
function sessionCookie(header: unknown): string {
  const cookies: string[] = Array.isArray(header)
    ? header.filter((value): value is string => typeof value === 'string')
    : typeof header === 'string'
      ? [header]
      : [];

  const cookie = cookies.find((value) => value.startsWith('session='));

  if (!cookie) {
    throw new Error('No session cookie was set');
  }

  return cookie.split(';')[0];
}

/** The database stores the SHA-256 of the cookie value, never the value. */
function tokenHashOf(cookie: string): string {
  const token = cookie.slice('session='.length);
  return crypto.createHash('sha256').update(token).digest('hex');
}

describe('POST /auth/login (full e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let fixtureUserId: string;

  // Remove only data created by this test.
  async function cleanFixture() {
    const users = await prisma.user.findMany({
      where: {
        email: TEST_EMAIL,
      },
      select: {
        id: true,
      },
    });

    const userIds = users.map((user) => user.id);

    if (userIds.length === 0) {
      return;
    }

    // Delete related diagrams before deleting users.
    // Sessions and tokens cascade from the user row.
    await prisma.$transaction([
      prisma.diagram.deleteMany({
        where: {
          ownerId: {
            in: userIds,
          },
        },
      }),
      prisma.user.deleteMany({
        where: {
          id: {
            in: userIds,
          },
        },
      }),
    ]);
  }

  beforeAll(async () => {
    // Create the complete Nest application.
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();

    // Apply the same important middleware used by main.ts.
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
      }),
    );

    await app.init();

    prisma = app.get(PrismaService);

    // Verify the actual connected database before changing data.
    const [database] = await prisma.$queryRaw<
      Array<{ name: string }>
    >`SELECT current_database() AS name`;

    if (database.name !== 'easydraw_test') {
      throw new Error(`Refusing to clean database: ${database.name}`);
    }

    // Remove data left by a previously interrupted test.
    await cleanFixture();

    // Create a real user with a real bcrypt password hash.
    const user = await prisma.user.create({
      data: {
        email: TEST_EMAIL,
        name: 'E2E User',
        passwordHash: await bcrypt.hash(TEST_PASSWORD, 10),
      },
    });

    fixtureUserId = user.id;
  });

  afterAll(async () => {
    try {
      // Remove the test user after all tests finish.
      if (prisma) {
        await cleanFixture();
      }
    } finally {
      // Always close the Nest application and database connection.
      if (app) {
        await app.close();
      }
    }
  });

  it('should return 200, an HTTP-only cookie, and a session row holding only its hash', async () => {
    // Send a real request through the complete application.
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', APP_ORIGIN)
      .send({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      })
      .expect(200);

    const { user } = response.body as { user: Record<string, unknown> };

    // Verify the user loaded from PostgreSQL.
    expect(user).toMatchObject({
      id: fixtureUserId,
      email: TEST_EMAIL,
      name: 'E2E User',
    });

    // Sensitive data must not be returned.
    expect(user).not.toHaveProperty('passwordHash');

    const cookie = sessionCookie(response.headers['set-cookie']);
    expect(String(response.headers['set-cookie'])).toContain('HttpOnly');

    // The row the cookie points at belongs to this user, is live, and holds
    // the hash rather than anything that could be replayed as a cookie.
    const session = await prisma.session.findUnique({
      where: { tokenHash: tokenHashOf(cookie) },
    });

    expect(session).not.toBeNull();
    expect(session!.userId).toBe(fixtureUserId);
    expect(session!.revokedAt).toBeNull();
    expect(session!.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('should accept the cookie on a guarded route, then refuse it once signed out', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', APP_ORIGIN)
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD })
      .expect(200);

    const cookie = sessionCookie(login.headers['set-cookie']);

    // The session works.
    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', cookie)
      .expect(200);

    expect(me.body).toMatchObject({ id: fixtureUserId, email: TEST_EMAIL });

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Origin', APP_ORIGIN)
      .set('Cookie', cookie)
      .expect(201);

    // The same cookie is now dead. This is what a database-backed session
    // buys over a signed token, which would stay valid until it expired.
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', cookie)
      .expect(401);

    const session = await prisma.session.findUnique({
      where: { tokenHash: tokenHashOf(cookie) },
    });

    expect(session!.revokedAt).not.toBeNull();
  });

  it('should return 401 when the real password comparison fails', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', APP_ORIGIN)
      .send({
        email: TEST_EMAIL,
        password: 'wrong-password',
      })
      .expect(401)
      .expect({
        message: 'Email or password is incorrect',
        error: 'Unauthorized',
        statusCode: 401,
      });
  });
});
