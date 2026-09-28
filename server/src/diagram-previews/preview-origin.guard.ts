import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { SESSION_COOKIE } from '../auth/session-auth.guard';

/** CORS is not CSRF protection. Cookie writes require an exact trusted Origin.
 * Cookie wins over Bearer in SessionAuthGuard, so it must also win here. */
@Injectable()
export class PreviewOriginGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return true;
    const origin = request.headers.origin;
    let trusted: string;
    try {
      trusted = new URL(process.env.CLIENT_URL ?? 'http://localhost:5173')
        .origin;
    } catch {
      throw new ForbiddenException('Preview origin is not configured.');
    }
    if (origin === trusted) return true;
    // API clients may omit Origin only when authentication actually uses Bearer.
    if (
      !origin &&
      !request.cookies?.[SESSION_COOKIE] &&
      request.headers.authorization?.startsWith('Bearer ')
    ) {
      return true;
    }
    throw new ForbiddenException('Preview requests must come from the app.');
  }
}
