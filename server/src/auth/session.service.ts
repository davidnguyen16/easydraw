import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

/** How long a new session stays valid. Renewed sessions get a fresh window. */
export const SESSION_DAYS = 30;

/**
 * `lastSeenAt` is only rewritten once an hour. It exists to tell the owner
 * which devices are active, not to be accurate to the second, and this runs
 * on every authenticated request.
 */
const LAST_SEEN_INTERVAL_MS = 60 * 60 * 1000;

/** Where the sign-in came from, shown back to the owner in their device list. */
export interface SessionDevice {
  userAgent?: string;
  ipAddress?: string;
}

/** What a validated session tells the request handler about the caller. */
export interface SessionUser {
  sub: string;
  email: string;
  sessionId: string;
}

/**
 * Issues and checks browser sessions.
 *
 * The cookie carries 32 random bytes; the database stores only their SHA-256,
 * so a leaked table yields no usable session. Because every request resolves
 * the token against a row, revoking one takes effect immediately — the reason
 * this replaced a signed token that stayed valid until it expired.
 */
@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * SHA-256, not bcrypt: the input is 256 bits of randomness, so there is
   * nothing to guess, and this runs on every single request.
   */
  private hash(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /** Opens a session and returns the raw token, which is never stored. */
  async create(userId: string, device: SessionDevice = {}) {
    const token = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

    await this.prisma.session.create({
      data: {
        userId,
        tokenHash: this.hash(token),
        // A user agent string has no length limit; keep the column sane.
        userAgent: device.userAgent?.slice(0, 255) ?? null,
        ipAddress: device.ipAddress ?? null,
        expiresAt,
      },
    });

    return { token, expiresAt };
  }

  /**
   * Resolves a cookie token to its account, or null when the session is
   * unknown, revoked or past its expiry. Expiry is enforced on read rather
   * than by a sweeper, so a stale row can never authenticate anyone.
   */
  async validate(token: string): Promise<SessionUser | null> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: this.hash(token) },
      include: { user: { select: { id: true, email: true } } },
    });

    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      return null;
    }

    if (Date.now() - session.lastSeenAt.getTime() > LAST_SEEN_INTERVAL_MS) {
      await this.prisma.session.update({
        where: { id: session.id },
        data: { lastSeenAt: new Date() },
      });
    }

    return {
      sub: session.user.id,
      email: session.user.email,
      sessionId: session.id,
    };
  }

  /**
   * Ends one session. Revoking rather than deleting keeps the row for the
   * owner to see, and an unknown token is a no-op: signing out twice, or
   * with a token that already expired, is not an error.
   */
  async revoke(token: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { tokenHash: this.hash(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Ends every session for an account, optionally sparing the one that asked.
   * Used after a password reset, where the point is to lock out whoever else
   * may be signed in.
   */
  async revokeAll(userId: string, exceptSessionId?: string): Promise<number> {
    const { count } = await this.prisma.session.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
      },
      data: { revokedAt: new Date() },
    });
    return count;
  }

  /** The devices currently signed in, most recently active first. */
  async list(userId: string, currentSessionId?: string) {
    const sessions = await this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastSeenAt: 'desc' },
      select: {
        id: true,
        userAgent: true,
        ipAddress: true,
        createdAt: true,
        lastSeenAt: true,
        expiresAt: true,
      },
    });

    return sessions.map((session) => ({
      ...session,
      current: session.id === currentSessionId,
    }));
  }

  /**
   * Ends one named session, and only if it belongs to the caller — otherwise
   * an id from another account would sign that account out.
   */
  async revokeById(userId: string, sessionId: string): Promise<boolean> {
    const { count } = await this.prisma.session.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return count > 0;
  }
}
