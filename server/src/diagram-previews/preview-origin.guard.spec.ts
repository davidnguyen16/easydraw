import { PreviewOriginGuard } from './preview-origin.guard';
import type { ExecutionContext } from '@nestjs/common';

const context = (request: object) =>
  ({ switchToHttp: () => ({ getRequest: () => request }) }) as ExecutionContext;
describe('preview cookie write CSRF protection', () => {
  const guard = new PreviewOriginGuard();
  const before = process.env.CLIENT_URL;
  beforeEach(() => {
    process.env.CLIENT_URL = 'http://localhost:5173';
  });
  afterAll(() => {
    if (before === undefined) delete process.env.CLIENT_URL;
    else process.env.CLIENT_URL = before;
  });
  it('allows trusted Origin including a different backend port', () => {
    expect(
      guard.canActivate(
        context({
          method: 'POST',
          cookies: { session: 'secret' },
          headers: { origin: 'http://localhost:5173' },
        }),
      ),
    ).toBe(true);
  });
  it.each([
    undefined,
    'null',
    'https://evil.invalid',
    'http://localhost:5173.evil.invalid',
  ])('rejects cookie Origin %s', (origin) => {
    expect(() =>
      guard.canActivate(
        context({
          method: 'DELETE',
          cookies: { session: 'secret' },
          headers: { origin },
        }),
      ),
    ).toThrow();
  });
  it('does not let an added Bearer header bypass cookie authentication', () => {
    expect(() =>
      guard.canActivate(
        context({
          method: 'POST',
          cookies: { session: 'secret' },
          headers: { authorization: 'Bearer fake' },
        }),
      ),
    ).toThrow();
  });
  it('allows originless non-cookie Bearer clients but rejects their hostile Origin', () => {
    expect(
      guard.canActivate(
        context({ method: 'POST', headers: { authorization: 'Bearer real' } }),
      ),
    ).toBe(true);
    expect(() =>
      guard.canActivate(
        context({
          method: 'POST',
          headers: {
            authorization: 'Bearer real',
            origin: 'https://evil.invalid',
          },
        }),
      ),
    ).toThrow();
  });
});
