import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { diagramListCacheKey } from '../diagrams/diagrams.cache';

/** A reset link is meant to be used straight away; the email says 30 minutes. */
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;
/** Verification is less urgent — people open that email the next morning. */
const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

/** The user fields an auth response may expose. Never a hash, never a role. */
type AccountRow = {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
};

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/**
 * A secret that travels by email: random enough that guessing is hopeless, so
 * only its SHA-256 goes to the database. The raw value exists just long enough
 * to be put in a link.
 */
function issueSecret() {
  const token = crypto.randomBytes(32).toString('hex');
  return { token, tokenHash: sha256(token) };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  /**
   * The shape every sign-in returns. The session itself is opened by the
   * controller, which is the only layer that knows the browser and the IP.
   */
  private account(user: AccountRow) {
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
      },
    };
  }

  async register(email: string, password: string, name?: string) {
    const existing = await this.prisma.user.findUnique({ where: { email } });

    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash: hashedPassword,
        name,
      },
    });

    await this.sendVerificationEmail(user.id, user.email);

    return this.account(user);
  }

  /**
   * Resolves a Google profile to an account, linking or creating as needed.
   *
   * The link lives in OAuthAccount keyed by the provider's subject id rather
   * than by the address, so someone who changes their Google email keeps this
   * account. Attaching to an existing password account by address is only safe
   * because Google has verified that address.
   */
  async validateGoogleUser(profile: {
    googleId: string;
    email: string;
    name?: string;
  }) {
    // Signed in with Google before: the link already exists.
    const link = await this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: 'GOOGLE',
          providerAccountId: profile.googleId,
        },
      },
      include: { user: true },
    });

    if (link) return this.account(link.user);

    // Registered with a password before: attach Google to that account.
    const existing = await this.prisma.user.findUnique({
      where: { email: profile.email },
    });

    if (existing) {
      await this.prisma.oAuthAccount.create({
        data: {
          provider: 'GOOGLE',
          providerAccountId: profile.googleId,
          email: profile.email,
          userId: existing.id,
        },
      });
      return this.account(existing);
    }

    // First time here: write the account and its link together, so a failure
    // cannot leave a user with no way at all to sign in. No passwordHash —
    // Google is the credential, and Google has verified the address.
    const createdAt = new Date();
    const user = await this.prisma.user.create({
      data: {
        email: profile.email,
        name: profile.name,
        createdAt,
        emailVerifiedAt: createdAt,
        oauthAccounts: {
          create: {
            provider: 'GOOGLE',
            providerAccountId: profile.googleId,
            email: profile.email,
          },
        },
      },
    });

    return this.account(user);
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Email or password is incorrect');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);

    if (!valid) {
      throw new UnauthorizedException('Email or password is incorrect');
    }

    return this.account(user);
  }

  /** Records a successful sign-in. A failure here must not fail the sign-in. */
  async noteLogin(userId: string): Promise<void> {
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { lastLoginAt: new Date() },
      });
    } catch {
      this.logger.warn('Could not record lastLoginAt');
    }
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      emailVerified: user.emailVerifiedAt !== null,
      createdAt: user.createdAt,
    };
  }

  async deleteAccount(userId: string) {
    await this.prisma.$transaction(async (tx) => {
      // All diagram/asset writers lock the owner before child rows. Match that
      // order so account deletion cannot deadlock with an in-flight autosave.
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      await tx.diagram.deleteMany({
        where: { ownerId: userId },
      });

      // Sessions, OAuth links and pending tokens all cascade from this row.
      await tx.user.delete({
        where: { id: userId },
      });
    });

    // A diagram list can be cached briefly. Remove it after the database
    // transaction so deleted account data is not served from cache.
    try {
      await this.cacheManager.del(diagramListCacheKey(userId));
    } catch {
      // The account deletion has already committed. Do not turn it into
      // a misleading failure response if cache cleanup is unavailable.
      this.logger.warn('Could not clear diagram cache after account deletion');
    }
  }

  // ── Password reset ─────────────────────────────────────────────────────

  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    // Always answer the same way, so this endpoint cannot be used to discover
    // which addresses have accounts.
    if (!user) return;

    const { token, tokenHash } = issueSecret();

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });

    const clientUrl = process.env.CLIENT_URL ?? 'http://localhost:5173';
    await this.mailService.sendPasswordReset(
      user.email,
      `${clientUrl}/reset-password?token=${token}`,
    );
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: sha256(token) },
    });

    if (!record || record.usedAt || record.expiresAt <= new Date()) {
      throw new BadRequestException('Invalid or expired reset link');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await this.prisma.$transaction(async (tx) => {
      // Match the owner-first lock order used by account deletion and other
      // writers. Two links for one user must not deadlock or both reset them.
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${record.userId} FOR UPDATE`;
      const now = new Date();
      const claimed = await tx.passwordResetToken.updateMany({
        where: { id: record.id, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (claimed.count !== 1) {
        throw new BadRequestException('Invalid or expired reset link');
      }
      await tx.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      });
      // Single use — and any other outstanding link dies with it, so an older
      // email cannot be replayed once this one has been spent.
      await tx.passwordResetToken.updateMany({
        where: { userId: record.userId, usedAt: null },
        data: { usedAt: now },
      });
      // Whoever reset this password may be locking an intruder out, so every
      // session opened before now has to go — including the intruder's. This
      // is the whole reason sessions live in a table we can revoke.
      await tx.session.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: now },
      });
    });
  }

  // ── Email verification ─────────────────────────────────────────────────

  /**
   * Issues a verification link for an address. `email` may differ from the
   * account's current address while a change is pending; it becomes the
   * account address only once the link is opened.
   *
   * A failure to send must not fail whatever triggered it: the account exists
   * either way, and the owner can ask for another link.
   */
  async sendVerificationEmail(userId: string, email: string): Promise<void> {
    try {
      const { token, tokenHash } = issueSecret();

      await this.prisma.emailVerificationToken.create({
        data: {
          userId,
          email,
          tokenHash,
          expiresAt: new Date(Date.now() + VERIFY_TOKEN_TTL_MS),
        },
      });

      const clientUrl = process.env.CLIENT_URL ?? 'http://localhost:5173';
      await this.mailService.sendEmailVerification(
        email,
        `${clientUrl}/verify-email?token=${token}`,
      );
    } catch {
      this.logger.warn(`Could not send a verification email to ${email}`);
    }
  }

  async resendVerification(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) throw new UnauthorizedException('User not found');
    if (user.emailVerifiedAt) return;

    await this.sendVerificationEmail(user.id, user.email);
  }

  async verifyEmail(token: string): Promise<{ email: string }> {
    const record = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash: sha256(token) },
    });

    if (!record || record.usedAt || record.expiresAt <= new Date()) {
      throw new BadRequestException('Invalid or expired verification link');
    }

    // The address may have been claimed by someone else between the link being
    // sent and opened, which the unique index would reject anyway.
    const clash = await this.prisma.user.findUnique({
      where: { email: record.email },
      select: { id: true },
    });

    if (clash && clash.id !== record.userId) {
      throw new ConflictException(
        'That address now belongs to another account',
      );
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { email: record.email, emailVerifiedAt: new Date() },
      }),
      this.prisma.emailVerificationToken.updateMany({
        where: { userId: record.userId, usedAt: null },
        data: { usedAt: new Date() },
      }),
    ]);

    return { email: record.email };
  }
}
