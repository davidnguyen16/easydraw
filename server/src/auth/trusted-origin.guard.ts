import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { SessionService } from './session.service';

const REQUIRE_TRUSTED_ORIGIN = 'auth:require-trusted-origin';
/** Public credential endpoints must never bypass login CSRF via a fake Bearer. */
export const RequireTrustedOrigin = () =>
  SetMetadata(REQUIRE_TRUSTED_ORIGIN, true);

/** CORS only controls reading responses. Check before any mutation executes. */
@Injectable()
export class TrustedOriginGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;
    let trusted: string;
    try {
      trusted = new URL(process.env.CLIENT_URL ?? 'http://localhost:5173')
        .origin;
      if (trusted === 'null') throw new Error('Invalid origin');
    } catch {
      throw new ForbiddenException('The app origin is not configured.');
    }
    const origin = req.headers.origin;
    if (origin === trusted) return true;

    // Non-browser API clients can omit Origin, but must really authenticate
    // using Bearer, without any ambient cookies. Explicit untrusted origins
    // are always rejected. SessionAuthGuard independently protects the route.
    const requiresOrigin = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_TRUSTED_ORIGIN,
      [context.getHandler(), context.getClass()],
    );
    const bearer = req.headers.authorization?.match(/^Bearer (\S+)$/i)?.[1];
    if (!origin && !req.headers.cookie && !requiresOrigin && bearer) {
      if (await this.sessions.validate(bearer)) return true;
    }
    throw new ForbiddenException('Requests must come from the app.');
  }
}
