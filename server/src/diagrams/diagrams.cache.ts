import type { ExecutionContext } from '@nestjs/common';
import type { AuthUser } from '../auth/session-auth.guard';

export function diagramListCacheKey(userId: string): string {
  return `diagrams:list:${userId}`;
}

export function diagramsListCacheKeyFromContext(
  context: ExecutionContext,
): string {
  const request = context.switchToHttp().getRequest<{ user: AuthUser }>();

  return diagramListCacheKey(request.user.sub);
}
