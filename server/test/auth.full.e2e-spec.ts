import {
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from '@jest/globals';
import * as bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const TEST_EMAIL = 'login-e2e@easydraw.test';
const TEST_PASSWORD = 'password123';

describe('POST /auth/login (full e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
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

    // Get the real Prisma and JWT services.
    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);

    // Verify the actual connected database before changing data.
    const [database] = await prisma.$queryRaw<
      Array<{ name: string }>
    >`SELECT current_database() AS name`;

    if (database.name !== 'easydraw_test') {
      throw new Error(
        `Refusing to clean database: ${database.name}`,
      );
    }

    // Remove data left by a previously interrupted test.
    await cleanFixture();

    // Create a real user with a real bcrypt password hash.
    const user = await prisma.user.create({
      data: {
        email: TEST_EMAIL,
        name: 'E2E User',
        passwordHash: await bcrypt.hash(
          TEST_PASSWORD,
          10,
        ),
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

  it('should return 200, a real JWT, and an HTTP-only cookie', async () => {
    // Send a real request through the complete application.
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      })
      .expect(200);

    // Verify the user loaded from PostgreSQL.
    expect(response.body.user).toMatchObject({
      id: fixtureUserId,
      email: TEST_EMAIL,
      name: 'E2E User',
    });

    // Sensitive data must not be returned.
    expect(response.body.user).not.toHaveProperty(
      'passwordHash',
    );

    // Verify the token using the real JwtService.
    const payload = jwtService.verify<{
      sub: string;
      email: string;
    }>(response.body.access_token);

    expect(payload).toMatchObject({
      sub: fixtureUserId,
      email: TEST_EMAIL,
    });

    // Verify the real authentication cookie.
    const setCookieHeader = response.headers['set-cookie'];
    const cookies = Array.isArray(setCookieHeader)
      ? setCookieHeader
      : typeof setCookieHeader === 'string'
      ? [setCookieHeader]
      : [];

    expect(cookies.length).toBeGreaterThan(0);
    expect(cookies.join(';')).toContain('access_token=');
    expect(cookies.join(';')).toContain('HttpOnly');
  });

  it('should return 401 when the real password comparison fails', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
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