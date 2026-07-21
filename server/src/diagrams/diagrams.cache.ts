import type { ExecutionContext } from '@nestjs/common';
import type { JwtPayload } from '../auth/jwt-auth.guard';

export function diagramListCacheKey(userId: string): string {
  return `diagrams:list:${userId}`;
}

export function diagramsListCacheKeyFromContext(
  context: ExecutionContext,
): string {
  const request = context.switchToHttp().getRequest<{ user: JwtPayload }>();

  return diagramListCacheKey(request.user.sub);
}
