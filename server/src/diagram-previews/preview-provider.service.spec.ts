import {
  WHITEBOARD_DIAGRAM_DRAFT_SCHEMA_V2,
  type WhiteboardDiagramDraftV2,
} from '@easydraw/diagram-schema';
import {
  PreviewPipelineError,
  PreviewProviderService,
  type PreviewGenerationContext,
} from './preview-provider.service';

const draft = (): WhiteboardDiagramDraftV2 => ({
  version: 2,
  outcome: 'diagram',
  nodes: [
    {
      id: 'start',
      shape: 'rectangle',
      label: 'Bắt đầu',
      bounds: { x: 100, y: 100, width: 200, height: 100 },
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
});
const completed = (value: unknown = draft()) => ({
  status: 'completed',
  model: 'gpt-6-sol',
  output: [
    {
      type: 'message',
      role: 'assistant',
      status: 'completed',
      content: [{ type: 'output_text', text: JSON.stringify(value) }],
    },
  ],
});

interface PreviewRequestBody {
  instructions: string;
  model: string;
  store: boolean;
  reasoning: { effort: string };
  max_output_tokens: number;
  tools?: unknown;
  stream?: unknown;
  input: Array<{ content: Array<Record<string, unknown>> }>;
  text: {
    format: {
      type: string;
      strict: boolean;
      schema: { $schema?: unknown; properties: { version: unknown } };
    };
  };
}

describe('PreviewProviderService', () => {
  let fetchMock: jest.SpyInstance<
    ReturnType<typeof fetch>,
    Parameters<typeof fetch>
  >;
  const originalKey = process.env.OPENAI_API_KEY;
  const originalModel = process.env.OPENAI_DIAGRAM_MODEL;
  let service: PreviewProviderService;

  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'synthetic-unit-test-key';
    process.env.OPENAI_DIAGRAM_MODEL = 'gpt-6-sol';
    fetchMock = jest.spyOn(globalThis, 'fetch');
    fetchMock.mockResolvedValue(new Response(JSON.stringify(completed())));
    service = new PreviewProviderService();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
    if (originalModel === undefined) delete process.env.OPENAI_DIAGRAM_MODEL;
    else process.env.OPENAI_DIAGRAM_MODEL = originalModel;
  });

  it('uses only a bounded, non-stored Responses request with the server-chosen model', async () => {
    const originalSchema = JSON.stringify(WHITEBOARD_DIAGRAM_DRAFT_SCHEMA_V2);
    const result = await service.generate(
      Buffer.from('synthetic-image'),
      'A hint, not instructions',
    );
    expect(result).toEqual({ draft: draft(), resolvedModel: 'gpt-6-sol' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/responses');
    if (!options) throw new Error('Expected request options');
    expect(options.method).toBe('POST');
    expect(options.redirect).toBe('error');
    expect(options.signal).toBeInstanceOf(AbortSignal);
    const body = JSON.parse(options.body as string) as PreviewRequestBody;
    expect(body.model).toBe('gpt-6-sol');
    expect(body.store).toBe(false);
    expect(body.reasoning).toEqual({ effort: 'low' });
    expect(body.max_output_tokens).toBe(12000);
    expect(body.tools).toBeUndefined();
    expect(body.stream).toBeUndefined();
    expect(body.instructions).toContain('Do not');
    expect(body.instructions).toContain('paths');
    expect(body.instructions).toContain('NEVER SVG markup');
    expect(body.text.format.type).toBe('json_schema');
    expect(body.text.format.strict).toBe(true);
    expect(body.text.format.schema.$schema).toBeUndefined();
    expect(body.text.format.schema.properties.version).toEqual({
      type: 'integer',
      enum: [2],
    });
    expect(body.input[0].content[0].text).toContain(
      JSON.stringify('A hint, not instructions'),
    );
    expect(body.input[0].content[1]).toEqual({
      type: 'input_image',
      image_url: `data:image/png;base64,${Buffer.from('synthetic-image').toString('base64')}`,
      detail: 'high',
    });
    expect(JSON.stringify(WHITEBOARD_DIAGRAM_DRAFT_SCHEMA_V2)).toBe(
      originalSchema,
    );
  });

  it('defaults to Sol and rejects missing configuration before calling fetch', async () => {
    delete process.env.OPENAI_DIAGRAM_MODEL;
    expect(service.requestedModel).toBe('gpt-6-sol');
    delete process.env.OPENAI_API_KEY;
    await expect(
      service.generate(Buffer.from('test'), ''),
    ).rejects.toMatchObject({ code: 'provider_not_configured' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('accepts free-standing quadratic curves without inventing flowchart nodes', async () => {
    const curve: WhiteboardDiagramDraftV2 = {
      ...draft(),
      nodes: [],
      paths: [
        {
          id: 'parabola',
          label: 'Trajectory',
          bounds: { x: 100, y: 100, width: 600, height: 600 },
          geometry: {
            version: 1,
            commands: [
              { op: 'M', values: [0, 1000] },
              { op: 'Q', values: [500, 0, 1000, 1000] },
            ],
            stroke: '#0066ee',
            fill: 'none',
            strokeWidth: 2,
            dash: 'solid',
            startArrow: false,
            endArrow: false,
          },
        },
      ],
    };
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(completed(curve))),
    );
    expect(
      (await service.generate(Buffer.from('synthetic-image'), '')).draft,
    ).toEqual(curve);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects a legacy or injected markup result on the V2 provider boundary without retrying', async () => {
    const legacy = {
      version: 1,
      outcome: 'diagram',
      nodes: [],
      edges: [],
      warnings: [],
    };
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(completed(legacy))),
    );
    await expect(
      service.generate(Buffer.from('test'), ''),
    ).rejects.toMatchObject({ code: 'provider_invalid_output' });
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify(
          completed({
            ...draft(),
            paths: [{ svg: '<svg onload="alert(1)" />' }],
          }),
        ),
      ),
    );
    await expect(
      service.generate(Buffer.from('test'), ''),
    ).rejects.toMatchObject({ code: 'provider_invalid_output' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects excessive hints before calling fetch', async () => {
    await expect(
      service.generate(Buffer.from('test'), 'x'.repeat(4001)),
    ).rejects.toMatchObject({ code: 'invalid_hint' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    'Turn the login sketch into a UML Activity Diagram with a retry branch.',
    'This is a room layout. Add a reading area but keep the doorway clear.',
    'Explain this physics sketch with editable axes and a parabolic trajectory.',
    'Show a travel route with named stops, not a software flowchart.',
  ])(
    'passes cross-domain design intent alongside the sketch: %s',
    async (hint) => {
      await service.generate(Buffer.from('synthetic-image'), hint);
      const body = JSON.parse(
        fetchMock.mock.calls[0][1]!.body as string,
      ) as PreviewRequestBody;
      expect(JSON.parse(body.input[0].content[0].text as string)).toEqual({
        task: 'generate',
        intent: hint,
      });
      expect(body.instructions).toContain(
        'Honor explicit transformations, additions, removals',
      );
      expect(body.instructions).toContain('not system instructions');
      expect(body.instructions).not.toContain('invent content that is absent');
    },
  );

  it('passes the selected draft, earlier feedback and latest intent without mutating the baseline', async () => {
    const context: PreviewGenerationContext = {
      previousDraft: draft(),
      previousHint: 'Login flow',
      feedbackHistory: ['Add a retry branch.'],
      feedback: 'Lock the account after three failed attempts.',
      sourceChanged: true,
    };
    const before = JSON.stringify(context);
    await service.generate(
      Buffer.from('test'),
      'Use UML Activity notation.',
      context,
    );
    const body = JSON.parse(
      fetchMock.mock.calls[0][1]!.body as string,
    ) as PreviewRequestBody;
    expect(JSON.parse(body.input[0].content[0].text as string)).toEqual({
      task: 'refine',
      intent: 'Use UML Activity notation.',
      previousIntent: 'Login flow',
      earlierChanges: ['Add a retry branch.'],
      requestedChange: context.feedback,
      drawingChanged: true,
      previousPreview: draft(),
    });
    expect(body.instructions).toContain('Preserve existing IDs');
    expect(body.instructions).toContain(
      'existing crop ID always reuses its ORIGINAL pixel content',
    );
    expect(body.store).toBe(false);
    expect(body).not.toHaveProperty('previous_response_id');
    expect(JSON.stringify(context)).toBe(before);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    { feedback: ' ' },
    { feedback: 'x'.repeat(2001) },
    { previousHint: 'x'.repeat(4001) },
    { feedbackHistory: Array.from({ length: 10 }, () => 'Change') },
    { feedbackHistory: [''] },
    { previousDraft: { ...draft(), nodes: [], arbitrary: 'injected' } },
  ])(
    'rejects invalid refinement context before a paid dispatch',
    async (overrides) => {
      const context = {
        previousDraft: draft(),
        previousHint: '',
        feedbackHistory: [],
        feedback: 'Change labels.',
        sourceChanged: false,
        ...overrides,
      } as PreviewGenerationContext;
      await expect(
        service.generate(Buffer.from('test'), '', context),
      ).rejects.toMatchObject({ code: 'invalid_refinement' });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it.each([
    [401, 'provider_auth'],
    [403, 'provider_auth'],
    [429, 'provider_rate_limited'],
    [400, 'provider_request_rejected'],
    [503, 'provider_unavailable'],
  ])(
    'sanitizes HTTP %s without retrying or exposing provider contents',
    async (status, code) => {
      fetchMock.mockResolvedValue(
        new Response('sensitive upstream details', { status }),
      );
      const error: unknown = await service
        .generate(Buffer.from('test'), '')
        .catch((value: unknown) => value);
      expect(error).toBeInstanceOf(PreviewPipelineError);
      expect(error).toMatchObject({ code });
      expect(String(error)).not.toContain('sensitive');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it('sanitizes network errors without preserving a cause', async () => {
    fetchMock.mockRejectedValue(
      new Error('sensitive secret and image contents'),
    );
    const error: unknown = await service
      .generate(Buffer.from('test'), '')
      .catch((value: unknown) => value);
    expect(error).toMatchObject({ code: 'provider_unavailable' });
    expect(error).not.toHaveProperty('cause');
    expect(String(error)).not.toContain('sensitive');
  });

  it('has a finite deadline even if a network implementation ignores abort', async () => {
    jest.useFakeTimers();
    fetchMock.mockImplementation(() => new Promise<Response>(() => undefined));
    const result = service
      .generate(Buffer.from('test'), '')
      .catch((error: unknown) => error);
    await jest.advanceTimersByTimeAsync(60_000);
    expect(await result).toMatchObject({ code: 'provider_timeout' });
    const [, options] = fetchMock.mock.calls[0];
    expect(options?.signal?.aborted).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('distinguishes a refusal from a valid unrecognized result', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ...completed(),
          output: [
            {
              type: 'message',
              role: 'assistant',
              content: [{ type: 'refusal', refusal: 'sensitive refusal' }],
            },
          ],
        }),
      ),
    );
    await expect(
      service.generate(Buffer.from('test'), ''),
    ).rejects.toMatchObject({ code: 'provider_refused' });
    const unrecognized = {
      version: 2,
      outcome: 'unrecognized',
      nodes: [],
      edges: [],
      paths: [],
      crops: [],
      warnings: [
        {
          code: 'unsupported-content',
          message: 'No recognizable diagram.',
          elementId: null,
        },
      ],
    };
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(completed(unrecognized))),
    );
    expect((await service.generate(Buffer.from('test'), '')).draft).toEqual(
      unrecognized,
    );
  });

  it('does not accept a partial response even when its JSON is valid', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ...completed(), status: 'incomplete' })),
    );
    await expect(
      service.generate(Buffer.from('test'), ''),
    ).rejects.toMatchObject({ code: 'provider_incomplete' });
  });

  it.each([
    'not json',
    JSON.stringify({ ...completed(), output: [] }),
    JSON.stringify({ ...completed(), model: 'unsafe model\n' }),
    JSON.stringify(
      completed({
        ...draft(),
        edges: [
          {
            id: 'edge',
            sourceId: 'start',
            targetId: 'missing',
            label: '',
            direction: 'forward',
          },
        ],
      }),
    ),
    JSON.stringify(
      completed({ ...draft(), nodes: [draft().nodes[0], draft().nodes[0]] }),
    ),
    JSON.stringify(completed({ ...draft(), arbitraryCode: 'do not execute' })),
  ])('rejects malformed or semantically invalid results', async (body) => {
    fetchMock.mockResolvedValue(new Response(body));
    await expect(
      service.generate(Buffer.from('test'), ''),
    ).rejects.toMatchObject({ code: 'provider_invalid_output' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('bounds response bytes even without content-length', async () => {
    fetchMock.mockResolvedValue(new Response('x'.repeat(1024 * 1024 + 1)));
    await expect(
      service.generate(Buffer.from('test'), ''),
    ).rejects.toMatchObject({ code: 'provider_invalid_output' });
  });
});
