import type { Request } from 'express';
import {
  OAUTH_STATE_TTL_MS,
  OAuthStateStore,
  oauthCookieName,
} from './oauth-state.store';

/** A browser with its own cookie jar, as far as the store can see one. */
function browser() {
  const jar: Record<string, string> = {};
  const res = {
    cookie: jest.fn((name: string, value: string) => {
      jar[name] = value;
    }),
    clearCookie: jest.fn(),
  };
  return {
    jar,
    res,
    request: (path: string) =>
      ({ path, res, cookies: { ...jar } }) as unknown as Request,
  };
}

describe('OAuthStateStore (in-process)', () => {
  const redisUrl = process.env.REDIS_URL;
  let store: OAuthStateStore;

  beforeAll(() => {
    delete process.env.REDIS_URL;
  });
  afterAll(() => {
    if (redisUrl !== undefined) process.env.REDIS_URL = redisUrl;
  });
  beforeEach(() => {
    store = new OAuthStateStore();
  });
  afterEach(() => {
    store.onModuleDestroy();
    jest.useRealTimers();
  });

  it('accepts the issuing browser once, then refuses the replay', async () => {
    const alice = browser();
    const state = await store.issue(alice.request('/auth/google'));

    expect(alice.jar[oauthCookieName()]).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(
      await store.consume(alice.request('/auth/google/callback'), state),
    ).toBe(true);
    expect(
      await store.consume(alice.request('/auth/google/callback'), state),
    ).toBe(false);
    expect(alice.res.clearCookie).toHaveBeenCalledWith(
      oauthCookieName(),
      expect.objectContaining({ httpOnly: true }),
    );
  });

  it('refuses the state in any other browser, without spending it for the real one', async () => {
    const alice = browser();
    const mallory = browser();
    const state = await store.issue(alice.request('/auth/google'));
    await store.issue(mallory.request('/auth/google'));

    expect(
      await store.consume(mallory.request('/auth/google/callback'), state),
    ).toBe(false);
    expect(
      await store.consume(browser().request('/auth/google/callback'), state),
    ).toBe(false);
    expect(
      await store.consume(alice.request('/auth/google/callback'), state),
    ).toBe(true);
  });

  it('refuses an expired attempt', async () => {
    jest.useFakeTimers();
    const alice = browser();
    const state = await store.issue(alice.request('/auth/google'));

    jest.advanceTimersByTime(OAUTH_STATE_TTL_MS + 1);
    expect(
      await store.consume(alice.request('/auth/google/callback'), state),
    ).toBe(false);
  });

  it.each([undefined, '', 'short', 'x'.repeat(43) + '!'])(
    'refuses a malformed state %p',
    async (state) => {
      const alice = browser();
      await store.issue(alice.request('/auth/google'));
      expect(
        await store.consume(alice.request('/auth/google/callback'), state),
      ).toBe(false);
    },
  );

  it('never issues a state while handling the callback itself', async () => {
    await expect(
      store.issue(browser().request('/auth/google/callback')),
    ).rejects.toThrow();
  });
});
