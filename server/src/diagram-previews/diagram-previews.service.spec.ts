import {
  DiagramPreviewsService,
  PREVIEW_LEASE_MS,
  previewRequestFingerprint,
} from './diagram-previews.service';
import {
  PreviewPipelineError,
  PreviewProviderService,
} from './preview-provider.service';
import { processPreviewImage } from './preview-image';
import { createHash, randomUUID } from 'node:crypto';
import { validate } from 'class-validator';
import { CreatePreviewDto } from './create-preview.dto';
import type { WhiteboardDiagramDraftV2 } from '@easydraw/diagram-schema';
import {
  readStoredPreview,
  type StoredPreviewEnvelope,
} from './preview-refinement';
import type { PrismaService } from '../prisma/prisma.service';
import type { S3AssetsService } from '../node-library/s3-assets.service';

jest.mock('./preview-image', () => ({
  INPUT_PIPELINE_VERSION: 'test-image-v1',
  processPreviewImage: jest.fn(),
}));

const image = {
  source: Buffer.from('source'),
  modelInput: Buffer.from('model'),
  sourceSHA256: 'a'.repeat(64),
  modelInputSHA256: 'b'.repeat(64),
  width: 800,
  height: 600,
  byteSize: 6,
  modelInputWidth: 800,
  modelInputHeight: 600,
};
const draft: WhiteboardDiagramDraftV2 = {
  version: 2,
  outcome: 'diagram',
  nodes: [
    {
      id: 'nodeA',
      shape: 'rectangle',
      label: 'Hello',
      bounds: { x: 100, y: 100, width: 200, height: 150 },
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
const defer = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

type FakeRow = Record<string, unknown> & { id: string };
type FakeWhere = Record<string, unknown>;
type FindArguments = { where: FakeWhere };
type CreateArguments = { data: Record<string, unknown> };
type UpdateArguments = FindArguments & CreateArguments;
type ProviderResult = Awaited<ReturnType<PreviewProviderService['generate']>>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    !(value instanceof Date)
  );
}

function comparable(value: unknown): number | null {
  if (value instanceof Date) return value.getTime();
  return typeof value === 'number' ? value : null;
}

/** Small transactional fake, only for service sequencing. Actual SQL constraints
 * are exercised separately by test-diagram-preview-database.mjs. */
function setup() {
  const ownerId = randomUUID(),
    sourceId = randomUUID();
  const input = {
    clientRequestId: randomUUID(),
    width: 800,
    height: 600,
    image: 'data:image/png;base64,aA==',
    clientRevision: 3,
    hint: 'test',
  };
  const rows: FakeRow[] = [],
    snapshots: FakeRow[] = [],
    events: string[] = [];
  let sourcePresent = true;
  const sourceData = Object.freeze({ drawing: 'unchanged' });
  const matches = (row: FakeRow, where: FakeWhere): boolean =>
    Object.entries(where).every(([key, expected]) => {
      if (key === 'OR')
        return (
          Array.isArray(expected) &&
          expected.some((part: unknown) => isRecord(part) && matches(row, part))
        );
      if (key === 'ownerId_clientRequestId')
        return isRecord(expected) && matches(row, expected);
      if (key === 'sourceWhiteboard')
        return (
          sourcePresent &&
          isRecord(expected) &&
          row.ownerId === expected.ownerId
        );
      const actual = row[key];
      if (isRecord(expected)) {
        if (Array.isArray(expected.in) && !expected.in.includes(actual))
          return false;
        const value = comparable(actual);
        for (const operator of ['gte', 'gt', 'lte'] as const) {
          if (!(operator in expected)) continue;
          const bound = comparable(expected[operator]);
          if (value === null || bound === null) return false;
          if (operator === 'gte' && !(value >= bound)) return false;
          if (operator === 'gt' && !(value > bound)) return false;
          if (operator === 'lte' && !(value <= bound)) return false;
        }
        return true;
      }
      return actual === expected;
    });
  const tx = {
    $queryRaw: jest.fn(() => Promise.resolve([{ id: ownerId }])),
    diagramConversion: {
      findFirst: jest.fn((): Promise<{ id: string } | null> =>
        Promise.resolve(null),
      ),
    },
    user: { findUnique: jest.fn(() => Promise.resolve({ id: ownerId })) },
    diagram: {
      findFirst: jest.fn(({ where }: FindArguments) =>
        Promise.resolve(
          sourcePresent && where.ownerId === ownerId && where.id === sourceId
            ? { id: sourceId, data: sourceData }
            : null,
        ),
      ),
    },
    diagramPreview: {
      count: jest.fn(({ where }: FindArguments) =>
        Promise.resolve(rows.filter((row) => matches(row, where)).length),
      ),
      findUnique: jest.fn(({ where }: FindArguments) =>
        Promise.resolve(rows.find((row) => matches(row, where)) ?? null),
      ),
      findFirst: jest.fn(({ where }: FindArguments) =>
        Promise.resolve(rows.find((row) => matches(row, where)) ?? null),
      ),
      create: jest.fn(({ data }: CreateArguments) => {
        const row: FakeRow = {
          id: randomUUID(),
          createdAt: new Date(),
          status: 'PROCESSING',
          sourceSnapshotId: null,
          dispatchedAt: null,
          clientRevision: null,
          sourceWidth: null,
          sourceHeight: null,
          errorCode: null,
          requestFingerprint: null,
          convertedDocument: null,
          documentHash: null,
          warnings: null,
          ...data,
        };
        rows.push(row);
        events.push('reserve');
        return Promise.resolve({ ...row });
      }),
      update: jest.fn(({ where, data }: UpdateArguments) => {
        const row = rows.find((r) => matches(r, where));
        if (!row) return Promise.reject(new Error('Missing fake preview row'));
        Object.assign(row, data);
        return Promise.resolve({ ...row });
      }),
      updateMany: jest.fn(({ where, data }: UpdateArguments) => {
        const found = rows.filter((r) => matches(r, where));
        found.forEach((r) => Object.assign(r, data));
        return Promise.resolve({ count: found.length });
      }),
    },
    previewSourceSnapshot: {
      create: jest.fn(({ data }: CreateArguments) => {
        const row: FakeRow = {
          ...data,
          id: typeof data.id === 'string' ? data.id : randomUUID(),
        };
        snapshots.push(row);
        events.push('journal');
        return Promise.resolve(row);
      }),
      update: jest.fn(({ where, data }: UpdateArguments) => {
        const row = snapshots.find((s) => s.id === where.id);
        if (!row) return Promise.reject(new Error('Missing fake snapshot row'));
        Object.assign(row, data);
        return Promise.resolve(row);
      }),
    },
  };
  let tail = Promise.resolve();
  const prisma = {
    ...tx,
    $transaction: <T>(
      operation: (client: typeof tx) => Promise<T>,
    ): Promise<T> => {
      const run = tail.then(() => operation(tx));
      tail = run.then(
        () => undefined,
        () => undefined,
      );
      return run;
    },
  };
  const storage = {
    requireConfiguration: jest.fn(),
    putImage: jest.fn(() => {
      events.push('put');
      return Promise.resolve();
    }),
    signRead: jest.fn(),
  };
  const provider = {
    requestedModel: 'gpt-6-sol',
    requireConfiguration: jest.fn(),
    generate: jest.fn((): Promise<ProviderResult> => {
      events.push('dispatch');
      return Promise.resolve({ draft, resolvedModel: 'gpt-6-sol' });
    }),
  };
  // This deliberately small fake covers only methods exercised here. Keep
  // the test double's typed API intact and adapt only at the DI boundary.
  const service = new DiagramPreviewsService(
    prisma as unknown as PrismaService,
    storage as unknown as S3AssetsService,
    provider,
  );
  return {
    service,
    input,
    ownerId,
    sourceId,
    rows,
    snapshots,
    events,
    tx,
    storage,
    provider,
    sourceData,
    removeSource: () => {
      sourcePresent = false;
      rows.forEach((row) => {
        row.sourceWhiteboardId = null;
      });
    },
  };
}

describe('durable preview orchestration', () => {
  const oldEnabled = process.env.WHITEBOARD_AI_PREVIEW_ENABLED;
  beforeEach(() => {
    process.env.WHITEBOARD_AI_PREVIEW_ENABLED = 'true';
    jest.mocked(processPreviewImage).mockReset().mockResolvedValue(image);
  });
  afterAll(() => {
    if (oldEnabled === undefined)
      delete process.env.WHITEBOARD_AI_PREVIEW_ENABLED;
    else process.env.WHITEBOARD_AI_PREVIEW_ENABLED = oldEnabled;
  });

  it('journals both S3 keys before PUT, persists exact document/hash, never writes the source', async () => {
    const s = setup();
    const result = await s.service.generate(s.ownerId, s.sourceId, s.input);
    expect(result.status).toBe('ready');
    expect(result.refinementAvailable).toBe(true);
    expect(result.documentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.document).toEqual(
      readStoredPreview(s.rows[0].convertedDocument).document,
    );
    expect(result.document).not.toHaveProperty('context');
    expect(result.document).not.toHaveProperty('kind');
    expect(s.events).toEqual(['reserve', 'journal', 'put', 'put', 'dispatch']);
    expect(s.sourceData).toEqual({ drawing: 'unchanged' });
    expect(s.tx.diagram).not.toHaveProperty('update');
  });
  it('replays the same request without another provider/storage call', async () => {
    const s = setup();
    const first = await s.service.generate(s.ownerId, s.sourceId, s.input);
    expect(await s.service.generate(s.ownerId, s.sourceId, s.input)).toEqual(
      first,
    );
    expect(s.provider.generate).toHaveBeenCalledTimes(1);
    expect(s.storage.putImage).toHaveBeenCalledTimes(2);
  });

  it('cannot cancel an approved preview, even while creation is disabled', async () => {
    const s = setup();
    await s.service.generate(s.ownerId, s.sourceId, s.input);
    s.tx.diagramConversion.findFirst.mockResolvedValue({ id: randomUUID() });
    const old = process.env.WHITEBOARD_AI_COMMIT_ENABLED;
    process.env.WHITEBOARD_AI_COMMIT_ENABLED = 'false';
    try {
      await expect(
        s.service.cancelRequest(s.ownerId, s.sourceId, s.input.clientRequestId),
      ).rejects.toMatchObject({
        status: 409,
        response: { code: 'preview_already_committed' },
      });
      expect(s.rows[0].status).toBe('READY');
    } finally {
      if (old === undefined) delete process.env.WHITEBOARD_AI_COMMIT_ENABLED;
      else process.env.WHITEBOARD_AI_COMMIT_ENABLED = old;
    }
  });

  it('advertises refinement only for current, eligible server-owned context', async () => {
    const s = setup();
    const first = await s.service.generate(s.ownerId, s.sourceId, s.input);
    const envelope = s.rows[0].convertedDocument as StoredPreviewEnvelope;
    envelope.context.feedbackHistory = Array.from(
      { length: 10 },
      () => 'Keep the labels.',
    );
    expect((await s.service.get(s.ownerId, first.id)).refinementAvailable).toBe(
      false,
    );
    s.rows[0].convertedDocument = first.document;
    const legacy = await s.service.get(s.ownerId, first.id);
    expect(legacy.document).toEqual(first.document);
    expect(legacy.refinementAvailable).toBe(false);
    await s.service.cancelRequest(
      s.ownerId,
      s.sourceId,
      s.input.clientRequestId,
    );
    expect((await s.service.get(s.ownerId, first.id)).refinementAvailable).toBe(
      false,
    );
  });
  it('rejects a reused ID with a changed hint', async () => {
    const s = setup();
    await s.service.generate(s.ownerId, s.sourceId, s.input);
    await expect(
      s.service.generate(s.ownerId, s.sourceId, {
        ...s.input,
        hint: 'different',
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(s.provider.generate).toHaveBeenCalledTimes(1);
  });
  it('authorizes ownership and source kind before decoding, storage or AI', async () => {
    const s = setup();
    s.tx.diagram.findFirst.mockResolvedValue(null);
    await expect(
      s.service.generate(s.ownerId, s.sourceId, s.input),
    ).rejects.toMatchObject({ status: 404 });
    expect(processPreviewImage).not.toHaveBeenCalled();
    expect(s.provider.generate).not.toHaveBeenCalled();
  });
  it('makes a cancellation that beats POST durable', async () => {
    const s = setup();
    await s.service.cancelRequest(
      s.ownerId,
      s.sourceId,
      s.input.clientRequestId,
    );
    expect(
      (await s.service.generate(s.ownerId, s.sourceId, s.input)).status,
    ).toBe('cancelled');
    expect(processPreviewImage).not.toHaveBeenCalled();
    expect(s.provider.generate).not.toHaveBeenCalled();
  });
  it('cancellation during dispatch prevents publication and keeps account busy until worker finishes', async () => {
    const s = setup(),
      started = defer<void>(),
      finish = defer<ProviderResult>();
    s.provider.generate.mockImplementation(() => {
      started.resolve();
      return finish.promise;
    });
    const pending = s.service.generate(s.ownerId, s.sourceId, s.input);
    await started.promise;
    await s.service.cancelRequest(
      s.ownerId,
      s.sourceId,
      s.input.clientRequestId,
    );
    await expect(
      s.service.generate(s.ownerId, s.sourceId, {
        ...s.input,
        clientRequestId: randomUUID(),
      }),
    ).rejects.toMatchObject({ status: 409 });
    finish.resolve({ draft, resolvedModel: 'gpt-6-sol' });
    expect((await pending).status).toBe('cancelled');
    expect(s.rows[0].documentHash).toBeNull();
    expect(s.provider.generate).toHaveBeenCalledTimes(1);
  });
  it('concurrent identical requests share one reservation and dispatch', async () => {
    const s = setup();
    const results = await Promise.all([
      s.service.generate(s.ownerId, s.sourceId, s.input),
      s.service.generate(s.ownerId, s.sourceId, s.input),
    ]);
    expect(new Set(results.map((r) => r.id)).size).toBe(1);
    expect(s.provider.generate).toHaveBeenCalledTimes(1);
  });
  it('does not publish after the source is deleted during dispatch', async () => {
    const s = setup();
    s.provider.generate.mockImplementation(() => {
      s.removeSource();
      return Promise.resolve({ draft, resolvedModel: 'gpt-6-sol' });
    });
    expect(
      (await s.service.generate(s.ownerId, s.sourceId, s.input)).status,
    ).toBe('cancelled');
    expect(s.rows[0].documentHash).toBeNull();
  });
  it('records safe provider failures and never silently retries', async () => {
    const s = setup();
    s.provider.generate.mockRejectedValue(
      new PreviewPipelineError('provider_timeout'),
    );
    const result = await s.service.generate(s.ownerId, s.sourceId, s.input);
    expect(result).toMatchObject({
      status: 'failed',
      errorCode: 'provider_timeout',
      document: null,
    });
    await s.service.generate(s.ownerId, s.sourceId, s.input);
    expect(s.provider.generate).toHaveBeenCalledTimes(1);
    expect(s.rows[0].dispatchedAt).toBeInstanceOf(Date);
  });
  it('S3 failure retains cleanup journal and never dispatches AI', async () => {
    const s = setup();
    s.storage.putImage.mockRejectedValue(new Error('secret-bucket/raw-key'));
    const result = await s.service.generate(s.ownerId, s.sourceId, s.input);
    expect(result.errorCode).toBe('preview_storage_unavailable');
    expect(JSON.stringify(result)).not.toContain('secret-bucket');
    expect(s.snapshots[0].unpublishedKeys).toHaveLength(2);
    expect(s.provider.generate).not.toHaveBeenCalled();
  });
  it('old unfinished attempts fail on recovery without another dispatch', async () => {
    const s = setup();
    await s.service.generate(s.ownerId, s.sourceId, s.input);
    s.rows[0].status = 'PROCESSING';
    s.rows[0].leaseUntil = new Date(Date.now() - PREVIEW_LEASE_MS);
    expect(await s.service.get(s.ownerId, s.rows[0].id)).toMatchObject({
      status: 'failed',
      errorCode: 'generation_interrupted',
    });
    expect(s.provider.generate).toHaveBeenCalledTimes(1);
  });
  it('expires ready previews and does not expose their document', async () => {
    const s = setup();
    await s.service.generate(s.ownerId, s.sourceId, s.input);
    s.rows[0].expiresAt = new Date(0);
    expect(await s.service.get(s.ownerId, s.rows[0].id)).toMatchObject({
      status: 'expired',
      document: null,
      documentHash: null,
    });
  });
  it('enforces daily dispatched quota before image processing', async () => {
    const s = setup();
    s.tx.diagramPreview.count.mockImplementation(({ where }: FindArguments) =>
      Promise.resolve(where.dispatchedAt ? 20 : 0),
    );
    await expect(
      s.service.generate(s.ownerId, s.sourceId, s.input),
    ).rejects.toMatchObject({ status: 429 });
    expect(processPreviewImage).not.toHaveBeenCalled();
    expect(s.provider.generate).not.toHaveBeenCalled();
  });

  it('preserves legacy request fingerprints and binds refinement target and feedback', () => {
    const s = setup();
    const expected = createHash('sha256')
      .update(
        JSON.stringify([
          s.sourceId,
          s.input.width,
          s.input.height,
          s.input.image,
          s.input.clientRevision,
          s.input.hint,
        ]),
      )
      .digest('hex');
    expect(previewRequestFingerprint(s.sourceId, s.input)).toBe(expected);
    const refinement = {
      ...s.input,
      basePreviewId: randomUUID(),
      feedback: 'Add an error branch',
    };
    const identity = previewRequestFingerprint(s.sourceId, refinement);
    expect(identity).not.toBe(expected);
    expect(
      previewRequestFingerprint(s.sourceId, {
        ...refinement,
        feedback: 'Remove the error branch',
      }),
    ).not.toBe(identity);
    expect(
      previewRequestFingerprint(s.sourceId, {
        ...refinement,
        basePreviewId: randomUUID(),
      }),
    ).not.toBe(identity);
  });

  it('refines server-owned state with intent and cumulative feedback, without mutating its parent', async () => {
    const s = setup();
    const first = await s.service.generate(s.ownerId, s.sourceId, s.input);
    const parent = structuredClone(s.rows[0]);
    const input = {
      ...s.input,
      clientRequestId: randomUUID(),
      hint: 'Architecture plan',
      basePreviewId: first.id,
      feedback: 'Add a cache next to the API.',
    };
    const second = await s.service.generate(s.ownerId, s.sourceId, input);
    expect(second.status).toBe('ready');
    expect(s.provider.generate).toHaveBeenLastCalledWith(
      image.modelInput,
      input.hint,
      {
        previousDraft: draft,
        previousHint: s.input.hint,
        feedbackHistory: [],
        feedback: input.feedback,
        sourceChanged: false,
      },
    );
    const secondStored = readStoredPreview(s.rows[1].convertedDocument);
    expect(secondStored.context).toMatchObject({
      hint: input.hint,
      feedbackHistory: [input.feedback],
      basePreviewId: first.id,
    });
    expect(s.rows[0]).toEqual(parent);
    expect(JSON.stringify(second)).not.toContain('Architecture plan');
    expect(JSON.stringify(second)).not.toContain('Add a cache');

    const thirdFeedback = 'Rename the API to Orders API.';
    await s.service.generate(s.ownerId, s.sourceId, {
      ...input,
      clientRequestId: randomUUID(),
      basePreviewId: second.id,
      feedback: thirdFeedback,
    });
    expect(
      readStoredPreview(s.rows[2].convertedDocument).context?.feedbackHistory,
    ).toEqual([input.feedback, thirdFeedback]);
  });

  it.each([
    { feedback: 'A change with no base' },
    { basePreviewId: randomUUID() },
    { basePreviewId: randomUUID(), feedback: '   ' },
  ])(
    'rejects an invalid refinement pair before processing: %j',
    async (fields) => {
      const s = setup();
      await expect(
        s.service.generate(s.ownerId, s.sourceId, { ...s.input, ...fields }),
      ).rejects.toMatchObject({ status: 400 });
      expect(processPreviewImage).not.toHaveBeenCalled();
      expect(s.storage.putImage).not.toHaveBeenCalled();
      expect(s.provider.generate).not.toHaveBeenCalled();
      expect(s.rows).toHaveLength(0);
    },
  );

  it.each([
    { field: 'hint', code: 'invalid_hint', text: '\u{1F600}'.repeat(2001) },
    {
      field: 'feedback',
      code: 'invalid_refinement',
      text: '\u{1F600}'.repeat(1001),
    },
  ])(
    'rejects UTF-16-over-limit $field before any transaction or external work',
    async ({ field, code, text }) => {
      const s = setup();
      const input = Object.assign(new CreatePreviewDto(), {
        ...s.input,
        ...(field === 'feedback' ? { basePreviewId: randomUUID() } : {}),
        [field]: text,
      });
      // class-validator accepts these code-point counts. The service must still
      // enforce the UI/provider code-unit boundary without burning quota/storage.
      expect(await validate(input)).toEqual([]);
      await expect(
        s.service.generate(s.ownerId, s.sourceId, input),
      ).rejects.toMatchObject({ status: 400, response: { code } });
      expect(s.tx.$queryRaw).not.toHaveBeenCalled();
      expect(s.tx.diagram.findFirst).not.toHaveBeenCalled();
      expect(processPreviewImage).not.toHaveBeenCalled();
      expect(s.storage.putImage).not.toHaveBeenCalled();
      expect(s.provider.generate).not.toHaveBeenCalled();
      expect(s.rows).toHaveLength(0);
    },
  );

  it.each([
    { fields: { hint: 12 }, code: 'invalid_hint' },
    { fields: { hint: {} }, code: 'invalid_hint' },
    {
      fields: { basePreviewId: randomUUID(), feedback: {} },
      code: 'invalid_refinement',
    },
    {
      fields: { basePreviewId: 12, feedback: 'Change' },
      code: 'invalid_refinement',
    },
    {
      fields: { basePreviewId: '', feedback: 'Change' },
      code: 'invalid_refinement',
    },
    {
      fields: { basePreviewId: randomUUID(), feedback: null },
      code: 'invalid_refinement',
    },
    {
      fields: { basePreviewId: null, feedback: 'Change' },
      code: 'invalid_refinement',
    },
  ])(
    'rejects malformed direct-service input without leaking it',
    async ({ fields, code }) => {
      const s = setup();
      const input = { ...s.input, ...fields } as unknown as CreatePreviewDto;
      await expect(
        s.service.generate(s.ownerId, s.sourceId, input),
      ).rejects.toMatchObject({ status: 400, response: { code } });
      expect(s.tx.$queryRaw).not.toHaveBeenCalled();
      expect(s.provider.generate).not.toHaveBeenCalled();
      expect(s.storage.putImage).not.toHaveBeenCalled();
    },
  );

  it('treats null optional fields as absent consistently with DTO validation', async () => {
    const s = setup();
    const input = Object.assign(new CreatePreviewDto(), {
      ...s.input,
      hint: null,
      basePreviewId: null,
      feedback: null,
    });
    expect(await validate(input)).toEqual([]);
    expect(
      (await s.service.generate(s.ownerId, s.sourceId, input)).status,
    ).toBe('ready');
    expect(s.provider.generate).toHaveBeenCalledWith(
      image.modelInput,
      '',
      undefined,
    );
    expect(
      readStoredPreview(s.rows[0].convertedDocument).context,
    ).toMatchObject({ hint: '', feedbackHistory: [] });
  });

  it.each([
    'wrong-owner',
    'wrong-whiteboard',
    'expired',
    'cancelled',
    'legacy',
    'hash-mismatch',
  ])(
    'rejects %s base previews before a second reservation or paid request',
    async (kind) => {
      const s = setup();
      const first = await s.service.generate(s.ownerId, s.sourceId, s.input);
      if (kind === 'wrong-owner') s.rows[0].ownerId = randomUUID();
      if (kind === 'wrong-whiteboard')
        s.rows[0].sourceWhiteboardId = randomUUID();
      if (kind === 'expired') s.rows[0].expiresAt = new Date(0);
      if (kind === 'cancelled') s.rows[0].status = 'CANCELLED';
      if (kind === 'legacy') s.rows[0].convertedDocument = first.document;
      if (kind === 'hash-mismatch') s.rows[0].documentHash = '0'.repeat(64);
      jest.mocked(processPreviewImage).mockClear();
      await expect(
        s.service.generate(s.ownerId, s.sourceId, {
          ...s.input,
          clientRequestId: randomUUID(),
          basePreviewId: first.id,
          feedback: 'Add a database.',
        }),
      ).rejects.toMatchObject({ status: 409 });
      expect(s.rows).toHaveLength(1);
      expect(processPreviewImage).not.toHaveBeenCalled();
      expect(s.provider.generate).toHaveBeenCalledTimes(1);
      expect(s.storage.putImage).toHaveBeenCalledTimes(2);
    },
  );

  it('replays an existing refinement after its base expires, without requiring its parent or dispatching again', async () => {
    const s = setup();
    const base = await s.service.generate(s.ownerId, s.sourceId, s.input);
    const input = {
      ...s.input,
      clientRequestId: randomUUID(),
      basePreviewId: base.id,
      feedback: 'Use a diamond.',
    };
    const result = await s.service.generate(s.ownerId, s.sourceId, input);
    s.rows[0].expiresAt = new Date(0);
    expect(await s.service.generate(s.ownerId, s.sourceId, input)).toEqual(
      result,
    );
    expect(
      await s.service.findRequest(s.ownerId, s.sourceId, input.clientRequestId),
    ).toEqual(result);
    expect(s.provider.generate).toHaveBeenCalledTimes(2);
    await expect(
      s.service.generate(s.ownerId, s.sourceId, {
        ...input,
        feedback: 'Different feedback',
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(s.provider.generate).toHaveBeenCalledTimes(2);
  });

  it('rejects history beyond ten refinements rather than silently dropping instructions', async () => {
    const s = setup();
    const base = await s.service.generate(s.ownerId, s.sourceId, s.input);
    const envelope = s.rows[0].convertedDocument as StoredPreviewEnvelope;
    envelope.context.feedbackHistory = Array.from(
      { length: 10 },
      (_, index) => `Change ${index + 1}`,
    );
    await expect(
      s.service.generate(s.ownerId, s.sourceId, {
        ...s.input,
        clientRequestId: randomUUID(),
        basePreviewId: base.id,
        feedback: 'One more change',
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(s.provider.generate).toHaveBeenCalledTimes(1);
    expect(s.rows).toHaveLength(1);
  });

  it('flags changed source pixels or dimensions to the provider', async () => {
    const s = setup();
    const base = await s.service.generate(s.ownerId, s.sourceId, s.input);
    jest
      .mocked(processPreviewImage)
      .mockResolvedValue({ ...image, sourceSHA256: 'c'.repeat(64) });
    await s.service.generate(s.ownerId, s.sourceId, {
      ...s.input,
      clientRequestId: randomUUID(),
      basePreviewId: base.id,
      feedback: 'Include the new box.',
    });
    expect(s.provider.generate).toHaveBeenLastCalledWith(
      image.modelInput,
      s.input.hint,
      expect.objectContaining({ sourceChanged: true }),
    );
  });

  it('a cancelled refinement cannot publish, and leaves the base intact', async () => {
    const s = setup();
    const base = await s.service.generate(s.ownerId, s.sourceId, s.input);
    const parent = structuredClone(s.rows[0]);
    const started = defer<void>(),
      finish = defer<ProviderResult>();
    s.provider.generate.mockImplementation(() => {
      started.resolve();
      return finish.promise;
    });
    const input = {
      ...s.input,
      clientRequestId: randomUUID(),
      basePreviewId: base.id,
      feedback: 'Add a note.',
    };
    const pending = s.service.generate(s.ownerId, s.sourceId, input);
    await started.promise;
    await s.service.cancelRequest(s.ownerId, s.sourceId, input.clientRequestId);
    finish.resolve({ draft, resolvedModel: 'gpt-6-sol' });
    expect((await pending).status).toBe('cancelled');
    expect(s.rows[0]).toEqual(parent);
    expect(s.rows[1].documentHash).toBeNull();
  });
});
