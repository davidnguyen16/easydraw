import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { S3AssetsService } from '../node-library/s3-assets.service';
import { lockDiagramOwner } from '../diagrams/diagram-assets';
import {
  DiagramPreviewsService,
  previewEnabled,
} from './diagram-previews.service';

/** Bounded, lease-safe maintenance. Never retries an OpenAI dispatch or removes
 * source pixels retained by a confirmed diagram's conversion receipt. */
@Injectable()
export class PreviewMaintenanceService
  implements OnModuleInit, OnModuleDestroy
{
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private readonly logger = new Logger(PreviewMaintenanceService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly previews: DiagramPreviewsService,
    private readonly storage: S3AssetsService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      // Dispatch can be disabled as a kill switch without stopping retention.
      const enabled = process.env.WHITEBOARD_AI_PREVIEW_MAINTENANCE_ENABLED;
      if (
        !(enabled === 'true' || (enabled === undefined && previewEnabled())) ||
        this.running
      )
        return;
      this.running = true;
      void this.sweep()
        .catch(() =>
          this.logger.warn(
            'Preview maintenance failed; retained cleanup keys for retry.',
          ),
        )
        .finally(() => {
          this.running = false;
        });
    }, 60000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async sweep() {
    const now = new Date();
    const due = await this.prisma.diagramPreview.findMany({
      where: {
        OR: [
          { status: 'PROCESSING', leaseUntil: { lte: now } },
          {
            status: { in: ['READY', 'UNRECOGNIZED'] },
            OR: [{ expiresAt: { lte: now } }, { sourceWhiteboardId: null }],
          },
        ],
      },
      select: { ownerId: true },
      distinct: ['ownerId'],
      take: 20,
    });
    for (const { ownerId } of due) {
      await this.prisma.$transaction(async (tx) => {
        if (
          !(await tx.user.findUnique({
            where: { id: ownerId },
            select: { id: true },
          }))
        )
          return;
        await lockDiagramOwner(tx, ownerId);
        await this.previews.reconcile(tx, ownerId, now);
      });
    }
    const snapshots = await this.prisma.previewSourceSnapshot.findMany({
      where: {
        cleanupAfter: { lte: now },
        leaseUntil: { lte: now },
        // Filter before take: otherwise the oldest ten retained snapshots can
        // permanently starve cleanup of every later unconfirmed attempt.
        conversions: { none: {} },
      },
      orderBy: { cleanupAfter: 'asc' },
      take: 10,
    });
    for (const candidate of snapshots) {
      const claimed = await this.prisma.$transaction(async (tx) => {
        if (candidate.ownerId) {
          const owner = await tx.user.findUnique({
            where: { id: candidate.ownerId },
            select: { id: true },
          });
          if (!owner) return null; // next pass sees the SetNull ownerless journal
          await lockDiagramOwner(tx, owner.id);
          await this.previews.reconcile(tx, owner.id, now);
        }
        const locked = await tx.$queryRaw<
          { id: string }[]
        >`SELECT "id" FROM "PreviewSourceSnapshot" WHERE "id" = ${candidate.id} FOR UPDATE`;
        if (!locked.length) return null;
        const snapshot = await tx.previewSourceSnapshot.findUnique({
          where: { id: candidate.id },
        });
        if (
          !snapshot ||
          snapshot.leaseUntil > now ||
          snapshot.cleanupAfter > now
        )
          return null;
        // The owner lock serializes approval/deletion with this snapshot claim.
        // Recheck after locking: a conversion may have committed since selection.
        const retained = await tx.diagramConversion.count({
          where: { sourceSnapshotId: snapshot.id },
        });
        if (retained) return null;
        const active = await tx.diagramPreview.count({
          where: {
            sourceSnapshotId: snapshot.id,
            OR: [
              { status: { in: ['PROCESSING', 'READY', 'UNRECOGNIZED'] } },
              { leaseUntil: { gt: now } },
            ],
          },
        });
        if (active) return null;
        await tx.diagramPreview.updateMany({
          where: { sourceSnapshotId: snapshot.id },
          data: {
            sourceSnapshotId: null,
            convertedDocument: Prisma.DbNull,
            warnings: Prisma.DbNull,
            documentHash: null,
          },
        });
        return tx.previewSourceSnapshot.update({
          where: { id: snapshot.id },
          data: {
            status: 'DELETING',
            leaseUntil: new Date(Date.now() + 120000),
          },
        });
      });
      if (!claimed) continue;
      // This prefix is server-generated. Refuse damaged or unrelated keys.
      const keys = [
        ...new Set([
          claimed.sourceObjectKey,
          claimed.modelInputObjectKey,
          ...claimed.unpublishedKeys,
        ]),
      ];
      if (
        keys.some(
          (key) =>
            !/^whiteboard-previews\/[a-f0-9-]{36}\/[a-f0-9-]{36}\/(source|model)\.png$/.test(
              key,
            ),
        )
      )
        continue;
      try {
        for (const key of keys)
          await this.storage.deletePendingOrUnpublished(key);
        await this.prisma.previewSourceSnapshot.deleteMany({
          where: {
            id: claimed.id,
            status: 'DELETING',
            leaseUntil: claimed.leaseUntil,
            previews: { none: {} },
            conversions: { none: {} },
          },
        });
      } catch {
        // Idempotent exact-key DELETE is retried after the lease. Never erase
        // the journal on a permission/network failure or after only one key.
        this.logger.warn(
          'Preview snapshot cleanup deferred; exact keys retained.',
        );
      }
    }
  }
}
