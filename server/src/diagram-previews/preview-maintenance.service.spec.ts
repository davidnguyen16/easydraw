import { PreviewMaintenanceService } from './preview-maintenance.service';
import { DiagramPreviewsService } from './diagram-previews.service';
import { PrismaService } from '../prisma/prisma.service';
import { S3AssetsService } from '../node-library/s3-assets.service';
import { Logger } from '@nestjs/common';

function setup(active = 0) {
  const ownerId = '11111111-1111-4111-a111-111111111111';
  const id = '22222222-2222-4222-a222-222222222222';
  const snapshot = {
    id,
    ownerId: null as string | null,
    status: 'PENDING',
    cleanupAfter: new Date(0),
    leaseUntil: new Date(0),
    sourceObjectKey: `whiteboard-previews/${ownerId}/${id}/source.png`,
    modelInputObjectKey: `whiteboard-previews/${ownerId}/${id}/model.png`,
    unpublishedKeys: [] as string[],
  };
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([{ id }]),
    user: { findUnique: jest.fn().mockResolvedValue({ id: ownerId }) },
    diagramConversion: { count: jest.fn().mockResolvedValue(0) },
    diagramPreview: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(active),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    previewSourceSnapshot: {
      findMany: jest.fn().mockResolvedValue([snapshot]),
      findUnique: jest.fn().mockResolvedValue(snapshot),
      update: jest.fn().mockResolvedValue({
        ...snapshot,
        status: 'DELETING',
        leaseUntil: new Date(Date.now() + 120000),
      }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const prisma = {
    ...tx,
    $transaction: <T>(operation: (client: typeof tx) => Promise<T>) =>
      operation(tx),
  };
  const storage = {
    deletePendingOrUnpublished: jest.fn().mockResolvedValue(undefined),
  };
  const previews = { reconcile: jest.fn().mockResolvedValue(undefined) };
  const service = new PreviewMaintenanceService(
    prisma as unknown as PrismaService,
    previews as unknown as DiagramPreviewsService,
    storage as unknown as S3AssetsService,
  );
  return { service, tx, storage, snapshot, ownerId, previews };
}

describe('preview S3 cleanup journal', () => {
  afterEach(() => jest.restoreAllMocks());
  it('never deletes a snapshot referenced by an active or ready preview', async () => {
    const s = setup(1);
    await s.service.sweep();
    expect(s.storage.deletePendingOrUnpublished).not.toHaveBeenCalled();
    expect(s.tx.previewSourceSnapshot.deleteMany).not.toHaveBeenCalled();
  });
  it('retains all keys on a partial S3 deletion failure', async () => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const s = setup();
    s.storage.deletePendingOrUnpublished
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('private-storage-details'));
    await s.service.sweep();
    expect(s.storage.deletePendingOrUnpublished).toHaveBeenCalledTimes(2);
    expect(s.tx.previewSourceSnapshot.deleteMany).not.toHaveBeenCalled();
  });
  it('cleans ownerless exact-key journals only after both deletes succeed', async () => {
    const s = setup();
    await s.service.sweep();
    expect(s.storage.deletePendingOrUnpublished.mock.calls).toEqual([
      [s.snapshot.sourceObjectKey],
      [s.snapshot.modelInputObjectKey],
    ]);
    expect(s.tx.diagramPreview.updateMany).toHaveBeenCalled();
    expect(s.tx.previewSourceSnapshot.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: s.snapshot.id,
          status: 'DELETING',
          previews: { none: {} },
          conversions: { none: {} },
        }) as unknown,
      }),
    );
  });
  it('never deletes an unrelated S3 prefix or an unexpired lease', async () => {
    const s = setup();
    s.snapshot.leaseUntil = new Date(Date.now() + 10000);
    await s.service.sweep();
    expect(s.storage.deletePendingOrUnpublished).not.toHaveBeenCalled();
    s.snapshot.leaseUntil = new Date(0);
    s.tx.previewSourceSnapshot.update.mockResolvedValueOnce({
      ...s.snapshot,
      sourceObjectKey: 'assets/unrelated',
      status: 'DELETING',
      leaseUntil: new Date(),
    });
    await s.service.sweep();
    expect(s.storage.deletePendingOrUnpublished).not.toHaveBeenCalled();
  });
  it('excludes retained sources before the bounded candidate page, preventing cleanup starvation', async () => {
    const s = setup();
    await s.service.sweep();
    expect(s.tx.previewSourceSnapshot.findMany).toHaveBeenCalledWith({
      where: {
        cleanupAfter: { lte: expect.any(Date) as unknown },
        leaseUntil: { lte: expect.any(Date) as unknown },
        conversions: { none: {} },
      },
      orderBy: { cleanupAfter: 'asc' },
      take: 10,
    });
  });
  it('rechecks a conversion that committed after candidate selection before claiming or deleting S3', async () => {
    const s = setup();
    s.tx.diagramConversion.count.mockResolvedValue(1);
    await s.service.sweep();
    expect(s.tx.diagramConversion.count).toHaveBeenCalledWith({
      where: { sourceSnapshotId: s.snapshot.id },
    });
    expect(s.tx.previewSourceSnapshot.update).not.toHaveBeenCalled();
    expect(s.tx.diagramPreview.updateMany).not.toHaveBeenCalled();
    expect(s.storage.deletePendingOrUnpublished).not.toHaveBeenCalled();
    expect(s.tx.previewSourceSnapshot.deleteMany).not.toHaveBeenCalled();
  });
  it('uses the same owner-first lock order as conversion approval and account deletion', async () => {
    const s = setup();
    s.snapshot.ownerId = s.ownerId;
    await s.service.sweep();
    const locks = s.tx.$queryRaw.mock.calls as unknown as [
      TemplateStringsArray,
      ...unknown[],
    ][];
    expect(locks).toHaveLength(2);
    expect(locks[0][0].join('?')).toContain('FROM "User"');
    expect(locks[1][0].join('?')).toContain('FROM "PreviewSourceSnapshot"');
    expect(s.previews.reconcile).toHaveBeenCalledWith(
      s.tx,
      s.ownerId,
      expect.any(Date),
    );
    expect(s.tx.$queryRaw.mock.invocationCallOrder[1]).toBeLessThan(
      s.tx.diagramConversion.count.mock.invocationCallOrder[0],
    );
  });
  it('defers an account deleted after selection until its ownerless journal can be safely retried', async () => {
    const s = setup();
    s.snapshot.ownerId = s.ownerId;
    s.tx.user.findUnique.mockResolvedValue(null);
    await s.service.sweep();
    expect(s.tx.$queryRaw).not.toHaveBeenCalled();
    expect(s.storage.deletePendingOrUnpublished).not.toHaveBeenCalled();
    expect(s.tx.previewSourceSnapshot.deleteMany).not.toHaveBeenCalled();
  });
});
