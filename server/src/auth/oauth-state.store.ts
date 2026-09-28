import {
  Injectable,
  Logger,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createClient } from '@keyv/redis';
import { createHash, randomBytes } from 'node:crypto';
import type { CookieOptions, Request } from 'express';
import type {
  Metadata,
  StateStoreStoreCallback,
  StateStoreVerifyCallback,
} from 'passport-oauth2';

export const OAUTH_STATE_TTL_MS = 5 * 60 * 1000;
const MAX_LOCAL_ATTEMPTS = 10_000;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function oauthCookieName(): string {
  return process.env.NODE_ENV === 'production'
    ? '__Secure-easydraw-oauth'
    : 'easydraw-oauth';
}

function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/auth/google/callback',
  };
}

function attemptKey(state: string, browserSecret: string): string {
  const digest = createHash('sha256')
    .update(`${state}:${browserSecret}`)
    .digest('hex');
  return `easydraw:oauth:google:${digest}`;
}

/**
 * Passport state store, independent of login sessions. Neither the public URL
 * state nor a copied callback can authenticate without this browser's nonce.
 * Consuming server state is atomic even if the old cookie is later replayed.
 *
 * Local storage is intentionally fail-closed after restart or on another
 * replica. Configure the existing REDIS_URL for multi-replica availability;
 * Redis must support GETDEL (6.2+). No raw nonce/code is persisted or logged.
 */
@Injectable()
export class OAuthStateStore implements OnModuleDestroy {
  private readonly logger = new Logger(OAuthStateStore.name);
  private readonly pending = new Map<string, number>();
  private readonly redis = process.env.REDIS_URL
    ? createClient({
        url: process.env.REDIS_URL,
        socket: { connectTimeout: 5_000, reconnectStrategy: false },
        disableOfflineQueue: true,
      })
    : undefined;
  private connection?: Promise<unknown>;

  constructor() {
    this.redis?.on('error', () => {
      this.logger.warn('OAuth state storage is unavailable');
    });
  }

  private async redisClient() {
    if (!this.redis) return undefined;
    if (!this.redis.isReady) {
      this.connection ??= this.redis.connect().finally(() => {
        this.connection = undefined;
      });
      await this.connection;
    }
    return this.redis;
  }

  async issue(req: Request): Promise<string> {
    if (!req.res || req.path.endsWith('/callback')) {
      throw new Error('Invalid OAuth initiation');
    }
    const state = randomBytes(32).toString('base64url');
    const browserSecret = randomBytes(32).toString('base64url');
    const key = attemptKey(state, browserSecret);
    const redis = await this.redisClient();
    if (redis) {
      const stored = await redis.set(key, 'pending', {
        PX: OAUTH_STATE_TTL_MS,
        NX: true,
      });
      if (stored !== 'OK') throw new Error('Could not store OAuth state');
    } else {
      const now = Date.now();
      for (const [id, expiry] of this.pending) {
        if (expiry <= now) this.pending.delete(id);
      }
      if (this.pending.size >= MAX_LOCAL_ATTEMPTS) {
        throw new Error('Too many pending OAuth attempts');
      }
      this.pending.set(key, now + OAUTH_STATE_TTL_MS);
    }
    req.res.cookie(oauthCookieName(), browserSecret, {
      ...cookieOptions(),
      maxAge: OAUTH_STATE_TTL_MS,
    });
    return state;
  }

  async consume(req: Request, state: unknown): Promise<boolean> {
    const browserSecret: unknown = req.cookies?.[oauthCookieName()];
    req.res?.clearCookie(oauthCookieName(), cookieOptions());
    if (
      typeof state !== 'string' ||
      !TOKEN_PATTERN.test(state) ||
      typeof browserSecret !== 'string' ||
      !TOKEN_PATTERN.test(browserSecret)
    ) {
      return false;
    }
    const key = attemptKey(state, browserSecret);
    const redis = await this.redisClient();
    if (redis) return (await redis.getDel(key)) === 'pending';

    // No await between the read and delete: one synchronous atomic operation
    // within this process, including concurrent callbacks with copied cookies.
    const expiry = this.pending.get(key);
    this.pending.delete(key);
    return expiry !== undefined && expiry > Date.now();
  }

  store(req: Request, callback: StateStoreStoreCallback): void;
  store(req: Request, meta: Metadata, callback: StateStoreStoreCallback): void;
  store(
    req: Request,
    metaOrCallback: Metadata | StateStoreStoreCallback,
    callback?: StateStoreStoreCallback,
  ): void {
    const done =
      typeof metaOrCallback === 'function' ? metaOrCallback : callback!;
    void this.issue(req).then(
      (state) => done(null, state),
      () =>
        done(
          new ServiceUnavailableException(
            'Google sign-in is temporarily unavailable.',
          ),
          undefined,
        ),
    );
  }

  verify(req: Request, state: string, callback: StateStoreVerifyCallback): void;
  verify(
    req: Request,
    state: string,
    meta: Metadata,
    callback: StateStoreVerifyCallback,
  ): void;
  verify(
    req: Request,
    state: string,
    metaOrCallback: Metadata | StateStoreVerifyCallback,
    callback?: StateStoreVerifyCallback,
  ): void {
    const done =
      typeof metaOrCallback === 'function' ? metaOrCallback : callback!;
    void this.consume(req, state).then(
      (valid) =>
        done(null, valid, {
          message: 'Invalid or expired Google sign-in. Please try again.',
        }),
      () =>
        done(
          new ServiceUnavailableException(
            'Google sign-in is temporarily unavailable.',
          ),
          false,
          undefined,
        ),
    );
  }

  onModuleDestroy() {
    this.pending.clear();
    if (this.redis?.isOpen) this.redis.destroy();
  }
}
