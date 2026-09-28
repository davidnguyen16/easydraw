import type { PrismaService } from '../prisma/prisma.service';
import type { S3AssetsService } from './s3-assets.service';
import {
  cleanupUnpublishedAssetKeys,
  isSafeAssetKey,
  unpublishedCleanupKeys,
} from './unpublished-assets';

const image = 'assets/owner/asset/current/image.png';
const thumbnail = 'assets/owner/asset/current/thumbnail.png';
const abandoned = 'assets/owner/asset/old-attempt/image.png';

function setup() {
  const row = {
    id: 'asset',
    ownerId: 'owner',
    status: 'READY' as 'READY' | 'PROCESSING',
    s3Key: image,
    thumbnailKey: thumbnail,
    unpublishedKeys: [abandoned],
  };
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    asset: {
      findFirst: jest.fn((query: { where: { status: { in: string[] } } }) =>
        Promise.resolve(
          query.where.status.in.includes(row.status) ? { ...row } : null,
        ),
      ),
      updateMany: jest.fn((query: { data: { unpublishedKeys: string[] } }) => {
        row.unpublishedKeys = [...query.data.unpublishedKeys];
        return Promise.resolve({ count: 1 });
      }),
    },
  };
  const prisma = {
    ...tx,
    $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) =>
      callback(tx),
    ),
  };
  const storage = {
    deletePendingOrUnpublished: jest.fn().mockResolvedValue(undefined),
  };
  const run = (keys: string[] = [abandoned]) =>
    cleanupUnpublishedAssetKeys(
      prisma as unknown as PrismaService,
      storage as unknown as S3AssetsService,
      row,
      keys,
    );
  return { row, tx, storage, run };
}

describe('durable unpublished asset cleanup', () => {
  it('retains journal entries on S3 failure and removes them only after a successful retry', async () => {
    const { row, tx, storage, run } = setup();
    storage.deletePendingOrUnpublished.mockRejectedValueOnce(
      new Error('S3 unavailable'),
    );
    expect(await run()).toEqual({ deletedKeys: [], failedKeys: [abandoned] });
    expect(row.unpublishedKeys).toEqual([abandoned]);
    expect(tx.asset.updateMany).not.toHaveBeenCalled();
    expect(await run()).toEqual({ deletedKeys: [abandoned], failedKeys: [] });
    expect(row.unpublishedKeys).toEqual([]);
    expect(storage.deletePendingOrUnpublished).toHaveBeenCalledTimes(2);
    expect(
      storage.deletePendingOrUnpublished.mock.invocationCallOrder[1],
    ).toBeLessThan(tx.asset.updateMany.mock.invocationCallOrder[0]);
  });

  it('never deletes final READY keys even if mistakenly present in the journal', async () => {
    const { row, storage, run } = setup();
    row.unpublishedKeys = [image, thumbnail, abandoned];
    expect(unpublishedCleanupKeys(row)).toEqual([abandoned]);
    expect(await run([image, thumbnail, abandoned])).toEqual({
      deletedKeys: [abandoned],
      failedKeys: [],
    });
    expect(storage.deletePendingOrUnpublished).toHaveBeenCalledTimes(1);
    expect(storage.deletePendingOrUnpublished).toHaveBeenCalledWith(abandoned);
    expect(row.unpublishedKeys).toEqual([image, thumbnail]);
  });

  it('does not clean keys while any attempt is PROCESSING', async () => {
    const { row, storage, run } = setup();
    row.status = 'PROCESSING';
    expect(await run()).toEqual({ deletedKeys: [], failedKeys: [] });
    expect(storage.deletePendingOrUnpublished).not.toHaveBeenCalled();
    expect(row.unpublishedKeys).toEqual([abandoned]);
  });

  it('rechecks publication before deleting a requested journal key', async () => {
    const { row, storage, run } = setup();
    row.s3Key = abandoned;
    expect(await run()).toEqual({ deletedKeys: [], failedKeys: [] });
    expect(storage.deletePendingOrUnpublished).not.toHaveBeenCalled();
  });

  it('retains the journal if S3 deletion succeeded but the database update failed', async () => {
    const { row, tx, storage, run } = setup();
    tx.asset.updateMany.mockRejectedValueOnce(new Error('DB unavailable'));
    expect(await run()).toEqual({ deletedKeys: [], failedKeys: [abandoned] });
    expect(storage.deletePendingOrUnpublished).toHaveBeenCalledWith(abandoned);
    expect(row.unpublishedKeys).toEqual([abandoned]);
    expect(await run()).toEqual({ deletedKeys: [abandoned], failedKeys: [] });
  });

  it('validates exact asset/owner paths before deletion, including ownerless assets', () => {
    const { row } = setup();
    expect(isSafeAssetKey(row, abandoned)).toBe(true);
    expect(isSafeAssetKey({ ...row, ownerId: null }, abandoned)).toBe(true);
    expect(isSafeAssetKey(row, 'assets/other/asset/old/image.png')).toBe(false);
    expect(isSafeAssetKey(row, 'assets/owner/other/old/image.png')).toBe(false);
    expect(isSafeAssetKey(row, 'assets/owner/asset/../image.png')).toBe(false);
    expect(isSafeAssetKey(row, 'assets/owner/asset/old/anything.txt')).toBe(
      false,
    );
  });
});
