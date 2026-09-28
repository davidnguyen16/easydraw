import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { diagramListCacheKey } from './diagrams.cache';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import {
  collectDiagramAssetIds,
  lockDiagramOwner,
  syncDiagramAssets,
  validateDiagramAssets,
} from './diagram-assets';
import { LEGACY_DIAGRAM_TYPES } from './dto/create-diagram.dto';
import type { ThumbnailImage } from './thumbnail';

/** What the dashboard needs per card; `data` and the thumbnail bytes are fetched on demand. */
const LIST_SELECT = {
  id: true,
  title: true,
  type: true,
  category: true,
  status: true,
  thumbnailAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.DiagramSelect;

/** Everything but the thumbnail bytes, which have their own endpoint. */
const DOCUMENT_SELECT = {
  ...LIST_SELECT,
  data: true,
  ownerId: true,
} satisfies Prisma.DiagramSelect;

@Injectable()
export class DiagramsService {
  private readonly logger = new Logger(DiagramsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  private async invalidateListCache(userId: string): Promise<void> {
    try {
      await this.cacheManager.del(diagramListCacheKey(userId));
    } catch (error) {
      this.logger.warn(
        'Failed to invalidate diagrams list cache',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  findAll(userId: string) {
    return this.prisma.diagram.findMany({
      where: { ownerId: userId },
      select: LIST_SELECT,
      orderBy: { updatedAt: 'desc' },
    });
  }

  async create(
    userId: string,
    input: {
      title: string;
      type?: string;
      category?: string;
      data?: Prisma.InputJsonValue;
      thumbnail?: ThumbnailImage | null;
    },
  ) {
    // Older clients still send the fixed kinds; they become the label.
    const legacyCategory = LEGACY_DIAGRAM_TYPES[input.type ?? ''];
    const type = legacyCategory ? 'diagram' : (input.type ?? 'diagram');
    const category = input.category ?? legacyCategory ?? null;
    const ids = collectDiagramAssetIds(input.data);
    const diagram = await this.prisma.$transaction(async (tx) => {
      await lockDiagramOwner(tx, userId);
      await validateDiagramAssets(tx, userId, ids);
      const saved = await tx.diagram.create({
        data: {
          title: input.title,
          type,
          category,
          data: input.data ?? {},
          ownerId: userId,
          ...(input.thumbnail
            ? {
                thumbnail: input.thumbnail.bytes,
                thumbnailType: input.thumbnail.type,
                thumbnailAt: new Date(),
              }
            : {}),
        },
        select: DOCUMENT_SELECT,
      });
      await syncDiagramAssets(tx, saved.id, ids);
      return saved;
    });

    await this.invalidateListCache(userId);

    return diagram;
  }

  async findOne(userId: string, id: string) {
    const diagram = await this.prisma.diagram.findFirst({
      where: { id, ownerId: userId },
      select: DOCUMENT_SELECT,
    });
    if (!diagram) {
      throw new NotFoundException(`Diagram with id ${id} not found`);
    }
    return diagram;
  }

  /** The dashboard card's picture, or null when the editor has not sent one yet. */
  async getThumbnail(userId: string, id: string) {
    const diagram = await this.prisma.diagram.findFirst({
      where: { id, ownerId: userId },
      select: { thumbnail: true, thumbnailType: true, thumbnailAt: true },
    });
    if (!diagram)
      throw new NotFoundException(`Diagram with id ${id} not found`);
    if (!diagram.thumbnail || !diagram.thumbnailType || !diagram.thumbnailAt)
      return null;
    return {
      bytes: Buffer.from(diagram.thumbnail),
      type: diagram.thumbnailType,
      at: diagram.thumbnailAt,
    };
  }

  /** Sent by the editor after a save; the card URL carries `thumbnailAt` as its cache version. */
  async setThumbnail(userId: string, id: string, image: ThumbnailImage) {
    const owned = await this.prisma.diagram.findFirst({
      where: { id, ownerId: userId },
      select: { id: true },
    });
    if (!owned) throw new NotFoundException(`Diagram with id ${id} not found`);
    const saved = await this.prisma.diagram.update({
      where: { id },
      data: {
        thumbnail: image.bytes,
        thumbnailType: image.type,
        thumbnailAt: new Date(),
      },
      select: { thumbnailAt: true },
    });
    await this.invalidateListCache(userId);
    return saved;
  }

  async update(
    userId: string,
    id: string,
    patch: {
      title?: string;
      category?: string | null;
      status?: string;
      data?: Prisma.InputJsonValue;
    },
  ) {
    const ids =
      patch.data === undefined ? undefined : collectDiagramAssetIds(patch.data);
    const diagram = await this.prisma.$transaction(async (tx) => {
      await lockDiagramOwner(tx, userId);
      const owned = await tx.diagram.findFirst({
        where: { id, ownerId: userId },
        select: { id: true },
      });
      if (!owned)
        throw new NotFoundException(`Diagram with id ${id} not found`);
      if (ids) await validateDiagramAssets(tx, userId, ids);
      const saved = await tx.diagram.update({
        where: { id },
        data: patch,
        select: DOCUMENT_SELECT,
      });
      if (ids) await syncDiagramAssets(tx, id, ids);
      return saved;
    });

    await this.invalidateListCache(userId);

    return diagram;
  }

  async remove(userId: string, id: string) {
    await this.prisma.$transaction(async (tx) => {
      await lockDiagramOwner(tx, userId);
      const owned = await tx.diagram.findFirst({
        where: { id, ownerId: userId },
        select: { id: true },
      });
      if (!owned)
        throw new NotFoundException(`Diagram with id ${id} not found`);
      await syncDiagramAssets(tx, id, []);
      // Preserve the immutable request/hash tombstone. A delayed commit retry
      // must return gone, never silently recreate the user's deleted diagram.
      await tx.diagramConversion.updateMany({
        where: { ownerId: userId, diagramId: id },
        data: {
          diagramId: null,
          approvedDocument: Prisma.DbNull,
          sourceSnapshotId: null,
          diagramDeletedAt: new Date(),
        },
      });
      // Source deletion wins over late AI completion. Do not cancel receipts'
      // already-approved previews or erase their independently retained source.
      // NOT EXISTS avoids loading an unbounded historical receipt-ID list.
      // Lifecycle cleanup must also run while paid generation is disabled.
      await tx.$executeRaw`
        UPDATE "DiagramPreview" AS preview
        SET "status" = 'CANCELLED', "errorCode" = 'source_unavailable',
            "convertedDocument" = NULL, "warnings" = NULL, "documentHash" = NULL
        WHERE preview."ownerId" = ${userId} AND preview."sourceWhiteboardId" = ${id}
          AND preview."status" IN ('PROCESSING', 'READY', 'UNRECOGNIZED')
          AND NOT EXISTS (
            SELECT 1 FROM "DiagramConversion" AS conversion
            WHERE conversion."ownerId" = ${userId} AND conversion."previewId" = preview."id"
          )`;
      await tx.diagram.delete({ where: { id } });
    });

    await this.invalidateListCache(userId);

    return {
      message: `Diagram with id ${id} deleted successfully`,
    };
  }
}
