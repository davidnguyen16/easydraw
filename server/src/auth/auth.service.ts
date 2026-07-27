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
import { JwtService } from '@nestjs/jwt';
import { MailService } from '../mail/mail.service';
import { diagramListCacheKey } from '../diagrams/diagrams.cache';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private mailService: MailService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  private issueToken(user: {
    id: string;
    email: string;
    name: string | null;
    createdAt: Date;
  }) {
    const payload = {
      sub: user.id,
      email: user.email,
    };
    return {
      access_token: this.jwtService.sign(payload),
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

    return this.issueToken(user);
  }

  async validateGoogleUser(profile: {
    googleId: string;
    email: string;
    name?: string;
  }) {
    // Have logined with Google before -> Find by Google ID
    let user = await this.prisma.user.findUnique({
      where: { googleId: profile.googleId },
    });

    if (user) return this.issueToken(user);

    // Have registered with Email account before -> Update googleId to existed account
    const existing = await this.prisma.user.findUnique({
      where: { email: profile.email },
    });

    if (existing) {
      user = await this.prisma.user.update({
        where: { id: existing.id },
        data: { googleId: profile.googleId },
      });
      return this.issueToken(user);
    }

    // New User - First time login with Google -> Create account (no passwordHash because login with Google)
    user = await this.prisma.user.create({
      data: {
        email: profile.email,
        googleId: profile.googleId,
        name: profile.name,
      },
    });
    return this.issueToken(user);
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

    return this.issueToken(user);
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
      createdAt: user.createdAt,
    };
  }

  async deleteAccount(userId: string) {
    await this.prisma.$transaction(async (tx) => {
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

  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    // Always return normal - not showing if email exists or not
    if (!user) return;

    // Random token; only save HASH
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: expiresAt,
      },
    });

    const clientUrl = process.env.CLIENT_URL ?? 'http://localhost:5173';
    const resetUrl = `${clientUrl}/reset-password?token=${rawToken}`;
    await this.mailService.sendPasswordReset(user.email, resetUrl);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: { gt: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset link');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
      },
    });
  }
}
