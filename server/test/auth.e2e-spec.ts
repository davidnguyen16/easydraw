import {
    INestApplication,
    UnauthorizedException,
    ValidationPipe,
} from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';
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
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';

// Describe the value returned by AuthService.login().
type LoginResult = {
    access_token: string;
    user: {
        id: string;
        email: string;
        name: string | null;
        createdAt: Date;
    };
};

// Describe the AuthService.login() function.
type Login = (
    email: string,
    password: string,
) => Promise<LoginResult>;

describe('POST /auth/login', () => {
    let app: INestApplication;

    // Mock only the service method.
    // The Nest controller and HTTP server remain real.
    const loginMock = jest.fn<Login>();

    beforeAll(async () => {
        // Create a small Nest application containing AuthController.
        const moduleRef = await Test.createTestingModule({
            controllers: [AuthController],
            providers: [
                {
                    provide: AuthService,
                    useValue: {
                        login: loginMock,
                    },
                },
                {

                    // AuthController also contains routes protected by JwtAuthGuard,
                    // so Nest needs a JwtService provider during initialization.
                    provide: JwtService,
                    useValue: {
                        verify: jest.fn(),
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

    it('should return 200 and set the access token cookie', async () => {
        // Arange:
        // Pretend that AuthService.login() succeeds.\
        loginMock.mockResolvedValue({
            access_token: 'test-access-token',
            user: {
                id: 'user-1',
                email: 'alice@example.com',
                name: 'Alice',
                createdAt: new Date('2026-01-02T03:04:05.000Z'),
            },
        });

        // Act:
        // Send a real HTTP request through Nest and Express.
        const response =  await request(app.getHttpServer())
            .post('/auth/login')
            .send({
                email: 'alice@example.com',
                password: 'password123',
            })
            .expect(200);

            // Assert:
            // Verify that the controller passed the correct values to the service.
            expect(loginMock).toHaveBeenCalledWith(
                'alice@example.com',
                'password123',
            );

            // Verify the response body.
            expect(response.body.access_token).toBe(
                'test-access-token',
            );

            // Verify that the controller created the authentication cookies.
            expect(response.headers['set-cookie'][0]).toContain(
                'access_token=test-access-token',
            );

            // JavaScript in the browser must not be able to read this cookie.
    expect(response.headers['set-cookie'][0]).toContain(
      'HttpOnly',
    );
  });

  it('should return 401 when the credentials are invalid', async () => {
    // Arrange:
    // Pretend that AuthService rejects the login attempt.
    loginMock.mockRejectedValue(
      new UnauthorizedException(
        'Email or password is incorrect',
      ),
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
 