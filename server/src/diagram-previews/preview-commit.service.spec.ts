import { randomUUID } from 'node:crypto';
import { HttpException } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { validate } from 'class-validator';
import type { WhiteboardDiagramDraftV2 } from '@easydraw/diagram-schema';
import type { PrismaService } from '../prisma/prisma.service';
import { PreviewCommitService } from './preview-commit.service';
import { CommitPreviewDto } from './commit-preview.dto';
import { processPreviewImage } from './preview-image';
import { PreviewPipelineError } from './preview-provider.service';
import { convertPreviewDraft, hashPreviewDocument } from './preview-converter';
import { storePreviewDocument } from './preview-refinement';
import { readCommitDocument } from './preview-commit-document';

jest.mock('./preview-image', () => ({ processPreviewImage: jest.fn() }));
const draft: WhiteboardDiagramDraftV2 = {
  version: 2,
  outcome: 'diagram',
  nodes: [
    {
      id: 'exact-node',
      shape: 'rectangle',
      label: 'Reviewed label',
      bounds: { x: 10, y: 20, width: 200, height: 150 },
      style: {
        stroke: '#000000',
        fill: '#ffffff',
        textColor: '#000000',
        strokeWidth: 2,
        fontSize: 16,
      },
    },
  ],
  edges: [],
  paths: [],
  crops: [],
  warnings: [],
};
type Row = Record<string, unknown>; // Deliberately tiny in-memory transactional fake.
type FindArgs = { where: Row; select?: unknown };
type CreateArgs = { data: Row };
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
function setup() {
  const ownerId = randomUUID(),
    previewId = randomUUID(),
    sourceId = randomUUID();
  const document = convertPreviewDraft(draft, { width: 800, height: 600 })!;
  const sourceHash = 'b'.repeat(64),
    documentHash = hashPreviewDocument(document);
  const source = {
    id: sourceId,
    ownerId,
    type: 'whiteboard',
    title: 'My sketch',
    visualDocumentId: null,
    updatedAt: new Date(),
    data: {
      pack: 'whiteboard',
      version: 1,
      width: 800,
      height: 600,
      image: 'data:image/png;base64,AAAA',
    },
  };
  const snapshot = {
    id: randomUUID(),
    ownerId,
    status: 'READY',
    width: 800,
    height: 600,
    sourceSHA256: sourceHash,
  };
  const preview = {
    id: previewId,
    ownerId,
    sourceWhiteboardId: sourceId,
    sourceSnapshotId: snapshot.id,
    status: 'READY',
    expiresAt: new Date(Date.now() + 60000),
    sourceSHA256: sourceHash,
    sourceWidth: 800,
    sourceHeight: 600,
    documentHash: documentHash as string | null,
    convertedDocument: storePreviewDocument(document, {
      version: 1,
      hint: 'private intent',
      feedbackHistory: ['private feedback'],
      draft,
    }) as ReturnType<typeof storePreviewDocument> | null,
    requestedModel: 'test',
    resolvedModel: 'test-resolved',
    inputPipelineVersion: '1',
    promptVersion: '2',
    outputSchemaVersion: '2',
    converterVersion: '2',
  };
  const diagrams: Row[] = [source],
    receipts: Row[] = [],
    groups: Row[] = [];
  const matches = (r: Row, where: Row) =>
    Object.entries(where).every(([k, v]) =>
      k === 'expiresAt'
        ? r.expiresAt instanceof Date && r.expiresAt > (v as { gt: Date }).gt
        : r[k] === v,
    );
  const find = (rows: Row[], where: Row) =>
    rows.find((r) => matches(r, where)) ?? null;
  const tx = {
    $queryRaw: jest.fn(() => Promise.resolve([{ id: ownerId }])),
    diagramConversion: {
      findFirst: jest.fn(({ where }: FindArgs) => {
        const r = find(receipts, where);
        return Promise.resolve(
          r && { ...r, diagram: find(diagrams, { id: r.diagramId }) },
        );
      }),
      create: jest.fn(({ data }: CreateArgs) => {
        const r = { id: randomUUID(), ...clone(data) };
        receipts.push(r);
        return Promise.resolve(r);
      }),
    },
    diagramPreview: {
      findFirst: jest.fn(({ where, select }: FindArgs) => {
        if (!matches(preview, where)) return Promise.resolve(null);
        return Promise.resolve(
          select
            ? {
                sourceWhiteboard: find(diagrams, {
                  id: preview.sourceWhiteboardId,
                }),
              }
            : preview,
        );
      }),
    },
    previewSourceSnapshot: {
      findFirst: jest.fn(({ where }: FindArgs) =>
        Promise.resolve(matches(snapshot, where) ? snapshot : null),
      ),
    },
    diagram: {
      findFirst: jest.fn(({ where }: FindArgs) =>
        Promise.resolve(find(diagrams, where)),
      ),
      create: jest.fn(({ data }: CreateArgs) => {
        const r = { id: randomUUID(), ...clone(data) };
        diagrams.push(r);
        return Promise.resolve(r);
      }),
      update: jest.fn(({ where, data }: FindArgs & CreateArgs) =>
        Promise.resolve(Object.assign(find(diagrams, where)!, data)),
      ),
    },
    visualDocument: {
      findFirst: jest.fn(({ where }: FindArgs) =>
        Promise.resolve(find(groups, where)),
      ),
      create: jest.fn(({ data }: CreateArgs) => {
        const r = { id: randomUUID(), ...data };
        groups.push(r);
        return Promise.resolve(r);
      }),
    },
    diagramAsset: {
      findMany: jest.fn(() => Promise.resolve([])),
      deleteMany: jest.fn(() => Promise.resolve({ count: 0 })),
    },
  };
  let queue = Promise.resolve();
  let beforeLock = () => {};
  const prisma = {
    ...tx,
    $transaction: jest.fn(<T>(work: (tx: unknown) => Promise<T>) => {
      const next = queue.then(() => {
        beforeLock();
        return work(tx);
      });
      queue = next.then(
        () => {},
        () => {},
      );
      return next;
    }),
  };
  const cache = { del: jest.fn(() => Promise.resolve(true)) };
  jest
    .mocked(processPreviewImage)
    .mockResolvedValue({ sourceSHA256: sourceHash } as Awaited<
      ReturnType<typeof processPreviewImage>
    >);
  const service = new PreviewCommitService(
    prisma as unknown as PrismaService,
    cache as unknown as Cache,
  );
  return {
    service,
    tx,
    prisma,
    cache,
    document,
    source,
    snapshot,
    preview,
    diagrams,
    receipts,
    groups,
    ownerId,
    previewId,
    input: { documentHash, acknowledgeStale: false },
    beforeLock: (fn: () => void) => {
      beforeLock = fn;
    },
  };
}
async function rejectsCode(promise: Promise<unknown>, code: string) {
  try {
    await promise;
    throw new Error('Unexpected success');
  } catch (error) {
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getResponse()).toMatchObject({ code });
  }
}

describe('create a diagram from an immutable reviewed preview', () => {
  const oldFlag = process.env.WHITEBOARD_AI_COMMIT_ENABLED;
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.WHITEBOARD_AI_COMMIT_ENABLED = 'true';
  });
  afterAll(() => {
    if (oldFlag === undefined) delete process.env.WHITEBOARD_AI_COMMIT_ENABLED;
    else process.env.WHITEBOARD_AI_COMMIT_ENABLED = oldFlag;
  });

  it('copies exactly the frozen document, creates its group/receipt and preserves source pixels', async () => {
    const f = setup(),
      before = clone(f.source.data),
      frozen = clone(f.preview.convertedDocument);
    const result = await f.service.commit(f.ownerId, f.previewId, f.input);
    expect(result).toMatchObject({
      previewId: f.previewId,
      created: true,
      documentHash: f.input.documentHash,
      sourceWhiteboardId: f.source.id,
    });
    expect(f.diagrams[1].data).toEqual(f.document);
    expect(f.receipts[0].approvedDocument).toEqual(f.document);
    expect(f.diagrams[1].data).not.toHaveProperty('context');
    expect(f.source.data).toEqual(before);
    expect(f.preview.convertedDocument).toEqual(frozen);
    expect(f.source.visualDocumentId).toBe(result.visualDocumentId);
    expect(f.cache.del).toHaveBeenCalledWith(`diagrams:list:${f.ownerId}`);
    expect(f.tx.$queryRaw).toHaveBeenCalledTimes(2);
  });
  it('serializes concurrent repeated clicks to one diagram and one receipt', async () => {
    const f = setup();
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        f.service.commit(f.ownerId, f.previewId, f.input),
      ),
    );
    expect(new Set(results.map((r) => r.diagramId)).size).toBe(1);
    expect(results.filter((r) => r.created)).toHaveLength(1);
    expect(f.receipts).toHaveLength(1);
    expect(f.diagrams).toHaveLength(2);
  });
  it('returns the existing diagram even after preview expiry/payload pruning/source deletion', async () => {
    const f = setup(),
      first = await f.service.commit(f.ownerId, f.previewId, f.input);
    f.preview.status = 'EXPIRED';
    f.preview.expiresAt = new Date(0);
    f.preview.convertedDocument = null;
    f.preview.documentHash = null;
    f.diagrams.shift();
    f.receipts[0].sourceWhiteboardId = null;
    jest.mocked(processPreviewImage).mockClear();
    expect(
      await f.service.commit(f.ownerId, f.previewId, f.input),
    ).toMatchObject({
      diagramId: first.diagramId,
      created: false,
      sourceWhiteboardId: null,
    });
    expect(processPreviewImage).not.toHaveBeenCalled();
  });
  it('never recreates a deleted output even if its preview is still ready', async () => {
    const f = setup();
    await f.service.commit(f.ownerId, f.previewId, f.input);
    f.diagrams.pop();
    f.receipts[0].diagramId = null;
    await rejectsCode(
      f.service.commit(f.ownerId, f.previewId, f.input),
      'diagram_deleted',
    );
    expect(f.tx.diagram.create).toHaveBeenCalledTimes(1);
  });
  it('does not trust another owner or a forged reviewed hash', async () => {
    const f = setup();
    await rejectsCode(
      f.service.commit(randomUUID(), f.previewId, f.input),
      'preview_not_found',
    );
    await rejectsCode(
      f.service.commit(f.ownerId, f.previewId, {
        ...f.input,
        documentHash: 'a'.repeat(64),
      }),
      'preview_hash_mismatch',
    );
    expect(f.tx.diagram.create).not.toHaveBeenCalled();
  });
  it.each(['PROCESSING', 'FAILED', 'UNRECOGNIZED', 'CANCELLED'])(
    'rejects status %s',
    async (status) => {
      const f = setup();
      f.preview.status = status;
      await rejectsCode(
        f.service.commit(f.ownerId, f.previewId, f.input),
        'preview_not_ready',
      );
      expect(f.tx.diagram.create).not.toHaveBeenCalled();
    },
  );
  it('rejects expired uncommitted attempts', async () => {
    const f = setup();
    f.preview.expiresAt = new Date(0);
    await rejectsCode(
      f.service.commit(f.ownerId, f.previewId, f.input),
      'preview_expired',
    );
  });
  it('requires acknowledgement for changed pixels, including a concurrent autosave', async () => {
    const f = setup();
    f.beforeLock(() => {
      f.source.data.image = 'newly saved pixels';
    });
    await rejectsCode(
      f.service.commit(f.ownerId, f.previewId, f.input),
      'preview_stale',
    );
    expect(f.diagrams).toHaveLength(1);
    const result = await f.service.commit(f.ownerId, f.previewId, {
      ...f.input,
      acknowledgeStale: true,
    });
    expect(result.created).toBe(true);
    expect(f.receipts[0].acknowledgedStale).toBe(true);
    expect(f.source.data.image).toBe('newly saved pixels');
    expect(f.diagrams[1].data).toEqual(f.document);
  });
  it('detects changes already saved before the request', async () => {
    const f = setup();
    f.preview.sourceSHA256 = 'c'.repeat(64);
    await rejectsCode(
      f.service.commit(f.ownerId, f.previewId, f.input),
      'preview_stale',
    );
  });
  it('does not treat title/thumbnail changes as stale pixels', async () => {
    const f = setup();
    f.beforeLock(() => {
      f.source.title = 'Renamed';
      f.source.updatedAt = new Date();
    });
    expect(
      (await f.service.commit(f.ownerId, f.previewId, f.input)).created,
    ).toBe(true);
    expect(f.diagrams[1].title).toBe('Renamed — Diagram');
  });
  it.each(['DELETING', 'PENDING'])(
    'cannot retain a snapshot already claimed by GC (%s)',
    async (status) => {
      const f = setup();
      f.snapshot.status = status;
      await rejectsCode(
        f.service.commit(f.ownerId, f.previewId, {
          ...f.input,
          acknowledgeStale: true,
        }),
        'snapshot_unavailable',
      );
      expect(f.diagrams).toHaveLength(1);
    },
  );
  it('cannot retain another owner’s snapshot or a mismatching source', async () => {
    const f = setup();
    f.snapshot.ownerId = randomUUID();
    await rejectsCode(
      f.service.commit(f.ownerId, f.previewId, f.input),
      'snapshot_unavailable',
    );
    f.snapshot.ownerId = f.ownerId;
    f.snapshot.width += 1;
    await rejectsCode(
      f.service.commit(f.ownerId, f.previewId, f.input),
      'snapshot_unavailable',
    );
  });
  it('rejects a deleted source even when stale is acknowledged', async () => {
    const f = setup();
    f.diagrams.shift();
    await rejectsCode(
      f.service.commit(f.ownerId, f.previewId, {
        ...f.input,
        acknowledgeStale: true,
      }),
      'source_unavailable',
    );
  });
  it('reuses the source group for a second distinct preview', async () => {
    const f = setup();
    await f.service.commit(f.ownerId, f.previewId, f.input);
    f.preview.id = randomUUID();
    await f.service.commit(f.ownerId, f.preview.id, f.input);
    expect(f.groups).toHaveLength(1);
    expect(f.receipts).toHaveLength(2);
  });
  it('retries after a cache failure without creating again or using new client title', async () => {
    const f = setup();
    f.cache.del.mockRejectedValueOnce(new Error('cache unavailable'));
    const first = await f.service.commit(f.ownerId, f.previewId, f.input);
    const next = await f.service.commit(f.ownerId, f.previewId, {
      ...f.input,
      title: 'Changed client title',
    });
    expect(next.diagramId).toBe(first.diagramId);
    expect(f.tx.diagram.create).toHaveBeenCalledTimes(1);
  });
  it('does not hold transaction locks while decoding and treats busy as retryable', async () => {
    const f = setup();
    jest
      .mocked(processPreviewImage)
      .mockRejectedValueOnce(new PreviewPipelineError('image_processing_busy'));
    await rejectsCode(
      f.service.commit(f.ownerId, f.previewId, f.input),
      'preview_commit_unavailable',
    );
    expect(f.prisma.$transaction).not.toHaveBeenCalled();
  });
  it('fails closed with the rollout flag disabled', async () => {
    const f = setup();
    delete process.env.WHITEBOARD_AI_COMMIT_ENABLED;
    await rejectsCode(
      f.service.commit(f.ownerId, f.previewId, f.input),
      'preview_commit_unavailable',
    );
    expect(f.prisma.$transaction).not.toHaveBeenCalled();
  });
  it('validates commit DTO without accepting missing/string acknowledgements or invalid hashes', async () => {
    expect(
      await validate(
        Object.assign(new CommitPreviewDto(), {
          documentHash: 'a'.repeat(64),
          acknowledgeStale: false,
        }),
      ),
    ).toHaveLength(0);
    for (const data of [
      { documentHash: 'bad', acknowledgeStale: false },
      { documentHash: 'a'.repeat(64) },
      { documentHash: 'a'.repeat(64), acknowledgeStale: 'false' },
    ])
      expect(
        (await validate(Object.assign(new CommitPreviewDto(), data))).length,
      ).toBeGreaterThan(0);
  });
});

describe('commit graph verification', () => {
  it('supports legacy graphs but never substitutes a newly converted graph', () => {
    const f = setup();
    expect(readCommitDocument(f.document, f.input.documentHash)).toEqual(
      f.document,
    );
    const changed = clone(f.document);
    changed.pages[0].nodes[0].data!.label = 'Tampered';
    expect(() => readCommitDocument(changed, f.input.documentHash)).toThrow();
  });
  it.each(['CustomImageNode', 'UnknownNode'])(
    'rejects unsupported/private asset nodes (%s)',
    (type) => {
      const f = setup(),
        changed = clone(f.document);
      changed.pages[0].nodes[0].type = type;
      expect(() =>
        readCommitDocument(changed, hashPreviewDocument(changed)),
      ).toThrow();
    },
  );
  it('rejects duplicate IDs and dangling connections', () => {
    const f = setup(),
      changed = clone(f.document);
    changed.pages[0].nodes.push(clone(changed.pages[0].nodes[0]));
    expect(() =>
      readCommitDocument(changed, hashPreviewDocument(changed)),
    ).toThrow();
    changed.pages[0].nodes.pop();
    changed.pages[0].edges.push({
      id: 'dangling',
      type: 'connection',
      source: 'exact-node',
      target: 'absent',
    });
    expect(() =>
      readCommitDocument(changed, hashPreviewDocument(changed)),
    ).toThrow();
  });
});
