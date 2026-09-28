import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '../generated/prisma/client';
import {
  CreateUploadDto,
  UpdateNodeDto,
  UpdateSectionDto,
} from './dto/node-library.dto';
import { processUploadedImage } from './image-processing';
import {
  ASSET_URL_TTL_SECONDS,
  InvalidUploadedFileError,
  S3AssetsService,
} from './s3-assets.service';
import {
  cleanupUnpublishedAssetKeys,
  MAX_UNPUBLISHED_ASSET_KEYS,
} from './unpublished-assets';

const assetSelect = {
  id: true,
  mimeType: true,
  width: true,
  height: true,
} as const;
const nodeSelect = {
  id: true,
  sectionId: true,
  assetId: true,
  name: true,
  defaultWidth: true,
  defaultHeight: true,
  sortOrder: true,
  asset: { select: assetSelect },
} as const;
const byOrder = [
  { sortOrder: 'asc' },
  { createdAt: 'asc' },
  { id: 'asc' },
] as const;
const PENDING_LIFETIME_MS = 24 * 60 * 60 * 1000;
const PROCESSING_LEASE_MS = 10 * 60 * 1000;

function positiveLimit(name: string, fallback: number, maximum: number) {
  const value = Number(process.env[name]);
  return Number.isSafeInteger(value) && value > 0
    ? Math.min(value, maximum)
    : fallback;
}

@Injectable()
export class NodeLibraryService {
  private readonly logger = new Logger(NodeLibraryService.name);
  // One decoder per server process bounds working memory on small instances.
  private processing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: S3AssetsService,
  ) {}

  private get limits() {
    return {
      fileBytes: positiveLimit(
        'ASSET_MAX_FILE_BYTES',
        10 * 1024 * 1024,
        100 * 1024 * 1024,
      ),
      quotaBytes: positiveLimit(
        'ASSET_USER_QUOTA_BYTES',
        100 * 1024 * 1024,
        2147483647,
      ),
      pixels: positiveLimit('ASSET_MAX_IMAGE_PIXELS', 16_000_000, 40_000_000),
    };
  }

  private async lockOwner(tx: Prisma.TransactionClient, ownerId: string) {
    // Serializes quota reservations and publication across all API instances.
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${ownerId} FOR UPDATE`;
  }

  private async usage(tx: Prisma.TransactionClient, ownerId: string) {
    const [reserved, stored] = await Promise.all([
      tx.asset.aggregate({
        where: { ownerId, status: { in: ['PENDING', 'PROCESSING'] } },
        _sum: { byteSize: true },
      }),
      tx.asset.aggregate({
        where: { ownerId, status: 'READY' },
        _sum: { storedBytes: true },
      }),
    ]);
    return (reserved._sum.byteSize ?? 0) + (stored._sum.storedBytes ?? 0);
  }

  private async requireSection(
    ownerId: string,
    id: string,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    const section = await tx.customNodeSection.findFirst({
      where: { id, ownerId, deletedAt: null },
    });
    if (!section)
      throw new NotFoundException('Custom library section not found.');
    return section;
  }

  async listSections(ownerId: string) {
    const sections = await this.prisma.customNodeSection.findMany({
      where: { ownerId, deletedAt: null },
      orderBy: [...byOrder],
      select: {
        id: true,
        name: true,
        sortOrder: true,
        nodes: {
          where: { deletedAt: null, asset: { status: 'READY' } },
          orderBy: [...byOrder],
          select: nodeSelect,
        },
      },
    });
    return { sections };
  }

  async createSection(ownerId: string, name: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockOwner(tx, ownerId);
      const count = await tx.customNodeSection.count({
        where: { ownerId, deletedAt: null },
      });
      if (count >= 100)
        throw new BadRequestException(
          'A maximum of 100 custom sections is supported.',
        );
      const section = await tx.customNodeSection.create({
        data: {
          ownerId,
          name,
          sortOrder:
            ((
              await tx.customNodeSection.findFirst({
                where: { ownerId, deletedAt: null },
                orderBy: { sortOrder: 'desc' },
                select: { sortOrder: true },
              })
            )?.sortOrder ?? -1) + 1,
        },
        select: { id: true, name: true, sortOrder: true },
      });
      return { ...section, nodes: [] };
    });
  }

  async updateSection(ownerId: string, id: string, patch: UpdateSectionDto) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockOwner(tx, ownerId);
      await this.requireSection(ownerId, id, tx);
      return tx.customNodeSection.update({
        where: { id },
        data: { name: patch.name, sortOrder: patch.sortOrder },
        select: { id: true, name: true, sortOrder: true },
      });
    });
  }

  async deleteSection(ownerId: string, id: string) {
    await this.prisma.$transaction(async (tx) => {
      await this.lockOwner(tx, ownerId);
      await this.requireSection(ownerId, id, tx);
      const deletedAt = new Date();
      await tx.customNodeSection.update({ where: { id }, data: { deletedAt } });
      await tx.customNodeDefinition.updateMany({
        where: { sectionId: id, deletedAt: null },
        data: { deletedAt },
      });
      // 3D objects reference no asset; diagrams embed their recipe snapshot.
      await tx.customObject3D.deleteMany({ where: { sectionId: id } });
    });
    // Never delete READY S3 objects: existing diagrams still reference them.
    return { deleted: true };
  }

  async updateNode(ownerId: string, id: string, patch: UpdateNodeDto) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockOwner(tx, ownerId);
      const node = await tx.customNodeDefinition.findFirst({
        where: {
          id,
          deletedAt: null,
          section: { ownerId, deletedAt: null },
          asset: { status: 'READY' },
        },
      });
      if (!node) throw new NotFoundException('Custom node not found.');
      if (patch.sectionId)
        await this.requireSection(ownerId, patch.sectionId, tx);
      return tx.customNodeDefinition.update({
        where: { id },
        data: {
          name: patch.name,
          sortOrder: patch.sortOrder,
          sectionId: patch.sectionId,
        },
        select: nodeSelect,
      });
    });
  }

  async deleteNode(ownerId: string, id: string) {
    const result = await this.prisma.customNodeDefinition.updateMany({
      where: { id, deletedAt: null, section: { ownerId, deletedAt: null } },
      data: { deletedAt: new Date() },
    });
    if (!result.count) throw new NotFoundException('Custom node not found.');
    return { deleted: true };
  }

  async createUpload(ownerId: string, sectionId: string, dto: CreateUploadDto) {
    this.storage.requireConfiguration();
    if (
      dto.byteSize > this.limits.fileBytes ||
      (dto.contentType === 'image/svg+xml' && dto.byteSize > 1024 * 1024)
    ) {
      throw new BadRequestException(
        'File exceeds the upload limit (SVG maximum: 1 MiB).',
      );
    }
    const extensions: Record<string, RegExp> = {
      'image/png': /\.png$/i,
      'image/jpeg': /\.jpe?g$/i,
      'image/webp': /\.webp$/i,
      'image/svg+xml': /\.svg$/i,
    };
    if (!extensions[dto.contentType]?.test(dto.fileName))
      throw new BadRequestException(
        'Filename extension does not match the image type.',
      );
    const assetId = randomUUID();
    const uploadKey = `pending/${ownerId}/${assetId}/${randomUUID()}`;
    await this.prisma.$transaction(async (tx) => {
      await this.lockOwner(tx, ownerId);
      await this.requireSection(ownerId, sectionId, tx);
      // Expired upload forms cannot be replayed; releasing these reservations
      // is safe. Bucket lifecycle removes the corresponding pending objects.
      await tx.asset.updateMany({
        where: {
          ownerId,
          status: 'PENDING',
          createdAt: { lt: new Date(Date.now() - PENDING_LIFETIME_MS) },
        },
        data: { status: 'REJECTED' },
      });
      if (
        (await this.usage(tx, ownerId)) + dto.byteSize >
        this.limits.quotaBytes
      ) {
        throw new BadRequestException(
          'Your custom node storage quota is full.',
        );
      }
      await tx.asset.create({
        data: {
          id: assetId,
          ownerId,
          originalName: dto.fileName,
          originalMimeType: dto.contentType,
          mimeType: 'image/png',
          byteSize: dto.byteSize,
          uploadKey,
          status: 'PENDING',
        },
      });
      const count = await tx.customNodeDefinition.count({
        where: { sectionId, deletedAt: null },
      });
      if (count >= 1000)
        throw new BadRequestException(
          'A custom section supports at most 1000 nodes.',
        );
      await tx.customNodeDefinition.create({
        data: {
          sectionId,
          assetId,
          name:
            dto.name ??
            (dto.fileName
              .replace(/\.[^.]+$/, '')
              .trim()
              .slice(0, 100) ||
              'Custom node'),
          sortOrder:
            ((
              await tx.customNodeDefinition.findFirst({
                where: { sectionId, deletedAt: null },
                orderBy: { sortOrder: 'desc' },
                select: { sortOrder: true },
              })
            )?.sortOrder ?? -1) + 1,
        },
      });
    });
    try {
      const form = await this.storage.createUpload(
        uploadKey,
        dto.contentType,
        dto.byteSize,
      );
      return { assetId, ...form };
    } catch {
      await this.prisma.asset.updateMany({
        where: { id: assetId, ownerId, status: 'PENDING' },
        data: { status: 'REJECTED' },
      });
      throw new ServiceUnavailableException(
        'S3 upload signing failed. Check the server AWS configuration.',
      );
    }
  }

  private async readyNode(ownerId: string, assetId: string) {
    const node = await this.prisma.customNodeDefinition.findFirst({
      where: {
        assetId,
        deletedAt: null,
        section: { ownerId, deletedAt: null },
        asset: { status: 'READY' },
      },
      select: nodeSelect,
    });
    if (!node)
      throw new NotFoundException('Custom node or section was removed.');
    return node;
  }

  async completeUpload(ownerId: string, assetId: string) {
    const asset = await this.prisma.asset.findFirst({
      where: { id: assetId, ownerId },
    });
    if (!asset) throw new NotFoundException('Upload not found.');
    if (asset.status === 'READY') return this.readyNode(ownerId, assetId);
    if (asset.status === 'REJECTED' || asset.status === 'DELETING')
      throw new BadRequestException(
        'Upload is no longer valid. Upload the file again.',
      );
    if (this.processing)
      throw new ServiceUnavailableException(
        'Another image is being processed. Retry this upload shortly.',
      );
    this.storage.requireConfiguration();
    this.processing = true;
    const leaseTime = new Date();
    const keys: string[] = [];
    let published = false;
    let claimed = false;
    let cleanupUnpublished = false;
    try {
      const claim = await this.prisma.asset.updateMany({
        where: {
          id: assetId,
          ownerId,
          OR: [
            { status: 'PENDING' },
            {
              status: 'PROCESSING',
              updatedAt: { lt: new Date(Date.now() - PROCESSING_LEASE_MS) },
            },
          ],
        },
        data: { status: 'PROCESSING', updatedAt: leaseTime },
      });
      if (!claim.count)
        throw new ConflictException(
          'This upload is already being processed. Retry shortly.',
        );
      claimed = true;
      if (asset.createdAt.getTime() < Date.now() - PENDING_LIFETIME_MS)
        throw new InvalidUploadedFileError(
          'Upload expired. Upload the file again.',
        );
      const input = await this.storage.readUpload(
        asset.uploadKey,
        asset.byteSize,
        asset.originalMimeType,
      );
      const processed = await processUploadedImage(
        input,
        asset.originalMimeType,
        this.limits.pixels,
      );
      const storedBytes = processed.image.length + processed.thumbnail.length;
      if (storedBytes > this.limits.fileBytes * 2)
        throw new InvalidUploadedFileError(
          'Decoded image exceeds the storage limit. Reduce its dimensions.',
        );
      const prefix = `assets/${ownerId}/${assetId}/${randomUUID()}`;
      const s3Key = `${prefix}/image.png`;
      const thumbnailKey = `${prefix}/thumbnail.png`;
      keys.push(s3Key, thumbnailKey);
      // Persist the exact immutable attempt keys BEFORE any S3 PUT. A process
      // crash, quota rejection or failed cleanup cannot orphan an untracked file.
      await this.prisma.$transaction(async (tx) => {
        await this.lockOwner(tx, ownerId);
        const current = await tx.asset.findFirst({
          where: {
            id: assetId,
            ownerId,
            status: 'PROCESSING',
            updatedAt: leaseTime,
          },
          select: { unpublishedKeys: true },
        });
        if (!current)
          throw new ConflictException(
            'Upload processing lease expired. Retry shortly.',
          );
        if (
          (current.unpublishedKeys ?? []).length + keys.length >
          MAX_UNPUBLISHED_ASSET_KEYS
        ) {
          throw new InvalidUploadedFileError(
            'Too many incomplete upload attempts. Upload the file again; maintenance will clean the failed attempts.',
          );
        }
        const recorded = await tx.asset.updateMany({
          where: {
            id: assetId,
            ownerId,
            status: 'PROCESSING',
            updatedAt: leaseTime,
          },
          data: { unpublishedKeys: { push: keys }, updatedAt: leaseTime },
        });
        if (!recorded.count)
          throw new ConflictException(
            'Upload processing lease expired. Retry shortly.',
          );
      });
      await this.storage.putImage(s3Key, processed.image);
      await this.storage.putImage(thumbnailKey, processed.thumbnail);
      const node = await this.prisma.$transaction(async (tx) => {
        await this.lockOwner(tx, ownerId);
        const definition = await tx.customNodeDefinition.findFirst({
          where: {
            assetId,
            deletedAt: null,
            section: { ownerId, deletedAt: null },
          },
        });
        if (!definition)
          throw new InvalidUploadedFileError(
            'The destination section or node was removed.',
          );
        if (
          (await this.usage(tx, ownerId)) - asset.byteSize + storedBytes >
          this.limits.quotaBytes
        ) {
          throw new InvalidUploadedFileError(
            'Processed image exceeds your remaining storage quota.',
          );
        }
        const current = await tx.asset.findFirst({
          where: {
            id: assetId,
            ownerId,
            status: 'PROCESSING',
            updatedAt: leaseTime,
          },
          select: { unpublishedKeys: true },
        });
        if (!current)
          throw new ConflictException(
            'Upload processing lease expired. Retry shortly.',
          );
        const result = await tx.asset.updateMany({
          where: {
            id: assetId,
            ownerId,
            status: 'PROCESSING',
            updatedAt: leaseTime,
          },
          data: {
            status: 'READY',
            s3Key,
            thumbnailKey,
            storedBytes,
            width: processed.width,
            height: processed.height,
            checksum: processed.checksum,
            unpublishedKeys: (current.unpublishedKeys ?? []).filter(
              (key) => !keys.includes(key),
            ),
          },
        });
        if (!result.count)
          throw new ConflictException(
            'Upload processing lease expired. Retry shortly.',
          );
        const scale = 120 / Math.max(processed.width, processed.height);
        return tx.customNodeDefinition.update({
          where: { id: definition.id },
          data: {
            defaultWidth: Math.max(24, Math.round(processed.width * scale)),
            defaultHeight: Math.max(24, Math.round(processed.height * scale)),
          },
          select: nodeSelect,
        });
      });
      published = true;
      await this.storage
        .deletePendingOrUnpublished(asset.uploadKey)
        .catch(() => {
          this.logger.warn(
            'Pending upload cleanup failed; S3 lifecycle will remove it.',
          );
        });
      return node;
    } catch (error) {
      if (!published && claimed) {
        const released = await this.prisma.asset.updateMany({
          where: {
            id: assetId,
            ownerId,
            status: 'PROCESSING',
            updatedAt: leaseTime,
          },
          data: {
            status:
              error instanceof InvalidUploadedFileError
                ? 'REJECTED'
                : 'PENDING',
          },
        });
        // A failed transaction response may be ambiguous after a network loss.
        // Delete files only if our lease was definitely still unpublished.
        cleanupUnpublished = released.count > 0;
      }
      if (error instanceof InvalidUploadedFileError)
        throw new BadRequestException(error.message);
      if (
        error instanceof ConflictException ||
        error instanceof ServiceUnavailableException
      )
        throw error;
      this.logger.warn(
        'Custom node image processing failed; upload can be retried.',
      );
      throw new ServiceUnavailableException(
        'Could not read or process the S3 upload. Verify that the upload finished, then retry.',
      );
    } finally {
      this.processing = false;
      if (!published && cleanupUnpublished) {
        const cleanup = await cleanupUnpublishedAssetKeys(
          this.prisma,
          this.storage,
          { id: assetId, ownerId },
          keys,
        );
        if (cleanup.failedKeys.length)
          this.logger.warn(
            'Unpublished S3 objects remain journaled for maintenance retry.',
          );
      }
    }
  }

  async resolveAssets(
    ownerId: string,
    assetIds: string[],
    variant: 'image' | 'thumbnail' = 'image',
  ) {
    const unique = [...new Set(assetIds)];
    const assets = await this.prisma.asset.findMany({
      where: { id: { in: unique }, ownerId, status: 'READY' },
      select: { id: true, s3Key: true, thumbnailKey: true },
    });
    // An unavailable/foreign ID must not hide other valid images in a batch.
    // Omitting it discloses no difference between nonexistent and foreign IDs.
    if (!assets.length) return { assets: [] };
    this.storage.requireConfiguration();
    try {
      return {
        assets: await Promise.all(
          assets.map(async (asset) => {
            const key =
              variant === 'thumbnail' ? asset.thumbnailKey : asset.s3Key;
            if (!key)
              throw new NotFoundException('Asset image is unavailable.');
            return {
              id: asset.id,
              url: await this.storage.signRead(key),
              expiresAt: new Date(
                Date.now() + ASSET_URL_TTL_SECONDS * 1000,
              ).toISOString(),
            };
          }),
        ),
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new ServiceUnavailableException(
        'S3 asset delivery is unavailable. Check the server AWS configuration.',
      );
    }
  }
}
