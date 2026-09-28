import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as bcrypt from 'bcryptjs';
import type { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import { UnauthorizedException } from '@nestjs/common';
import type { MailService } from '../mail/mail.service';
import type { Cache } from 'cache-manager';

// Replace the real bcrypt function with Jest mock function.
// This prevents the test from performing real password
jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

// Define a simpler type for bcrypt.compare().
// bcrypt has multiple overloads, so this avoid TypeScript mock errors.

type ComparePassword = (
  password: string,
  passwordHash: string,
) => Promise<boolean>;

// Convert bcrypt.compare into a typed Jest mock
const comparePasswordMock =
  bcrypt.compare as unknown as jest.MockedFunction<ComparePassword>;

describe('AuthService.login', () => {
  // real service that we want to test
  let authService: AuthService;

  // Mock Prisma so the test does not connect to PostgreSQL
  const prismaMock = {
    user: {
      findUnique: jest.fn(),
    },
  };

  const mailServiceMock = {};

  const cacheManagerMock = {
    del: jest.fn(),
  };

  // Use a fixed date to keep the expected result predictable
  const createdAt = new Date('2026-01-02T03:04:05.000Z');

  // Fake user returned by Prisma
  const existingUser = {
    id: 'user-1',
    email: 'alice@example.com',
    passwordHash: 'stored-password-hash',
    name: 'Alice',
    createdAt,
  };

  type FindUniqueUser = (args: {
    where: {
      email: string;
    };
  }) => Promise<typeof existingUser | null>;

  // Create a typed version of the Prisma mock.
  const findUniqueUserMock = prismaMock.user
    .findUnique as unknown as jest.MockedFunction<FindUniqueUser>;

  // Run before every test case.
  beforeEach(() => {
    // Reset calls and previous mock results.
    jest.resetAllMocks();

    // Create the real AuthService with fake dependencies.
    authService = new AuthService(
      prismaMock as unknown as PrismaService,
      mailServiceMock as unknown as MailService,
      cacheManagerMock as unknown as Cache,
    );
  });

  it('should return the account when credentials are valid', async () => {
    // Arrange:
    // Make Prisma return an existing user.
    findUniqueUserMock.mockResolvedValue(existingUser);

    // Pretend that the entered password matches the stored hash
    comparePasswordMock.mockResolvedValue(true);

    // Act:
    // Call the real login() method.
    const result = await authService.login('alice@example.com', 'password123');

    // Assert:
    // Verify that Prisma searched using the correct email.
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: {
        email: 'alice@example.com',
      },
    });

    // Verify that bcrypt compared the entered password
    // with the password hash stored in the database.
    expect(comparePasswordMock).toHaveBeenCalledWith(
      'password123',
      'stored-password-hash',
    );

    // login() identifies the account; the session is opened by the
    // controller, which is the layer that knows the browser and the IP.
    expect(result).toEqual({
      user: {
        id: 'user-1',
        email: 'alice@example.com',
        name: 'Alice',
        createdAt,
      },
    });

    // Ensure that sensitive data is not included in the response.
    expect(result.user).not.toHaveProperty('passwordHash');
  });

  it('should throw UnauthorizedException when the user does not exist', async () => {
    // Arrange:
    // Pretend that Prisma cannot find a user with this email.
    findUniqueUserMock.mockResolvedValue(null);

    // Act and Assert:
    // Verify that login() rejects with UnauthorizedException.
    await expect(
      authService.login('missing@example.com', 'password123'),
    ).rejects.toThrow(UnauthorizedException);

    // Password comparison must not run when the user does not exist.
    expect(comparePasswordMock).not.toHaveBeenCalled();
  });

  it('should throw UnauthorizedException when the password is incorrect', async () => {
    // Arrange:
    // Prisma finds the user, but bcrypt reports that the password is incorrect
    findUniqueUserMock.mockResolvedValue(existingUser);
    comparePasswordMock.mockResolvedValue(false);

    // Act and Assert;
    await expect(
      authService.login('alice@example.com', 'wrong-password'),
    ).rejects.toThrow(UnauthorizedException);

    // Verify that bcrypt received the entered password and stored hash.
    expect(comparePasswordMock).toHaveBeenCalledWith(
      'wrong-password',
      'stored-password-hash',
    );
  });

  it('should refuse an account that has no password, without calling bcrypt', async () => {
    // An account created through Google has no passwordHash. The password
    // form must not be a way in, and must not say which case it hit.
    findUniqueUserMock.mockResolvedValue({
      ...existingUser,
      passwordHash: null as unknown as string,
    });

    await expect(
      authService.login('alice@example.com', 'password123'),
    ).rejects.toThrow(UnauthorizedException);

    expect(comparePasswordMock).not.toHaveBeenCalled();
  });
});
