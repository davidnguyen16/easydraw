import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { SessionService, type SessionUser } from './session.service';

/** The cookie the browser carries. Named for what it is, not for its contents. */
export const SESSION_COOKIE = 'session';

/** What the guard leaves on the request; read it with `@CurrentUser()`. */
export type AuthUser = SessionUser;

/**
 * Admits a request that carries a live session.
 *
 * Unlike a signed token, this asks the database on every request, so a session
 * that was revoked — by signing out, or by a password reset — stops working on
 * the next call rather than whenever it would have expired.
 */
@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly sessions: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = sessionTokenFrom(request);

    if (!token) {
      throw new UnauthorizedException('Not signed in');
    }

    const user = await this.sessions.validate(token);

    if (!user) {
      throw new UnauthorizedException('Session expired or signed out');
    }

    request.user = user;
    return true;
  }
}

/**
 * The cookie is how browsers carry the session; the bearer header is for API
 * clients and tests, which have no cookie jar.
 */
export function sessionTokenFrom(request: Request): string | undefined {
  const cookie = request.cookies?.[SESSION_COOKIE] as string | undefined;
  if (cookie) return cookie;

  const header = request.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice(7) : undefined;
}
