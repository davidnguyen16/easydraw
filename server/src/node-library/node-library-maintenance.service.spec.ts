/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return -- Jest mock introspection. */
import type { PrismaService } from '../prisma/prisma.service';
import { NodeLibraryMaintenanceService } from './node-library-maintenance.service';
import type { S3AssetsService } from './s3-assets.service';

const now = new Date('2026-09-18T00:00:00Z');
const asset = {
  id: 'asset-id',
  ownerId: 'owner-id',
  status: 'READY',
  uploadKey: 'pending/owner-id/asset-id/random-id',
  s3Key: 'assets/owner-id/asset-id/version-id/image.png',
  thumbnailKey: 'assets/owner-id/asset-id/version-id/thumbnail.png',
  unpublishedKeys: [],
  createdAt: new Date('2026-08-01T00:00:00Z'),
  updatedAt: new Date('2026-08-01T00:00:00Z'),
};

function setup() {
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    asset: {
      findMany: jest.fn().mockResolvedValue([asset]),
      findFirst: jest.fn().mockResolvedValue(asset),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      delete: jest.fn().mockResolvedValue(asset),
    },
    customNodeDefinition: {
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const prisma = {
    ...tx,
    $transaction: jest.fn((callback: (t: typeof tx) => unknown) =>
      callback(tx),
    ),
  };
  const storage = {
    deletePendingOrUnpublished: jest.fn().mockResolvedValue(undefined),
  };
  const service = new NodeLibraryMaintenanceService(
    prisma as unknown as PrismaService,
    storage as unknown as S3AssetsService,
  );
  return { service, prisma, tx, storage };
}

describe('NodeLibraryMaintenanceService', () => {
  it('defaults to read-only dry run without claiming or deleting anything', async () => {
    const { service, prisma, storage } = setup();
    const report = await service.run({ now });
    expect(report.dryRun).toBe(true);
    expect(report.candidates[0]).toMatchObject({
      assetId: 'asset-id',
      safeKeys: true,
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(storage.deletePendingOrUnpublished).not.toHaveBeenCalled();
  });

  it('requires no diagram references and applies READY archive/asset grace', async () => {
    const { service, tx } = setup();
    await service.run({ now, limit: 10000 });
    const query = tx.asset.findMany.mock.calls[0][0];
    expect(query.take).toBe(100);
    expect(query.where.diagramAssets).toEqual({ none: {} });
    const ready = query.where.OR.find(
      (item: { status?: string }) => item.status === 'READY',
    );
    expect(ready.updatedAt.lt).toEqual(new Date('2026-09-11T00:00:00Z'));
    expect(ready.definitions.none.OR).toEqual([
      { deletedAt: null },
      { deletedAt: { gt: new Date('2026-09-11T00:00:00Z') } },
    ]);
  });

  it('rechecks owner and references while locking user before asset, then deletes exact keys', async () => {
    const { service, tx, storage } = setup();
    const report = await service.run({ now, execute: true });
    expect(report.deleted).toEqual(['asset-id']);
    expect(String(tx.$queryRaw.mock.calls[0][0])).toContain('FROM "User"');
    expect(String(tx.$queryRaw.mock.calls[1][0])).toContain('FROM "Asset"');
    expect(tx.asset.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'asset-id',
          ownerId: 'owner-id',
          diagramAssets: { none: {} },
        }),
      }),
    );
    expect(tx.asset.updateMany).toHaveBeenCalledWith({
      where: {
        id: asset.id,
        ownerId: asset.ownerId,
        status: 'READY',
        updatedAt: asset.updatedAt,
      },
      data: { status: 'DELETING' },
    });
    expect(
      storage.deletePendingOrUnpublished.mock.calls.map((call) => call[0]),
    ).toEqual([asset.uploadKey, asset.s3Key, asset.thumbnailKey]);
    expect(tx.customNodeDefinition.deleteMany).toHaveBeenCalledWith({
      where: { assetId: 'asset-id' },
    });
    expect(tx.asset.delete).toHaveBeenCalledWith({ where: { id: 'asset-id' } });
  });

  it('skips a candidate whose owner/references changed after scanning', async () => {
    const { service, tx, storage } = setup();
    tx.asset.findFirst.mockResolvedValue(null);
    const report = await service.run({ now, execute: true });
    expect(report.skipped).toEqual(['asset-id']);
    expect(storage.deletePendingOrUnpublished).not.toHaveBeenCalled();
  });

  it.each([
    'assets/other-owner/asset-id/version-id/image.png',
    'assets/owner-id/other-asset/version-id/image.png',
    'assets/owner-id/asset-id/../image.png',
    'unrelated/owner-id/asset-id/version-id/image.png',
    'assets/owner-id/asset-id/version-id/arbitrary.txt',
  ])(
    'refuses an untrusted or unrelated recorded object key: %s',
    async (s3Key) => {
      const { service, tx, storage } = setup();
      tx.asset.findMany.mockResolvedValue([{ ...asset, s3Key }]);
      const report = await service.run({ now, execute: true });
      expect(report.skipped).toEqual(['asset-id']);
      expect(storage.deletePendingOrUnpublished).not.toHaveBeenCalled();
      expect(tx.asset.updateMany).not.toHaveBeenCalled();
    },
  );

  it('retains DELETING tombstones after partial S3 failure for explicit retry', async () => {
    const { service, tx, storage } = setup();
    storage.deletePendingOrUnpublished
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('S3 unavailable'));
    const report = await service.run({ now, execute: true });
    expect(report.failed).toEqual(['asset-id']);
    expect(tx.asset.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'DELETING' } }),
    );
    expect(tx.asset.delete).not.toHaveBeenCalled();
  });

  it('supports ownerless tombstones without guessing an S3 prefix', async () => {
    const { service, tx, storage } = setup();
    const orphan = { ...asset, ownerId: null, status: 'DELETING' };
    tx.asset.findMany.mockResolvedValue([orphan]);
    tx.asset.findFirst.mockResolvedValue(orphan);
    const report = await service.run({ now, execute: true });
    expect(report.deleted).toEqual(['asset-id']);
    expect(String(tx.$queryRaw.mock.calls[0][0])).toContain('FROM "Asset"');
    expect(storage.deletePendingOrUnpublished).toHaveBeenCalledTimes(3);
  });

  it('does not delete keys if conditional claim lost the race', async () => {
    const { service, tx, storage } = setup();
    tx.asset.updateMany.mockResolvedValue({ count: 0 });
    const report = await service.run({ now, execute: true });
    expect(report.skipped).toEqual(['asset-id']);
    expect(storage.deletePendingOrUnpublished).not.toHaveBeenCalled();
  });

  it('deletes journaled keys as well as final keys when the entire unused asset is collected', async () => {
    const { service, tx, storage } = setup();
    const oldKey = 'assets/owner-id/asset-id/abandoned/image.png';
    const candidate = { ...asset, unpublishedKeys: [oldKey] };
    tx.asset.findMany.mockResolvedValue([candidate]);
    tx.asset.findFirst.mockResolvedValue(candidate);
    const report = await service.run({ now, execute: true });
    expect(report.deleted).toEqual(['asset-id']);
    expect(storage.deletePendingOrUnpublished).toHaveBeenCalledWith(oldKey);
    expect(storage.deletePendingOrUnpublished).toHaveBeenCalledTimes(4);
  });

  it('prunes abandoned attempt keys from an in-use READY asset without deleting its final images or row', async () => {
    const { service, tx, storage } = setup();
    const oldKey = 'assets/owner-id/asset-id/abandoned/image.png';
    const candidate = { ...asset, unpublishedKeys: [oldKey] };
    tx.asset.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([candidate]);
    tx.asset.findFirst.mockResolvedValue(candidate);
    const report = await service.run({ now, execute: true });
    expect(report.pruned).toEqual(['asset-id']);
    expect(report.deleted).toEqual([]);
    expect(storage.deletePendingOrUnpublished).toHaveBeenCalledTimes(1);
    expect(storage.deletePendingOrUnpublished).toHaveBeenCalledWith(oldKey);
    expect(tx.asset.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { unpublishedKeys: [] } }),
    );
    expect(tx.asset.delete).not.toHaveBeenCalled();
  });

  it('reports READY journal pruning in dry run without deleting keys', async () => {
    const { service, tx, storage } = setup();
    const oldKey = 'assets/owner-id/asset-id/abandoned/image.png';
    tx.asset.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ ...asset, unpublishedKeys: [oldKey] }]);
    const report = await service.run({ now });
    expect(report.candidates).toEqual([
      expect.objectContaining({
        assetId: 'asset-id',
        operation: 'prune-unpublished',
        keys: [oldKey],
      }),
    ]);
    expect(storage.deletePendingOrUnpublished).not.toHaveBeenCalled();
  });
});
