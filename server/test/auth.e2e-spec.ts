import {
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';

import { Test } from '@nestjs/testing';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { SessionService } from '../src/auth/session.service';

// Describe the value returned by AuthService.login().
type LoginResult = {
  user: {
    id: string;
    email: string;
    name: string | null;
    createdAt: Date;
  };
};

// Describe the AuthService.login() function.
type Login = (email: string, password: string) => Promise<LoginResult>;

// Describe SessionService.create(), which the controller calls after login.
type CreateSession = (
  userId: string,
  device?: { userAgent?: string; ipAddress?: string },
) => Promise<{ token: string; expiresAt: Date }>;

describe('POST /auth/login', () => {
  let app: INestApplication<App>;

  // Mock only the service methods.
  // The Nest controller and HTTP server remain real.
  const loginMock = jest.fn<Login>();
  const noteLoginMock = jest.fn<(userId: string) => Promise<void>>();
  const createSessionMock = jest.fn<CreateSession>();

  beforeAll(async () => {
    // Create a small Nest application containing AuthController.
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            login: loginMock,
            noteLogin: noteLoginMock,
          },
        },
        {
          // The controller opens the session itself, and its guarded
          // routes need this provider to exist at initialization.
          provide: SessionService,
          useValue: {
            create: createSessionMock,
            validate: jest.fn(),
            revoke: jest.fn(),
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();

    // main.ts is not executed during tests.
    // Add ValidationPipe manually to test DTO validation.
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
      }),
    );

    await app.init();
  });

  beforeEach(() => {
    // Keep every test independent.
    jest.resetAllMocks();
  });

  afterAll(async () => {
    // Close the Nest application after all tests finish.
    await app.close();
  });

  it('should return 200 and set the session cookie', async () => {
    // Arrange:
    // Pretend that AuthService.login() succeeds.
    loginMock.mockResolvedValue({
      user: {
        id: 'user-1',
        email: 'alice@example.com',
        name: 'Alice',
        createdAt: new Date('2026-01-02T03:04:05.000Z'),
      },
    });
    noteLoginMock.mockResolvedValue(undefined);
    createSessionMock.mockResolvedValue({
      token: 'test-session-token',
      expiresAt: new Date(Date.now() + 60_000),
    });

    // Act:
    // Send a real HTTP request through Nest and Express.
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'alice@example.com',
        password: 'password123',
      })
      .expect(200);

    // Assert:
    // Verify that the controller passed the correct values to the service.
    expect(loginMock).toHaveBeenCalledWith('alice@example.com', 'password123');

    // A session is opened for the account that just signed in.
    expect(createSessionMock).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ ipAddress: expect.any(String) }),
    );

    // Verify the response body. The token is not in it: the cookie is the
    // only place it belongs, where no script on the page can read it.
    const body = response.body as { user: Record<string, unknown> };
    expect(body.user).toMatchObject({
      id: 'user-1',
      email: 'alice@example.com',
    });
    expect(body).not.toHaveProperty('access_token');

    // Verify that the controller created the authentication cookie.
    expect(response.headers['set-cookie'][0]).toContain(
      'session=test-session-token',
    );

    // JavaScript in the browser must not be able to read this cookie.
    expect(response.headers['set-cookie'][0]).toContain('HttpOnly');
  });

  it('should return 401 when the credentials are invalid', async () => {
    // Arrange:
    // Pretend that AuthService rejects the login attempt.
    loginMock.mockRejectedValue(
      new UnauthorizedException('Email or password is incorrect'),
    );

    // Act and Assert:
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'alice@example.com',
        password: 'wrong-password',
      })
      .expect(401)
      .expect({
        message: 'Email or password is incorrect',
        error: 'Unauthorized',
        statusCode: 401,
      });

    // A failed sign-in must not open a session.
    expect(createSessionMock).not.toHaveBeenCalled();
  });

  it('should return 400 when the request body is invalid', async () => {
    // Send an invalid email.
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'not-an-email',
        password: 'password123',
      })
      .expect(400);

    // DTO validation must reject the request
    // before it reaches AuthService.
    expect(loginMock).not.toHaveBeenCalled();
  });
});
