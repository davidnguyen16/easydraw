import {
  BadRequestException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Regression tests for the 28 September 2026 release audit (R3–R6), run
 * through the real application against the isolated test database: the bugs
 * they cover only showed up with real constraints, guards and transactions.
 */
const EMAIL_DOMAIN = '@security-e2e.easydraw.test';
const PASSWORD = 'password123';
const APP_ORIGIN = process.env.CLIENT_URL ?? 'http://localhost:5173';
const OTHER_ORIGIN = 'https://attacker.example';

function cookiesFrom(header: unknown): string[] {
  const cookies = Array.isArray(header)
    ? header
    : typeof header === 'string'
      ? [header]
      : [];
  return cookies.map((cookie: string) => cookie.split(';')[0]);
}

function namedCookie(header: unknown, name: string): string {
  const cookie = cookiesFrom(header).find((value) =>
    value.startsWith(`${name}=`),
  );
  if (!cookie) throw new Error(`No ${name} cookie was set`);
  return cookie;
}

const sha256 = (value: string) =>
  crypto.createHash('sha256').update(value).digest('hex');

describe('auth security (full e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let auth: AuthService;

  // Remove only data created by this file.
  async function cleanFixtures() {
    const users = await prisma.user.findMany({
      where: { email: { endsWith: EMAIL_DOMAIN } },
      select: { id: true },
    });
    const userIds = users.map((user) => user.id);
    if (userIds.length === 0) return;
    await prisma.$transaction([
      prisma.diagram.deleteMany({ where: { ownerId: { in: userIds } } }),
      prisma.user.deleteMany({ where: { id: { in: userIds } } }),
    ]);
  }

  async function createPasswordUser(localPart: string) {
    return prisma.user.create({
      data: {
        email: `${localPart}${EMAIL_DOMAIN}`,
        passwordHash: await bcrypt.hash(PASSWORD, 10),
      },
    });
  }

  async function signIn(email: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', APP_ORIGIN)
      .send({ email, password: PASSWORD })
      .expect(200);
    return namedCookie(response.headers['set-cookie'], 'session');
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    prisma = app.get(PrismaService);
    auth = app.get(AuthService);

    const [database] = await prisma.$queryRaw<
      Array<{ name: string }>
    >`SELECT current_database() AS name`;
    if (database.name !== 'easydraw_test') {
      throw new Error(`Refusing to clean database: ${database.name}`);
    }
    await cleanFixtures();
  });

  afterAll(async () => {
    try {
      if (prisma) await cleanFixtures();
    } finally {
      if (app) await app.close();
    }
  });

  describe('Google sign-in', () => {
    it('creates a first-time Google account that satisfies the verified-email constraint (R3)', async () => {
      const googleId = `google-${crypto.randomUUID()}`;
      const email = `first-google${EMAIL_DOMAIN}`;

      const created = await auth.validateGoogleUser({
        googleId,
        email,
        name: 'Google User',
      });

      const user = await prisma.user.findUniqueOrThrow({
        where: { id: created.user.id },
        include: { oauthAccounts: true },
      });
      expect(user.passwordHash).toBeNull();
      expect(user.emailVerifiedAt).not.toBeNull();
      expect(user.emailVerifiedAt!.getTime()).toBeGreaterThanOrEqual(
        user.createdAt.getTime(),
      );
      expect(user.oauthAccounts).toMatchObject([
        { provider: 'GOOGLE', providerAccountId: googleId },
      ]);

      // The next sign-in follows the link instead of creating another account.
      const again = await auth.validateGoogleUser({
        googleId,
        email,
        name: 'Google User',
      });
      expect(again.user.id).toBe(created.user.id);
    });

    it('binds the Google redirect to this browser with an unguessable state (R5)', async () => {
      const start = await request(app.getHttpServer())
        .get('/auth/google')
        .expect(302);

      const location = new URL(start.headers.location);
      expect(location.hostname).toBe('accounts.google.com');
      const state = location.searchParams.get('state');
      expect(state).toMatch(/^[A-Za-z0-9_-]{43}$/);
      const nonce = namedCookie(start.headers['set-cookie'], 'easydraw-oauth');
      expect(String(start.headers['set-cookie'])).toContain('HttpOnly');

      // A callback carrying the state but not this browser's nonce is refused
      // before any code exchange, so a copied link cannot sign anyone in.
      const withoutNonce = await request(app.getHttpServer())
        .get('/auth/google/callback')
        .query({ code: 'attacker-code', state: state! })
        .expect(401);
      expect(
        cookiesFrom(withoutNonce.headers['set-cookie']).some((c) =>
          c.startsWith('session='),
        ),
      ).toBe(false);

      // So is this browser's nonce with a state it was never issued.
      await request(app.getHttpServer())
        .get('/auth/google/callback')
        .set('Cookie', nonce)
        .query({
          code: 'attacker-code',
          state: crypto.randomBytes(32).toString('base64url'),
        })
        .expect(401);

      // And a callback with no state at all.
      await request(app.getHttpServer())
        .get('/auth/google/callback')
        .set('Cookie', nonce)
        .query({ code: 'attacker-code' })
        .expect(401);
    });
  });

  describe('cross-site request forgery (R4)', () => {
    it('refuses a cross-site form POST that would sign the user out', async () => {
      const user = await createPasswordUser('csrf-logout');
      const cookie = await signIn(user.email);

      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Origin', OTHER_ORIGIN)
        .set('Cookie', cookie)
        .type('form')
        .send('confirm=1')
        .expect(403);

      // The session survived the forged request.
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', cookie)
        .expect(200);
    });

    it('refuses cookie-authenticated mutations with a foreign, null or missing Origin', async () => {
      const user = await createPasswordUser('csrf-revoke');
      const cookie = await signIn(user.email);
      const other = await signIn(user.email);

      for (const origin of [OTHER_ORIGIN, 'null', undefined]) {
        const attempt = request(app.getHttpServer())
          .post('/auth/sessions/revoke-others')
          .set('Cookie', cookie);
        if (origin) attempt.set('Origin', origin);
        await attempt.expect(403);
      }
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', other)
        .expect(200);

      // The app itself can still do it.
      await request(app.getHttpServer())
        .post('/auth/sessions/revoke-others')
        .set('Origin', APP_ORIGIN)
        .set('Cookie', cookie)
        .expect(200, { revoked: 1 });
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', other)
        .expect(401);
    });

    it('refuses a sign-in started by another site, so no session is planted (login CSRF)', async () => {
      const user = await createPasswordUser('csrf-login');

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .set('Origin', OTHER_ORIGIN)
        .send({ email: user.email, password: PASSWORD })
        .expect(403);

      expect(response.headers['set-cookie']).toBeUndefined();
      expect(await prisma.session.count({ where: { userId: user.id } })).toBe(
        0,
      );
    });

    it('still serves non-browser clients that authenticate with a bearer token and no cookies', async () => {
      const user = await createPasswordUser('bearer-client');
      const token = (await signIn(user.email)).slice('session='.length);

      await request(app.getHttpServer())
        .post('/auth/sessions/revoke-others')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      await request(app.getHttpServer())
        .post('/auth/sessions/revoke-others')
        .set('Authorization', 'Bearer not-a-session')
        .expect(403);
    });
  });

  describe('password reset (R6)', () => {
    it('lets exactly one of two concurrent requests spend a reset link', async () => {
      const user = await createPasswordUser('reset-race');
      const cookie = await signIn(user.email);
      const token = crypto.randomBytes(32).toString('hex');
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: sha256(token),
          expiresAt: new Date(Date.now() + 60_000),
        },
      });

      const results = await Promise.allSettled([
        auth.resetPassword(token, 'first-new-password'),
        auth.resetPassword(token, 'second-new-password'),
      ]);

      const fulfilled = results.filter(
        (result) => result.status === 'fulfilled',
      );
      const rejected = results.filter((result) => result.status === 'rejected');
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toBeInstanceOf(BadRequestException);

      const winner =
        results[0].status === 'fulfilled'
          ? 'first-new-password'
          : 'second-new-password';
      const loser =
        winner === 'first-new-password'
          ? 'second-new-password'
          : 'first-new-password';
      const stored = await prisma.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      expect(await bcrypt.compare(winner, stored.passwordHash!)).toBe(true);
      expect(await bcrypt.compare(loser, stored.passwordHash!)).toBe(false);

      // The reset signed out the session opened before it, and the link is spent.
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', cookie)
        .expect(401);
      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .set('Origin', APP_ORIGIN)
        .send({ token, password: 'third-new-password' })
        .expect(400);
    });
  });
});
