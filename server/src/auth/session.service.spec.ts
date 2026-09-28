import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as crypto from 'crypto';
import type { PrismaService } from '../prisma/prisma.service';
import { SessionService } from './session.service';

const sha256 = (value: string) =>
  crypto.createHash('sha256').update(value).digest('hex');

describe('SessionService', () => {
  let sessions: SessionService;

  const prismaMock = {
    session: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
    },
  };

  type CreateArgs = { data: Record<string, unknown> };
  type FindUniqueArgs = { where: { tokenHash: string } };

  const createMock = prismaMock.session
    .create as unknown as jest.MockedFunction<
    (args: CreateArgs) => Promise<unknown>
  >;
  const findUniqueMock = prismaMock.session
    .findUnique as unknown as jest.MockedFunction<
    (args: FindUniqueArgs) => Promise<unknown>
  >;
  const updateManyMock = prismaMock.session
    .updateMany as unknown as jest.MockedFunction<
    (args: unknown) => Promise<{ count: number }>
  >;

  /** A live session row, as Prisma would return it with the user included. */
  const liveRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'session-1',
    lastSeenAt: new Date(),
    expiresAt: new Date(Date.now() + 60_000),
    revokedAt: null,
    user: { id: 'user-1', email: 'alice@example.com' },
    ...overrides,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    sessions = new SessionService(prismaMock as unknown as PrismaService);
  });

  describe('create', () => {
    it('stores only the hash and hands the raw token back', async () => {
      createMock.mockResolvedValue({});

      const { token } = await sessions.create('user-1', {
        userAgent: 'Firefox',
        ipAddress: '203.0.113.9',
      });

      const { data } = createMock.mock.calls[0][0];

      // The row must never contain anything that can be replayed as a cookie.
      expect(data.tokenHash).toBe(sha256(token));
      expect(JSON.stringify(data)).not.toContain(token);
      expect(data).toMatchObject({
        userId: 'user-1',
        userAgent: 'Firefox',
        ipAddress: '203.0.113.9',
      });
    });

    it('issues a different token every time', async () => {
      createMock.mockResolvedValue({});

      const first = await sessions.create('user-1');
      const second = await sessions.create('user-1');

      expect(first.token).not.toBe(second.token);
      // 32 random bytes, base64url: 43 characters, no padding.
      expect(first.token).toHaveLength(43);
    });

    it('truncates an overlong user agent rather than letting it through', async () => {
      createMock.mockResolvedValue({});

      await sessions.create('user-1', { userAgent: 'x'.repeat(5000) });

      expect(
        (createMock.mock.calls[0][0].data.userAgent as string).length,
      ).toBe(255);
    });
  });

  describe('validate', () => {
    it('looks the session up by hash, never by the token itself', async () => {
      findUniqueMock.mockResolvedValue(liveRow());

      await sessions.validate('raw-token');

      expect(findUniqueMock.mock.calls[0][0].where.tokenHash).toBe(
        sha256('raw-token'),
      );
    });

    it('returns the account behind a live session', async () => {
      findUniqueMock.mockResolvedValue(liveRow());

      await expect(sessions.validate('raw-token')).resolves.toEqual({
        sub: 'user-1',
        email: 'alice@example.com',
        sessionId: 'session-1',
      });
    });

    it('refuses an unknown token', async () => {
      findUniqueMock.mockResolvedValue(null);

      await expect(sessions.validate('raw-token')).resolves.toBeNull();
    });

    it('refuses a revoked session — this is what signing out buys us', async () => {
      findUniqueMock.mockResolvedValue(liveRow({ revokedAt: new Date() }));

      await expect(sessions.validate('raw-token')).resolves.toBeNull();
    });

    it('refuses an expired session even though the row is still there', async () => {
      findUniqueMock.mockResolvedValue(
        liveRow({ expiresAt: new Date(Date.now() - 1000) }),
      );

      await expect(sessions.validate('raw-token')).resolves.toBeNull();
    });

    it('leaves lastSeenAt alone on a session seen moments ago', async () => {
      findUniqueMock.mockResolvedValue(liveRow());

      await sessions.validate('raw-token');

      // This runs on every authenticated request; a write each time would
      // turn every read into a write.
      expect(prismaMock.session.update).not.toHaveBeenCalled();
    });

    it('refreshes lastSeenAt once it is stale', async () => {
      findUniqueMock.mockResolvedValue(
        liveRow({ lastSeenAt: new Date(Date.now() - 2 * 60 * 60 * 1000) }),
      );
      (
        prismaMock.session.update as unknown as jest.MockedFunction<
          (args: unknown) => Promise<unknown>
        >
      ).mockResolvedValue({});

      await sessions.validate('raw-token');

      expect(prismaMock.session.update).toHaveBeenCalled();
    });
  });

  describe('revoke', () => {
    it('matches on the hash and ignores an already revoked row', async () => {
      updateManyMock.mockResolvedValue({ count: 1 });

      await sessions.revoke('raw-token');

      expect(updateManyMock).toHaveBeenCalledWith({
        where: { tokenHash: sha256('raw-token'), revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('revokeAll can spare the session that asked for it', async () => {
      updateManyMock.mockResolvedValue({ count: 2 });

      await expect(sessions.revokeAll('user-1', 'session-1')).resolves.toBe(2);
      expect(updateManyMock).toHaveBeenCalledWith({
        where: { userId: 'user-1', revokedAt: null, id: { not: 'session-1' } },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('revokeById only touches a session owned by the caller', async () => {
      updateManyMock.mockResolvedValue({ count: 0 });

      // Another account's session id must not be revocable from here.
      await expect(
        sessions.revokeById('user-1', 'someone-elses'),
      ).resolves.toBe(false);
      expect(updateManyMock.mock.calls[0][0]).toMatchObject({
        where: { id: 'someone-elses', userId: 'user-1' },
      });
    });
  });
});
