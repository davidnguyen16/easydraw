import { createHash, randomUUID } from 'node:crypto';
import { HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type DiagramPreview } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { lockDiagramOwner } from '../diagrams/diagram-assets';
import { S3AssetsService } from '../node-library/s3-assets.service';
import { CreatePreviewDto } from './create-preview.dto';
import { previewCommitEnabled } from './preview-commit.service';
import { processPreviewImage, INPUT_PIPELINE_VERSION } from './preview-image';
import {
  buildPreviewSourceCrops,
  previewWarnings,
} from './preview-source-crops';
import {
  PreviewProviderService,
  PROMPT_VERSION,
  PreviewPipelineError,
} from './preview-provider.service';
import {
  convertPreviewDraft,
  hashPreviewDocument,
  CONVERTER_VERSION,
  assertPreviewPayloadSize,
} from './preview-converter';
import {
  MAX_PREVIEW_REFINEMENTS,
  readStoredPreview,
  storePreviewDocument,
} from './preview-refinement';

export const PREVIEW_TTL_MS = 24 * 60 * 60 * 1000;
export const PREVIEW_LEASE_MS = 3 * 60 * 1000;
export const previewEnabled = () =>
  process.env.WHITEBOARD_AI_PREVIEW_ENABLED === 'true';
const fail = (code: string, message: string, status = 503): never => {
  throw new HttpException({ code, message }, status);
};
const json = (value: unknown) => value as Prisma.InputJsonValue;
const versions = () => ({
  inputPipelineVersion: INPUT_PIPELINE_VERSION,
  promptVersion: PROMPT_VERSION,
  outputSchemaVersion: '2',
  converterVersion: CONVERTER_VERSION,
});
const quota = (name: string, fallback: number, cap: number) => {
  const value = Number(process.env[name] ?? fallback);
  return Number.isInteger(value) && value >= 1 && value <= cap
    ? value
    : fallback;
};

/** Payload identity, not an authorization token. No prompt or image is logged. */
export function previewRequestFingerprint(
  sourceId: string,
  input: CreatePreviewDto,
): string {
  const identity: unknown[] = [
    sourceId,
    input.width,
    input.height,
    input.image,
    input.clientRevision ?? null,
    input.hint ?? '',
  ];
  // Preserve the original identity for outstanding requests from older clients.
  if (input.basePreviewId != null || input.feedback != null) {
    identity.push({
      refinementVersion: 1,
      basePreviewId: input.basePreviewId ?? null,
      feedback: input.feedback ?? null,
    });
  }
  return createHash('sha256').update(JSON.stringify(identity)).digest('hex');
}

@Injectable()
export class DiagramPreviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: S3AssetsService,
    private readonly provider: PreviewProviderService,
  ) {}

  private enabled() {
    if (!previewEnabled())
      fail(
        'preview_not_enabled',
        'AI preview is not enabled on this server yet.',
      );
  }

  private async ownedSource(
    tx: Prisma.TransactionClient,
    ownerId: string,
    id: string,
  ) {
    const source = await tx.diagram.findFirst({
      where: { id, ownerId, type: 'whiteboard' },
      select: { id: true },
    });
    if (!source) throw new NotFoundException('Whiteboard not found.');
  }

  private async checkRequestLimit(
    tx: Prisma.TransactionClient,
    ownerId: string,
    now: Date,
  ) {
    const recent = await tx.diagramPreview.count({
      where: { ownerId, createdAt: { gte: new Date(now.getTime() - 60000) } },
    });
    if (recent >= quota('WHITEBOARD_AI_REQUESTS_PER_MINUTE', 5, 20))
      fail(
        'preview_rate_limit',
        'Too many previews. Please wait a minute.',
        429,
      );
    const midnight = new Date(now);
    midnight.setUTCHours(0, 0, 0, 0);
    const attempts = await tx.diagramPreview.count({
      where: { ownerId, createdAt: { gte: midnight } },
    });
    if (attempts >= 3 * quota('WHITEBOARD_AI_DAILY_LIMIT', 20, 1000))
      fail(
        'preview_daily_limit',
        'The daily preview request limit has been reached. It resets at 00:00 UTC.',
        429,
      );
  }

  /** Call only under the owner lock. A crashed dispatch is NEVER sent again. */
  async reconcile(tx: Prisma.TransactionClient, ownerId: string, now: Date) {
    await tx.diagramPreview.updateMany({
      where: { ownerId, status: 'PROCESSING', leaseUntil: { lte: now } },
      data: { status: 'FAILED', errorCode: 'generation_interrupted' },
    });
    await tx.diagramPreview.updateMany({
      where: {
        ownerId,
        sourceWhiteboardId: null,
        status: { in: ['PROCESSING', 'READY', 'UNRECOGNIZED'] },
      },
      data: {
        status: 'CANCELLED',
        errorCode: 'source_unavailable',
        convertedDocument: Prisma.DbNull,
        warnings: Prisma.DbNull,
        documentHash: null,
      },
    });
    await tx.diagramPreview.updateMany({
      where: {
        ownerId,
        expiresAt: { lte: now },
        status: { in: ['READY', 'UNRECOGNIZED'] },
      },
      data: {
        status: 'EXPIRED',
        convertedDocument: Prisma.DbNull,
        warnings: Prisma.DbNull,
        documentHash: null,
      },
    });
    await tx.diagramPreview.updateMany({
      where: {
        ownerId,
        expiresAt: { lte: now },
        status: { in: ['FAILED', 'CANCELLED'] },
      },
      data: {
        convertedDocument: Prisma.DbNull,
        warnings: Prisma.DbNull,
        documentHash: null,
      },
    });
  }

  async generate(ownerId: string, sourceId: string, input: CreatePreviewDto) {
    this.enabled();
    // MaxLength counts Unicode code points; the UI/model contract counts UTF-16
    // code units. Reject before reserving or uploading, including internal calls.
    const hint = input.hint ?? '';
    if (typeof hint !== 'string' || hint.length > 4000) {
      fail(
        'invalid_hint',
        'The design description must not exceed 4000 characters.',
        400,
      );
    }
    if (
      (input.basePreviewId != null &&
        (typeof input.basePreviewId !== 'string' ||
          !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
            input.basePreviewId,
          ) ||
          typeof input.feedback !== 'string' ||
          !input.feedback.trim() ||
          input.feedback.length > 2000)) ||
      (input.basePreviewId == null && input.feedback != null)
    ) {
      fail(
        'invalid_refinement',
        'Choose a previous preview and describe the changes to refine it.',
        400,
      );
    }
    const fingerprint = previewRequestFingerprint(sourceId, input);
    const reservation = await this.prisma.$transaction(async (tx) => {
      await lockDiagramOwner(tx, ownerId);
      await this.ownedSource(tx, ownerId, sourceId);
      const now = new Date();
      await this.reconcile(tx, ownerId, now);
      const previous = await tx.diagramPreview.findUnique({
        where: {
          ownerId_clientRequestId: {
            ownerId,
            clientRequestId: input.clientRequestId,
          },
        },
      });
      if (previous) {
        if (
          previous.sourceWhiteboardId !== sourceId ||
          (previous.requestFingerprint &&
            previous.requestFingerprint !== fingerprint)
        ) {
          fail(
            'request_conflict',
            'This request ID was already used with different input.',
            409,
          );
        }
        return { preview: previous, fresh: false };
      }
      let base:
        | {
            row: DiagramPreview;
            stored: ReturnType<typeof readStoredPreview>;
          }
        | undefined;
      if (input.basePreviewId) {
        const row = await tx.diagramPreview.findFirst({
          where: {
            id: input.basePreviewId,
            ownerId,
            sourceWhiteboardId: sourceId,
            status: 'READY',
            expiresAt: { gt: now },
          },
        });
        if (!row) {
          return fail(
            'refinement_unavailable',
            'That preview is unavailable for refinement. Generate a new preview.',
            409,
          );
        }
        const stored = readStoredPreview(row.convertedDocument);
        if (!stored.context) {
          return fail(
            'refinement_unavailable',
            'This older preview has no refinement context. Generate a new preview.',
            409,
          );
        }
        if (hashPreviewDocument(stored.document) !== row.documentHash) {
          fail(
            'refinement_unavailable',
            'That preview could not be verified. Generate a new preview.',
            409,
          );
        }
        if (stored.context.feedbackHistory.length >= MAX_PREVIEW_REFINEMENTS) {
          fail(
            'refinement_limit',
            'This preview has reached ten refinements. Generate a new preview to start again.',
            400,
          );
        }
        base = { row, stored };
      }
      this.provider.requireConfiguration();
      this.storage.requireConfiguration();
      const active = await tx.diagramPreview.count({
        where: {
          ownerId,
          status: { in: ['PROCESSING', 'CANCELLED'] },
          leaseUntil: { gt: now },
        },
      });
      if (active)
        fail(
          'preview_busy',
          'A preview is still finishing. Please wait before generating another.',
          409,
        );
      await this.checkRequestLimit(tx, ownerId, now);
      const midnight = new Date(now);
      midnight.setUTCHours(0, 0, 0, 0);
      const daily = await tx.diagramPreview.count({
        where: { ownerId, dispatchedAt: { gte: midnight } },
      });
      if (daily >= quota('WHITEBOARD_AI_DAILY_LIMIT', 20, 1000))
        fail(
          'preview_daily_limit',
          'The daily AI preview limit has been reached. It resets at 00:00 UTC.',
          429,
        );
      const preview = await tx.diagramPreview.create({
        data: {
          ownerId,
          sourceWhiteboardId: sourceId,
          clientRequestId: input.clientRequestId,
          requestFingerprint: fingerprint,
          clientRevision: input.clientRevision,
          sourceWidth: input.width,
          sourceHeight: input.height,
          requestedModel: this.provider.requestedModel,
          ...versions(),
          expiresAt: new Date(now.getTime() + PREVIEW_TTL_MS),
          leaseUntil: new Date(now.getTime() + PREVIEW_LEASE_MS),
        },
      });
      return { preview, fresh: true, base };
    });
    if (!reservation.fresh) return this.response(reservation.preview);
    const preview = reservation.preview;
    try {
      const image = await processPreviewImage(
        input.image,
        input.width,
        input.height,
      );
      const snapshotId = randomUUID();
      const sourceKey = `whiteboard-previews/${ownerId}/${snapshotId}/source.png`;
      const modelKey = `whiteboard-previews/${ownerId}/${snapshotId}/model.png`;
      const reserved = await this.prisma.$transaction(async (tx) => {
        await lockDiagramOwner(tx, ownerId);
        if (!(await this.liveAttempt(tx, ownerId, preview.id, sourceId)))
          return false;
        // Journal exact object keys BEFORE either external PUT can happen.
        await tx.previewSourceSnapshot.create({
          data: {
            id: snapshotId,
            ownerId,
            sourceObjectKey: sourceKey,
            modelInputObjectKey: modelKey,
            unpublishedKeys: [sourceKey, modelKey],
            sourceSHA256: image.sourceSHA256,
            modelInputSHA256: image.modelInputSHA256,
            width: image.width,
            height: image.height,
            byteSize: image.byteSize,
            modelInputWidth: image.modelInputWidth,
            modelInputHeight: image.modelInputHeight,
            cleanupAfter: preview.expiresAt,
            leaseUntil: preview.leaseUntil,
          },
        });
        await tx.diagramPreview.update({
          where: { id: preview.id },
          data: {
            sourceSnapshotId: snapshotId,
            sourceSHA256: image.sourceSHA256,
          },
        });
        return true;
      });
      if (!reserved) return await this.finishCancelled(ownerId, preview.id);
      try {
        await this.storage.putImage(
          sourceKey,
          image.source,
          'private, no-store',
        );
        await this.storage.putImage(
          modelKey,
          image.modelInput,
          'private, no-store',
        );
      } catch {
        fail(
          'preview_storage_unavailable',
          'Private preview storage is unavailable. Check the S3 preview-prefix permissions.',
        );
      }
      const dispatch = await this.prisma.$transaction(async (tx) => {
        await lockDiagramOwner(tx, ownerId);
        if (!(await this.liveAttempt(tx, ownerId, preview.id, sourceId)))
          return false;
        const now = new Date();
        const midnight = new Date(now);
        midnight.setUTCHours(0, 0, 0, 0);
        // The UTC date can have changed while decoding/uploading.
        const daily = await tx.diagramPreview.count({
          where: { ownerId, dispatchedAt: { gte: midnight } },
        });
        if (daily >= quota('WHITEBOARD_AI_DAILY_LIMIT', 20, 1000))
          fail('preview_daily_limit', 'Daily preview limit reached.', 429);
        await tx.previewSourceSnapshot.update({
          where: { id: snapshotId },
          data: { status: 'READY', unpublishedKeys: [] },
        });
        await tx.diagramPreview.update({
          where: { id: preview.id },
          data: { dispatchedAt: now },
        });
        return true;
      });
      if (!dispatch) return await this.finishCancelled(ownerId, preview.id);
      const generated = await this.provider.generate(
        image.modelInput,
        input.hint ?? '',
        reservation.base && {
          previousDraft: reservation.base.stored.context!.draft,
          previousHint: reservation.base.stored.context!.hint,
          feedbackHistory: reservation.base.stored.context!.feedbackHistory,
          feedback: input.feedback!,
          sourceChanged:
            reservation.base.row.sourceSHA256 !== image.sourceSHA256 ||
            reservation.base.row.sourceWidth !== image.width ||
            reservation.base.row.sourceHeight !== image.height,
        },
      );
      const crops = await buildPreviewSourceCrops(
        generated.draft,
        image,
        reservation.base?.stored.document,
      );
      const document = convertPreviewDraft(generated.draft, image, crops);
      const warnings = previewWarnings(generated.draft);
      assertPreviewPayloadSize(document, warnings);
      const stored = document
        ? storePreviewDocument(document, {
            version: 1,
            hint: input.hint ?? '',
            feedbackHistory: reservation.base
              ? [
                  ...reservation.base.stored.context!.feedbackHistory,
                  input.feedback!,
                ]
              : [],
            draft: generated.draft,
            ...(input.basePreviewId
              ? { basePreviewId: input.basePreviewId }
              : {}),
          })
        : null;
      const result = await this.prisma.$transaction(async (tx) => {
        await lockDiagramOwner(tx, ownerId);
        if (!(await this.liveAttempt(tx, ownerId, preview.id, sourceId)))
          return null;
        const now = new Date();
        return tx.diagramPreview.update({
          where: { id: preview.id },
          data: {
            status: document ? 'READY' : 'UNRECOGNIZED',
            convertedDocument: stored ? json(stored) : Prisma.DbNull,
            documentHash: document ? hashPreviewDocument(document) : null,
            warnings: json(warnings),
            resolvedModel: generated.resolvedModel,
            readyAt: now,
            leaseUntil: now,
            // Retention is bounded from reservation, including slow uploads.
          },
        });
      });
      if (!result) return await this.finishCancelled(ownerId, preview.id);
      return this.response(result);
    } catch (error) {
      const code =
        error instanceof PreviewPipelineError
          ? error.code
          : error instanceof HttpException
            ? ((error.getResponse() as { code?: string }).code ??
              'generation_failed')
            : 'generation_failed';
      // Provider errors (and SDK/DB errors) are not logged or reflected verbatim.
      await this.prisma.$transaction(async (tx) => {
        const exists = await tx.user.findUnique({
          where: { id: ownerId },
          select: { id: true },
        });
        if (!exists) return;
        await lockDiagramOwner(tx, ownerId);
        await tx.diagramPreview.updateMany({
          where: { id: preview.id, ownerId, status: 'PROCESSING' },
          data: { status: 'FAILED', errorCode: code, leaseUntil: new Date() },
        });
        await tx.diagramPreview.updateMany({
          where: { id: preview.id, ownerId, status: 'CANCELLED' },
          data: { leaseUntil: new Date() },
        });
      });
      return this.get(ownerId, preview.id);
    }
  }

  private async liveAttempt(
    tx: Prisma.TransactionClient,
    ownerId: string,
    id: string,
    sourceId: string,
  ) {
    const attempt = await tx.diagramPreview.findFirst({
      where: {
        id,
        ownerId,
        sourceWhiteboardId: sourceId,
        status: 'PROCESSING',
        leaseUntil: { gt: new Date() },
        sourceWhiteboard: { ownerId, type: 'whiteboard' },
      },
    });
    return attempt;
  }

  private async finishCancelled(ownerId: string, id: string) {
    await this.prisma.$transaction(async (tx) => {
      await lockDiagramOwner(tx, ownerId);
      await tx.diagramPreview.updateMany({
        where: { id, ownerId, status: 'PROCESSING' },
        data: {
          status: 'CANCELLED',
          errorCode: 'generation_interrupted',
          leaseUntil: new Date(),
        },
      });
      await tx.diagramPreview.updateMany({
        where: { id, ownerId, status: 'CANCELLED' },
        data: { leaseUntil: new Date() },
      });
    });
    return this.get(ownerId, id);
  }

  async get(ownerId: string, id: string) {
    this.enabled();
    const row = await this.prisma.$transaction(async (tx) => {
      await lockDiagramOwner(tx, ownerId);
      await this.reconcile(tx, ownerId, new Date());
      return tx.diagramPreview.findFirst({ where: { id, ownerId } });
    });
    if (!row) throw new NotFoundException('Preview not found.');
    return this.response(row);
  }

  async findRequest(
    ownerId: string,
    sourceId: string,
    clientRequestId: string,
  ) {
    this.enabled();
    const row = await this.prisma.diagramPreview.findFirst({
      where: { ownerId, sourceWhiteboardId: sourceId, clientRequestId },
      select: { id: true },
    });
    if (!row) throw new NotFoundException('Preview request not found.');
    return this.get(ownerId, row.id);
  }

  async cancelRequest(
    ownerId: string,
    sourceId: string,
    clientRequestId: string,
  ) {
    this.enabled();
    await this.prisma.$transaction(async (tx) => {
      await lockDiagramOwner(tx, ownerId);
      await this.ownedSource(tx, ownerId, sourceId);
      const row = await tx.diagramPreview.findUnique({
        where: { ownerId_clientRequestId: { ownerId, clientRequestId } },
      });
      if (row && row.sourceWhiteboardId !== sourceId)
        throw new NotFoundException('Preview request not found.');
      if (
        row &&
        (await tx.diagramConversion.findFirst({
          where: { previewId: row.id, ownerId },
          select: { id: true },
        }))
      )
        fail(
          'preview_already_committed',
          'This preview already created a diagram and cannot be cancelled.',
          409,
        );
      const now = new Date();
      if (row) {
        await tx.diagramPreview.update({
          where: { id: row.id },
          data: {
            status: 'CANCELLED',
            convertedDocument: Prisma.DbNull,
            documentHash: null,
            warnings: Prisma.DbNull,
          },
        });
      } else {
        await this.checkRequestLimit(tx, ownerId, now);
        // Cancel may beat the original POST. This durable tombstone prevents a
        // late POST from dispatching a paid request, including across replicas.
        await tx.diagramPreview.create({
          data: {
            ownerId,
            sourceWhiteboardId: sourceId,
            clientRequestId,
            status: 'CANCELLED',
            requestedModel: this.provider.requestedModel,
            ...versions(),
            expiresAt: new Date(now.getTime() + PREVIEW_TTL_MS),
            leaseUntil: now,
          },
        });
      }
    });
  }

  async sourceUrl(ownerId: string, id: string) {
    this.enabled();
    const row = await this.prisma.$transaction(async (tx) => {
      await lockDiagramOwner(tx, ownerId);
      await this.reconcile(tx, ownerId, new Date());
      return tx.diagramPreview.findFirst({
        where: {
          id,
          ownerId,
          status: { in: ['READY', 'UNRECOGNIZED'] },
          expiresAt: { gt: new Date(Date.now() + 15000) },
        },
        include: { sourceSnapshot: true },
      });
    });
    if (
      !row?.sourceSnapshot ||
      row.sourceSnapshot.ownerId !== ownerId ||
      row.sourceSnapshot.status !== 'READY'
    )
      throw new NotFoundException('Preview source not found.');
    const ttl = Math.min(
      900,
      Math.floor((row.expiresAt.getTime() - Date.now()) / 1000),
    );
    return {
      url: await this.storage.signRead(row.sourceSnapshot.sourceObjectKey, ttl),
      expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
    };
  }

  private response(row: DiagramPreview) {
    const visible = row.status === 'READY' || row.status === 'UNRECOGNIZED';
    const stored =
      row.status === 'READY' ? readStoredPreview(row.convertedDocument) : null;
    return {
      id: row.id,
      clientRequestId: row.clientRequestId,
      clientRevision: row.clientRevision,
      status: row.status.toLowerCase(),
      document: stored?.document ?? null,
      creationAvailable: row.status === 'READY' && previewCommitEnabled(),
      // Missing on older API versions. New clients must fail closed rather than
      // send a paid refinement to an API that silently drops the new DTO fields.
      refinementAvailable: Boolean(
        stored?.context &&
        stored.context.feedbackHistory.length < MAX_PREVIEW_REFINEMENTS,
      ),
      documentHash: row.status === 'READY' ? row.documentHash : null,
      warnings: visible ? (row.warnings ?? []) : [],
      errorCode: row.errorCode,
      createdAt: row.createdAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      source: { width: row.sourceWidth ?? 0, height: row.sourceHeight ?? 0 },
      model: row.resolvedModel ?? row.requestedModel,
    };
  }
}
