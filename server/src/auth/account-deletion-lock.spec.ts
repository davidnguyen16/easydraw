import type { Cache } from 'cache-manager';
import type { PrismaService } from '../prisma/prisma.service';
import type { MailService } from '../mail/mail.service';
import { AuthService } from './auth.service';

describe('account deletion lock ordering', () => {
  function setup(exists = true) {
    const order: string[] = [];
    const tx = {
      $queryRaw: jest.fn(() => {
        order.push('lock-owner');
        return Promise.resolve([{ id: 'owner' }]);
      }),
      user: {
        findUnique: jest.fn(() => {
          order.push('read-owner');
          return Promise.resolve(exists ? { id: 'owner' } : null);
        }),
        delete: jest.fn(() => {
          order.push('delete-owner');
          return Promise.resolve({ id: 'owner' });
        }),
      },
      diagram: {
        deleteMany: jest.fn(() => {
          order.push('delete-diagrams');
          return Promise.resolve({ count: 1 });
        }),
      },
    };
    const prisma = {
      $transaction: async (action: (db: typeof tx) => Promise<void>) =>
        action(tx),
    };
    const cache = {
      del: jest.fn(() => {
        order.push('invalidate-cache');
        return Promise.resolve();
      }),
    };
    const service = new AuthService(
      prisma as unknown as PrismaService,
      {} as MailService,
      cache as unknown as Cache,
    );
    return { tx, order, service };
  }
  it('locks User before touching Diagram, matching autosave and asset cleanup', async () => {
    const { order, service } = setup();
    await service.deleteAccount('owner');
    expect(order).toEqual([
      'lock-owner',
      'read-owner',
      'delete-diagrams',
      'delete-owner',
      'invalidate-cache',
    ]);
  });
  it('does not delete child records for a nonexistent account', async () => {
    const { tx, service } = setup(false);
    await expect(service.deleteAccount('missing')).rejects.toThrow(
      'User not found',
    );
    expect(tx.diagram.deleteMany).not.toHaveBeenCalled();
  });
});
