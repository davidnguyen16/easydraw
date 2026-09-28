import type { Asset, Prisma } from '../generated/prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import type { S3AssetsService } from './s3-assets.service';

export const MAX_UNPUBLISHED_ASSET_KEYS = 32;

type AssetIdentity = Pick<Asset, 'id' | 'ownerId'>;
type CleanupAsset = Pick<
  Asset,
  'id' | 'ownerId' | 'status' | 's3Key' | 'thumbnailKey' | 'unpublishedKeys'
>;

/** Validate a single recorded object, never an S3 prefix or user supplied path. */
export function isSafeAssetKey(
  asset: AssetIdentity,
  key: string,
  pending = false,
) {
  const parts = key.split('/');
  if (
    parts[2] !== asset.id ||
    !parts[1] ||
    parts.some((part) => part === '.' || part === '..' || !part) ||
    (asset.ownerId !== null && parts[1] !== asset.ownerId) ||
    !/^[a-zA-Z0-9-]+$/.test(parts[1]) ||
    !/^[a-zA-Z0-9-]+$/.test(parts[3] ?? '')
  )
    return false;
  return pending
    ? parts[0] === 'pending' && parts.length === 4
    : parts[0] === 'assets' &&
        parts.length === 5 &&
        ['image.png', 'thumbnail.png'].includes(parts[4]);
}

export function unpublishedCleanupKeys(asset: CleanupAsset) {
  return [...new Set(asset.unpublishedKeys ?? [])].filter(
    (key) =>
      key !== asset.s3Key &&
      key !== asset.thumbnailKey &&
      isSafeAssetKey(asset, key),
  );
}

const cleanupStates = ['PENDING', 'REJECTED', 'READY'] as const;
const cleanupSelect = {
  id: true,
  ownerId: true,
  status: true,
  s3Key: true,
  thumbnailKey: true,
  unpublishedKeys: true,
} as const;

async function lockAsset(tx: Prisma.TransactionClient, asset: AssetIdentity) {
  if (asset.ownerId)
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${asset.ownerId} FOR UPDATE`;
  await tx.$queryRaw`SELECT "id" FROM "Asset" WHERE "id" = ${asset.id} FOR UPDATE`;
}

/**
 * Only clean a stopped attempt's journal, never a live PROCESSING attempt.
 * Network I/O is outside database transactions. Journal entries are removed
 * only after S3 confirms deletion; DB/S3 failures remain explicitly retryable.
 */
export async function cleanupUnpublishedAssetKeys(
  prisma: PrismaService,
  storage: S3AssetsService,
  asset: AssetIdentity,
  requestedKeys: readonly string[],
) {
  const deletedKeys: string[] = [];
  const failedKeys: string[] = [];
  for (const key of [...new Set(requestedKeys)]) {
    try {
      const current = await prisma.asset.findFirst({
        where: {
          id: asset.id,
          ownerId: asset.ownerId,
          status: { in: [...cleanupStates] },
        },
        select: cleanupSelect,
      });
      // Re-read final keys after any ambiguous publication response before
      // issuing DELETE. Old attempt keys are never reused by another attempt.
      if (!current || !unpublishedCleanupKeys(current).includes(key)) continue;
      await storage.deletePendingOrUnpublished(key);
      const pruned = await prisma.$transaction(async (tx) => {
        await lockAsset(tx, asset);
        const latest = await tx.asset.findFirst({
          where: {
            id: asset.id,
            ownerId: asset.ownerId,
            status: { in: [...cleanupStates] },
          },
          select: cleanupSelect,
        });
        if (!latest || !unpublishedCleanupKeys(latest).includes(key))
          return false;
        await tx.asset.updateMany({
          where: {
            id: latest.id,
            ownerId: latest.ownerId,
            status: latest.status,
          },
          data: {
            unpublishedKeys: latest.unpublishedKeys.filter(
              (entry) => entry !== key,
            ),
          },
        });
        return true;
      });
      if (pruned) deletedKeys.push(key);
    } catch {
      failedKeys.push(key);
    }
  }
  return { deletedKeys, failedKeys };
}
