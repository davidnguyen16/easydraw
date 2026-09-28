import type { AuthUser } from '../auth/session-auth.guard';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
