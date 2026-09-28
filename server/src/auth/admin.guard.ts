import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from './session-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Runs after SessionAuthGuard: only accounts with role 'admin' pass. The role is
 * read from the database on every call, so withdrawing it takes effect at once.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const userId = (request.user as AuthUser | undefined)?.sub;
    const user = userId
      ? await this.prisma.user.findUnique({
          where: { id: userId },
          select: { role: true },
        })
      : null;
    if (user?.role !== 'admin')
      throw new ForbiddenException('Only an administrator can do this.');
    return true;
  }
}
