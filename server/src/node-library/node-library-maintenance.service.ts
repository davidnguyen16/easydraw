import { Injectable } from '@nestjs/common';
import type { Asset, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { S3AssetsService } from './s3-assets.service';
import {
  cleanupUnpublishedAssetKeys,
  isSafeAssetKey,
  unpublishedCleanupKeys,
} from './unpublished-assets';

const DAY = 24 * 60 * 60 * 1000;
const GRACE_DAYS = 7;

export type AssetCleanupResult = {
  dryRun: boolean;
  candidates: {
    assetId: string;
    status: string;
    keys: string[];
    safeKeys: boolean;
    operation: 'delete-asset' | 'prune-unpublished';
  }[];
  deleted: string[];
  skipped: string[];
  failed: string[];
  pruned: string[];
};

/** Explicit operator maintenance only: no timer, cron, or application startup hook. */
@Injectable()
export class NodeLibraryMaintenanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: S3AssetsService,
  ) {}

  private eligibility(now: Date): Prisma.AssetWhereInput {
    const grace = new Date(now.getTime() - GRACE_DAYS * DAY);
    const expired = new Date(now.getTime() - DAY);
    return {
      diagramAssets: { none: {} },
      OR: [
        { status: 'DELETING' },
        // READY files wait seven days after both the last asset change and
        // the newest definition archive. Pending definitions were never public.
        {
          status: 'READY',
          updatedAt: { lt: grace },
          definitions: {
            none: { OR: [{ deletedAt: null }, { deletedAt: { gt: grace } }] },
          },
        },
        {
          status: { in: ['PENDING', 'REJECTED', 'PROCESSING'] },
          updatedAt: { lt: expired },
          createdAt: { lt: expired },
        },
      ],
    };
  }

  private keys(
    asset: Pick<
      Asset,
      | 'id'
      | 'ownerId'
      | 'uploadKey'
      | 's3Key'
      | 'thumbnailKey'
      | 'unpublishedKeys'
    >,
  ) {
    const values = [
      ...new Set(
        [
          asset.uploadKey,
          asset.s3Key,
          asset.thumbnailKey,
          ...(asset.unpublishedKeys ?? []),
        ].filter((key): key is string => !!key),
      ),
    ];
    const safe = values.every((key) =>
      isSafeAssetKey(asset, key, key === asset.uploadKey),
    );
    return { values, safe };
  }

  private async claim(asset: Asset, now: Date) {
    return this.prisma.$transaction(async (tx) => {
      if (asset.ownerId)
        await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${asset.ownerId} FOR UPDATE`;
      await tx.$queryRaw`SELECT "id" FROM "Asset" WHERE "id" = ${asset.id} FOR UPDATE`;
      const current = await tx.asset.findFirst({
        where: {
          id: asset.id,
          ownerId: asset.ownerId,
          ...this.eligibility(now),
        },
      });
      if (!current || !this.keys(current).safe) return null;
      const result = await tx.asset.updateMany({
        where: {
          id: current.id,
          ownerId: current.ownerId,
          status: current.status,
          updatedAt: current.updatedAt,
        },
        data: { status: 'DELETING' },
      });
      return result.count ? current : null;
    });
  }

  async run(
    options: { execute?: boolean; limit?: number; now?: Date } = {},
  ): Promise<AssetCleanupResult> {
    const now = options.now ?? new Date();
    const limit = Math.max(1, Math.min(100, Math.floor(options.limit ?? 25)));
    const candidates = await this.prisma.asset.findMany({
      where: this.eligibility(now),
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take: limit,
    });
    const result: AssetCleanupResult = {
      dryRun: !options.execute,
      candidates: [],
      deleted: [],
      skipped: [],
      failed: [],
      pruned: [],
    };
    for (const asset of candidates) {
      const keys = this.keys(asset);
      result.candidates.push({
        assetId: asset.id,
        status: asset.status,
        keys: keys.values,
        safeKeys: keys.safe,
        operation: 'delete-asset',
      });
      if (!options.execute) continue;
      if (!keys.safe) {
        result.skipped.push(asset.id);
        continue;
      }
      try {
        const claimed = await this.claim(asset, now);
        if (!claimed) {
          result.skipped.push(asset.id);
          continue;
        }
        // Exact recorded keys only, never a prefix/list/delete operation.
        for (const key of this.keys(claimed).values)
          await this.storage.deletePendingOrUnpublished(key);
        const removed = await this.prisma.$transaction(async (tx) => {
          if (claimed.ownerId)
            await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${claimed.ownerId} FOR UPDATE`;
          await tx.$queryRaw`SELECT "id" FROM "Asset" WHERE "id" = ${claimed.id} FOR UPDATE`;
          const row = await tx.asset.findFirst({
            where: {
              id: claimed.id,
              status: 'DELETING',
              ...this.eligibility(now),
            },
          });
          if (!row) return false;
          await tx.customNodeDefinition.deleteMany({
            where: { assetId: row.id },
          });
          await tx.asset.delete({ where: { id: row.id } });
          return true;
        });
        if (removed) result.deleted.push(asset.id);
        else result.skipped.push(asset.id);
      } catch {
        // Retain DELETING on partial S3 failure; explicit retries are idempotent.
        result.failed.push(asset.id);
      }
    }
    const remaining = limit - candidates.length;
    // A READY asset can still have failed attempts from before publication.
    // Its final pair is immutable, so prune only journaled nonfinal keys even
    // while diagrams/active library definitions continue using the asset.
    if (remaining > 0) {
      const ready = await this.prisma.asset.findMany({
        where: {
          status: 'READY',
          unpublishedKeys: { isEmpty: false },
          id: { notIn: candidates.map((asset) => asset.id) },
        },
        orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
        take: remaining,
      });
      for (const asset of ready) {
        if (
          !(asset.unpublishedKeys ?? []).length ||
          candidates.some((candidate) => candidate.id === asset.id)
        )
          continue;
        const keys = unpublishedCleanupKeys(asset);
        const safeKeys = keys.length === new Set(asset.unpublishedKeys).size;
        result.candidates.push({
          assetId: asset.id,
          status: asset.status,
          keys,
          safeKeys,
          operation: 'prune-unpublished',
        });
        if (!options.execute) continue;
        const cleanup = await cleanupUnpublishedAssetKeys(
          this.prisma,
          this.storage,
          asset,
          keys,
        );
        if (cleanup.deletedKeys.length) result.pruned.push(asset.id);
        if (cleanup.failedKeys.length) result.failed.push(asset.id);
        if (
          !safeKeys ||
          (!cleanup.deletedKeys.length && !cleanup.failedKeys.length)
        )
          result.skipped.push(asset.id);
      }
    }
    return result;
  }
}
