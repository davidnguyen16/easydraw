import { NotFoundException } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { Prisma } from '../generated/prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { DiagramsService } from './diagrams.service';
import { diagramListCacheKey } from './diagrams.cache';

function setup(owned = true) {
  const order: string[] = [];
  const tx = {
    $queryRaw: jest.fn().mockImplementation(() => {
      order.push('lock-owner');
      return Promise.resolve([{ id: 'owner' }]);
    }),
    $executeRaw: jest.fn().mockImplementation(() => {
      order.push('cancel-uncommitted-source-previews');
      return Promise.resolve(1);
    }),
    diagram: {
      findFirst: jest.fn().mockImplementation(() => {
        order.push('read-owned-diagram');
        return Promise.resolve(owned ? { id: 'diagram' } : null);
      }),
      delete: jest.fn().mockImplementation(() => {
        order.push('delete-diagram');
        return Promise.resolve({ id: 'diagram' });
      }),
    },
    diagramAsset: {
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockImplementation(() => {
        order.push('release-assets');
        return Promise.resolve({ count: 0 });
      }),
    },
    diagramConversion: {
      updateMany: jest.fn().mockImplementation(() => {
        order.push('tombstone-conversion');
        return Promise.resolve({ count: 1 });
      }),
    },
  };
  const prisma = {
    $transaction: async <T>(work: (client: typeof tx) => Promise<T>) => {
      const result = await work(tx);
      order.push('commit');
      return result;
    },
  };
  const cache = {
    del: jest.fn().mockImplementation(() => {
      order.push('invalidate-cache');
      return Promise.resolve();
    }),
  };
  const service = new DiagramsService(
    prisma as unknown as PrismaService,
    cache as unknown as Cache,
  );
  return { service, tx, order, cache };
}

describe('diagram deletion with durable conversion provenance', () => {
  it('releases retained payloads while preserving idempotency before deleting the owned output', async () => {
    const s = setup();
    await s.service.remove('owner', 'diagram');
    expect(s.tx.diagramConversion.updateMany).toHaveBeenCalledWith({
      where: { ownerId: 'owner', diagramId: 'diagram' },
      data: {
        diagramId: null,
        approvedDocument: Prisma.DbNull,
        sourceSnapshotId: null,
        diagramDeletedAt: expect.any(Date) as unknown,
      },
    });
    expect(s.order).toEqual([
      'lock-owner',
      'read-owned-diagram',
      'release-assets',
      'tombstone-conversion',
      'cancel-uncommitted-source-previews',
      'delete-diagram',
      'commit',
      'invalidate-cache',
    ]);
    expect(s.cache.del).toHaveBeenCalledWith(diagramListCacheKey('owner'));
  });

  it('cancels only uncommitted active source previews using owner-scoped bound parameters', async () => {
    const s = setup();
    await s.service.remove('owner', 'diagram');
    const [query, ...parameters] = s.tx.$executeRaw.mock.calls[0] as [
      TemplateStringsArray,
      ...unknown[],
    ];
    const sql = query.join('?');
    expect(parameters).toEqual(['owner', 'diagram', 'owner']);
    expect(sql).toContain('preview."ownerId" = ?');
    expect(sql).toContain('preview."sourceWhiteboardId" = ?');
    expect(sql).toContain('NOT EXISTS');
    expect(sql).toContain('conversion."previewId" = preview."id"');
    expect(sql).toContain('conversion."ownerId" = ?');
    expect(sql).toContain("'PROCESSING', 'READY', 'UNRECOGNIZED'");
    expect(sql).toContain('"convertedDocument" = NULL');
    // Retain a cancelled in-flight attempt's lease; deletion cannot start GC
    // while the outstanding upload/provider operation may still complete.
    expect(sql).not.toContain('"leaseUntil"');
  });

  it('continues lifecycle cleanup while AI generation is disabled', async () => {
    const previous = process.env.WHITEBOARD_AI_PREVIEW_ENABLED;
    process.env.WHITEBOARD_AI_PREVIEW_ENABLED = 'false';
    try {
      const s = setup();
      await s.service.remove('owner', 'diagram');
      expect(s.tx.diagramConversion.updateMany).toHaveBeenCalledTimes(1);
      expect(s.tx.$executeRaw).toHaveBeenCalledTimes(1);
    } finally {
      if (previous === undefined)
        delete process.env.WHITEBOARD_AI_PREVIEW_ENABLED;
      else process.env.WHITEBOARD_AI_PREVIEW_ENABLED = previous;
    }
  });

  it('does not mutate or reveal foreign or missing diagrams', async () => {
    const s = setup(false);
    await expect(s.service.remove('owner', 'foreign')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(s.tx.diagram.findFirst).toHaveBeenCalledWith({
      where: { id: 'foreign', ownerId: 'owner' },
      select: { id: true },
    });
    expect(s.tx.diagramConversion.updateMany).not.toHaveBeenCalled();
    expect(s.tx.$executeRaw).not.toHaveBeenCalled();
    expect(s.tx.diagram.delete).not.toHaveBeenCalled();
    expect(s.cache.del).not.toHaveBeenCalled();
  });

  it('does not continue deletion or invalidate cache when retaining the receipt fails', async () => {
    const s = setup();
    s.tx.diagramConversion.updateMany.mockRejectedValue(
      new Error('transaction failure'),
    );
    await expect(s.service.remove('owner', 'diagram')).rejects.toThrow(
      'transaction failure',
    );
    expect(s.tx.$executeRaw).not.toHaveBeenCalled();
    expect(s.tx.diagram.delete).not.toHaveBeenCalled();
    expect(s.cache.del).not.toHaveBeenCalled();
  });
});
