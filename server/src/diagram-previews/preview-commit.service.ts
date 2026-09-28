import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { HttpException, Inject, Injectable, Logger } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import {
  lockDiagramOwner,
  collectDiagramAssetIds,
  validateDiagramAssets,
  syncDiagramAssets,
} from '../diagrams/diagram-assets';
import { diagramListCacheKey } from '../diagrams/diagrams.cache';
import { CommitPreviewDto } from './commit-preview.dto';
import { processPreviewImage } from './preview-image';
import { PreviewPipelineError } from './preview-provider.service';
import { readCommitDocument } from './preview-commit-document';

export const previewCommitEnabled = () =>
  process.env.WHITEBOARD_AI_COMMIT_ENABLED === 'true';
const fail = (code: string, message: string, status = 409): never => {
  throw new HttpException({ code, message }, status);
};
function drawing(value: Prisma.JsonValue) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (
    value.pack !== 'whiteboard' ||
    value.version !== 1 ||
    typeof value.image !== 'string' ||
    typeof value.width !== 'number' ||
    typeof value.height !== 'number'
  )
    return null;
  return { image: value.image, width: value.width, height: value.height };
}

@Injectable()
export class PreviewCommitService {
  private readonly logger = new Logger(PreviewCommitService.name);
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async commit(ownerId: string, previewId: string, input: CommitPreviewDto) {
    if (!previewCommitEnabled())
      fail(
        'preview_commit_unavailable',
        'Creating diagrams from previews is not enabled yet.',
        503,
      );
    if (
      !/^[a-f0-9]{64}$/.test(input.documentHash) ||
      typeof input.acknowledgeStale !== 'boolean' ||
      (input.title !== undefined &&
        (typeof input.title !== 'string' ||
          !input.title.trim() ||
          input.title.length > 200))
    )
      fail('invalid_commit', 'Choose a valid reviewed preview.', 400);

    // Read/decode BEFORE the owner lock. Compare exactly this saved image again
    // inside the transaction, so a concurrent autosave cannot hide staleness.
    // The receipt path intentionally needs neither a live preview nor an image.
    let saved: ReturnType<typeof drawing> = null;
    let savedHash: string | null = null;
    const receiptExists = await this.prisma.diagramConversion.findFirst({
      where: { ownerId, previewId },
      select: { id: true },
    });
    if (!receiptExists && !input.acknowledgeStale) {
      const candidate = await this.prisma.diagramPreview.findFirst({
        where: {
          id: previewId,
          ownerId,
          status: 'READY',
          expiresAt: { gt: new Date() },
        },
        select: {
          sourceWhiteboard: {
            select: { data: true, ownerId: true, type: true },
          },
        },
      });
      const source = candidate?.sourceWhiteboard;
      if (source?.ownerId === ownerId && source.type === 'whiteboard')
        saved = drawing(source.data);
      if (saved) {
        try {
          savedHash = (
            await processPreviewImage(saved.image, saved.width, saved.height)
          ).sourceSHA256;
        } catch (error) {
          if (
            error instanceof PreviewPipelineError &&
            error.code === 'image_processing_busy'
          )
            fail(
              'preview_commit_unavailable',
              'Image processing is busy. Retry creating this same diagram.',
              503,
            );
          // An unreadable/new blank source is conservatively stale; approval
          // may still use the independently retained valid frozen snapshot.
        }
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await lockDiagramOwner(tx, ownerId);
      const receipt = await tx.diagramConversion.findFirst({
        where: { ownerId, previewId },
        include: {
          diagram: {
            select: { id: true, ownerId: true, visualDocumentId: true },
          },
        },
      });
      if (receipt) {
        if (receipt.documentHash !== input.documentHash)
          fail(
            'preview_hash_mismatch',
            'The reviewed preview does not match this request.',
          );
        if (!receipt.diagram || receipt.diagram.ownerId !== ownerId)
          return fail(
            'diagram_deleted',
            'The diagram created from this preview was deleted. It will not be recreated.',
            410,
          );
        return {
          previewId,
          diagramId: receipt.diagram.id,
          visualDocumentId: receipt.diagram.visualDocumentId,
          sourceWhiteboardId: receipt.sourceWhiteboardId,
          documentHash: receipt.documentHash,
          created: false,
        };
      }
      const preview = await tx.diagramPreview.findFirst({
        where: { id: previewId, ownerId },
      });
      if (!preview) return fail('preview_not_found', 'Preview not found.', 404);
      if (preview.expiresAt.getTime() <= Date.now())
        return fail('preview_expired', 'This preview has expired.', 410);
      if (preview.status !== 'READY')
        return fail(
          'preview_not_ready',
          'This preview is not ready to create a diagram.',
        );
      if (preview.documentHash !== input.documentHash)
        return fail(
          'preview_hash_mismatch',
          'The reviewed preview does not match this request.',
        );
      const source =
        preview.sourceWhiteboardId &&
        (await tx.diagram.findFirst({
          where: {
            id: preview.sourceWhiteboardId,
            ownerId,
            type: 'whiteboard',
          },
        }));
      if (!source)
        return fail(
          'source_unavailable',
          'The source whiteboard is no longer available.',
          410,
        );
      if (
        !input.acknowledgeStale &&
        (savedHash !== preview.sourceSHA256 ||
          !saved ||
          JSON.stringify(drawing(source.data)) !== JSON.stringify(saved))
      )
        return fail(
          'preview_stale',
          'The whiteboard has changed. Confirm using the reviewed preview.',
        );
      if (!preview.sourceSnapshotId)
        return fail(
          'snapshot_unavailable',
          'The frozen source snapshot is unavailable.',
          410,
        );
      await tx.$queryRaw`SELECT "id" FROM "PreviewSourceSnapshot" WHERE "id" = ${preview.sourceSnapshotId} FOR UPDATE`;
      const snapshot = await tx.previewSourceSnapshot.findFirst({
        where: { id: preview.sourceSnapshotId, ownerId, status: 'READY' },
      });
      if (
        !snapshot ||
        snapshot.sourceSHA256 !== preview.sourceSHA256 ||
        snapshot.width !== preview.sourceWidth ||
        snapshot.height !== preview.sourceHeight
      )
        return fail(
          'snapshot_unavailable',
          'The frozen source snapshot is unavailable.',
          410,
        );
      const document = readCommitDocument(
        preview.convertedDocument,
        input.documentHash,
      );
      const assetIds = collectDiagramAssetIds(document);
      await validateDiagramAssets(tx, ownerId, assetIds);
      const group =
        source.visualDocumentId &&
        (await tx.visualDocument.findFirst({
          where: { id: source.visualDocumentId, ownerId },
          select: { id: true },
        }));
      const visualDocument =
        group ||
        (await tx.visualDocument.create({
          data: { ownerId, title: source.title.slice(0, 200) || 'Whiteboard' },
          select: { id: true },
        }));
      if (source.visualDocumentId !== visualDocument.id)
        await tx.diagram.update({
          where: { id: source.id },
          data: { visualDocumentId: visualDocument.id },
        });
      const diagram = await tx.diagram.create({
        data: {
          ownerId,
          title:
            input.title?.trim() ??
            `${source.title.slice(0, 185) || 'Whiteboard'} — Diagram`,
          type: 'diagram',
          status: 'draft',
          visualDocumentId: visualDocument.id,
          data: document as unknown as Prisma.InputJsonValue,
        },
        select: { id: true },
      });
      await syncDiagramAssets(tx, diagram.id, assetIds);
      await tx.diagramConversion.create({
        data: {
          ownerId,
          previewId,
          diagramId: diagram.id,
          sourceWhiteboardId: source.id,
          sourceSnapshotId: snapshot.id,
          sourceSHA256: snapshot.sourceSHA256,
          approvedDocument: document as unknown as Prisma.InputJsonValue,
          documentHash: input.documentHash,
          acknowledgedStale: input.acknowledgeStale,
          requestedModel: preview.requestedModel,
          resolvedModel: preview.resolvedModel,
          inputPipelineVersion: preview.inputPipelineVersion,
          promptVersion: preview.promptVersion,
          outputSchemaVersion: preview.outputSchemaVersion,
          converterVersion: preview.converterVersion,
        },
      });
      return {
        previewId,
        diagramId: diagram.id,
        visualDocumentId: visualDocument.id,
        sourceWhiteboardId: source.id,
        documentHash: input.documentHash,
        created: true,
      };
    });
    // Retry this too: a response lost after commit must still repair a stale list.
    try {
      await this.cache.del(diagramListCacheKey(ownerId));
    } catch {
      this.logger.warn(
        'Could not invalidate the diagram list after preview commit.',
      );
    }
    return result;
  }
}
