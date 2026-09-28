import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cancelPreview, generatePreview, parsePreviewResponse, PreviewApiError, recoverPreview,
  type PreviewRequest, type PreviewResponse,
} from './preview-api';

const request = (): PreviewRequest => ({
  id: 'request-1', whiteboardId: 'board-1', hint: 'A login flow',
  source: { width: 800, height: 600, image: 'data:image/png;base64,AA==', revision: 3 },
});
const response = (overrides: Partial<PreviewResponse> = {}): PreviewResponse => ({
  id: 'preview-1', clientRequestId: 'request-1', clientRevision: 3, status: 'ready',
  document: { schemaVersion: 1, activePageId: 'page-1', pages: [{ id: 'page-1', name: 'Preview',
    nodes: [{ id: 'node-1', type: 'RectangleNode', position: { x: 0, y: 0 }, data: { label: 'Start' } }], edges: [] }] },
  documentHash: 'a'.repeat(64), warnings: [], errorCode: null,
  createdAt: '2026-09-25T00:00:00.000Z', expiresAt: '2026-09-26T00:00:00.000Z',
  source: { width: 800, height: 600 }, model: 'gpt-6-sol', refinementAvailable: true, ...overrides,
});
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json' },
});
const stalledBody = () => {
  const cancel = vi.fn();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) { controller.enqueue(new TextEncoder().encode('{"id":')); },
    cancel,
  });
  return { cancel, response: new Response(stream, { headers: { 'Content-Type': 'application/json' } }) };
};

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('real preview transport (mocked network)', () => {
  it('sends one frozen PNG request with session credentials and uses only the server document', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(response()));
    const input = request();
    const promise = generatePreview(input, new AbortController().signal);
    input.source.revision = 55;
    input.source.image = 'changed';
    input.hint = 'changed';
    const result = await promise;
    expect(result.source.revision).toBe(3);
    expect(result.source.image).toBe('data:image/png;base64,AA==');
    expect(result.hint).toBe('A login flow');
    expect(result.document).toEqual(response().document);
    expect(result.documentHash).toBe('a'.repeat(64));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain('/diagrams/board-1/previews');
    expect(options).toMatchObject({ method: 'POST', credentials: 'include', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' } });
    expect(JSON.parse(String(options?.body))).toEqual({ clientRequestId: 'request-1', clientRevision: 3,
      width: 800, height: 600, image: 'data:image/png;base64,AA==', hint: 'A login flow' });
  });

  it('recovers a lost POST response with GET only, including a briefly absent durable request', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new TypeError('Network lost'))
      .mockResolvedValueOnce(json({ message: 'Not found' }, 404))
      .mockResolvedValueOnce(json(response({ status: 'processing', document: null, documentHash: null })))
      .mockResolvedValueOnce(json(response()));
    const promise = generatePreview(request(), new AbortController().signal);
    await vi.advanceTimersByTimeAsync(3000);
    expect((await promise).id).toBe('preview-1');
    expect(fetchMock.mock.calls.map(([, options]) => options?.method)).toEqual(['POST', 'GET', 'GET', 'GET']);
    expect(fetchMock.mock.calls.slice(1).every(([url]) => String(url).endsWith('/previews/requests/request-1'))).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('sends frozen refinement instructions and only a server-owned base ID, retaining the inputs after GET recovery', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new TypeError('Lost response'))
      .mockResolvedValueOnce(json(response()));
    const input = { ...request(), basePreviewId: 'base-preview', feedback: 'Add the failed-payment branch; keep everything else.' };
    const promise = generatePreview(input, new AbortController().signal);
    input.basePreviewId = 'different-preview';
    input.feedback = 'New unsent feedback';
    const result = await promise;
    expect(result).toMatchObject({ basePreviewId: 'base-preview', feedback: 'Add the failed-payment branch; keep everything else.' });
    const payload = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(payload).toMatchObject({ hint: 'A login flow', basePreviewId: 'base-preview', feedback: result.feedback });
    expect(payload).not.toHaveProperty('document');
    expect(payload).not.toHaveProperty('history');
    expect(fetchMock.mock.calls.map(([, options]) => options?.method)).toEqual(['POST', 'GET']);
  });

  it.each([
    ['invalid_refinement', 'Choose a valid preview'],
    ['refinement_unavailable', 'can no longer be refined'],
    ['refinement_limit', 'refinement limit'],
  ])('shows safe actionable %s errors without automatically retrying', async (code, message) => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(json({ code, message: 'Private provider detail' }, 409));
    await expect(generatePreview({ ...request(), basePreviewId: 'base-preview', feedback: 'Fix the connection.' }, new AbortController().signal)).rejects.toThrow(message);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('polls a processing result without running generation again', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json(response({ status: 'processing', document: null, documentHash: null })))
      .mockResolvedValueOnce(json(response()));
    const result = await generatePreview(request(), new AbortController().signal);
    expect(result.document).not.toBeNull();
    expect(fetchMock.mock.calls.map(([, options]) => options?.method)).toEqual(['POST', 'GET']);
  });

  it('recovers a POST timeout by looking up the same request without resubmitting its image', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementationOnce((_url, options) => new Promise((_resolve, reject) => {
      options?.signal?.addEventListener('abort', () => reject(new DOMException('Timed out', 'AbortError')), { once: true });
    })).mockResolvedValueOnce(json(response()));
    const promise = generatePreview(request(), new AbortController().signal);
    await vi.advanceTimersByTimeAsync(75_000);
    expect((await promise).id).toBe('preview-1');
    expect(fetchMock.mock.calls.map(([, options]) => options?.method)).toEqual(['POST', 'GET']);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps the POST deadline active after headers when the response body stalls', async () => {
    vi.useFakeTimers();
    const stalled = stalledBody();
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(stalled.response).mockResolvedValueOnce(json(response()));
    const promise = generatePreview(request(), new AbortController().signal);
    await vi.advanceTimersByTimeAsync(74_999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(stalled.cancel).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect((await promise).id).toBe('preview-1');
    expect(stalled.cancel).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls.map(([, options]) => options?.method)).toEqual(['POST', 'GET']);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cancels a stalled POST body immediately without starting recovery or another POST', async () => {
    vi.useFakeTimers();
    const stalled = stalledBody();
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(stalled.response);
    const controller = new AbortController();
    const promise = generatePreview(request(), controller.signal);
    const check = expect(promise).rejects.toMatchObject({ name: 'AbortError' });
    await vi.advanceTimersByTimeAsync(0);
    controller.abort();
    await check;
    expect(stalled.cancel).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('bounds stalled lookup bodies and continues only with read-only recovery', async () => {
    vi.useFakeTimers();
    const stalled = stalledBody();
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(stalled.response).mockResolvedValueOnce(json(response()));
    const promise = recoverPreview(request(), new AbortController().signal);
    await vi.advanceTimersByTimeAsync(11_500);
    expect((await promise).id).toBe('preview-1');
    expect(stalled.cancel).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls.map(([, options]) => options?.method)).toEqual(['GET', 'GET']);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('looks up an uncertain server failure without displaying its raw message', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(json({
      code: 'preview_unavailable', message: 'Sensitive internal server details',
    }, 503)).mockResolvedValueOnce(json(response()));
    expect((await generatePreview(request(), new AbortController().signal)).id).toBe('preview-1');
    expect(fetchMock.mock.calls.map(([, options]) => options?.method)).toEqual(['POST', 'GET']);
  });

  it('distinguishes a valid unrecognized drawing from provider failures', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(json(response({
      status: 'unrecognized', document: null, documentHash: null,
      warnings: [{ code: 'unsupported-content', message: 'No clear objects were found.', elementId: null }],
    }))).mockResolvedValueOnce(json(response({ status: 'failed', document: null, documentHash: null, errorCode: 'provider_refused' })));
    const result = await generatePreview(request(), new AbortController().signal);
    expect(result.document).toBeNull();
    expect(result.warnings).toHaveLength(1);
    await expect(generatePreview(request(), new AbortController().signal)).rejects.toMatchObject({ code: 'provider_refused' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not leak server/provider error bodies and never retries known configuration or quota errors', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(json({
      code: 'provider_not_configured', message: 'Private server details should not reach UI',
    }, 503)).mockResolvedValueOnce(json({ code: 'preview_daily_limit' }, 429));
    await expect(generatePreview(request(), new AbortController().signal)).rejects.toThrow('AI preview is not configured');
    await expect(generatePreview(request(), new AbortController().signal)).rejects.toThrow('daily preview limit');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('bounds recovery and leaves an unknown outcome for explicit check/cancel, not another POST', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => json(response({ status: 'processing', document: null, documentHash: null })));
    const promise = recoverPreview(request(), new AbortController().signal);
    const check = expect(promise).rejects.toMatchObject({ code: 'RECOVERY_REQUIRED' });
    await vi.advanceTimersByTimeAsync(90_000);
    await check;
    expect(fetchMock.mock.calls.every(([, options]) => options?.method === 'GET')).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('aborts polling without accepting late output; cancellation uses the known request ID', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(json(response({ status: 'processing', document: null, documentHash: null })));
    const controller = new AbortController();
    const promise = recoverPreview(request(), controller.signal);
    const check = expect(promise).rejects.toMatchObject({ name: 'AbortError' });
    await vi.advanceTimersByTimeAsync(0);
    controller.abort();
    await check;
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await cancelPreview(request());
    expect(fetchMock.mock.calls.map(([, options]) => options?.method)).toEqual(['GET', 'DELETE']);
    expect(fetchMock.mock.calls[1][0]).toContain('/diagrams/board-1/previews/requests/request-1');
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([204, 205])('accepts cancellation HTTP %s when the browser exposes an empty body stream', async (status) => {
    const body = new ReadableStream<Uint8Array>({ start(controller) { controller.close(); } });
    // Node's Response constructor forces body=null for these statuses, whereas
    // browser fetch can expose an empty ReadableStream. Model that boundary.
    const noContent = { status, ok: true, body } as Response;
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(noContent);
    await expect(cancelPreview(request())).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[0][1]?.method).toBe('DELETE');
  });

  it('does not require JSON for successful cancellation but still handles error JSON safely', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('Cancelled', { status: 200 }))
      .mockResolvedValueOnce(json({ code: 'preview_not_enabled', message: 'Internal details' }, 503));
    await expect(cancelPreview(request())).resolves.toBeUndefined();
    await expect(cancelPreview(request())).rejects.toMatchObject({ code: 'preview_not_enabled', status: 503 });
  });

  it('does not mistake an empty successful generation response for a valid preview', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(generatePreview(request(), new AbortController().signal)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects another request or revision even if the graph itself is valid', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json(response({ clientRequestId: 'other' })))
      .mockResolvedValueOnce(json(response({ clientRevision: 9 })));
    await expect(generatePreview(request(), new AbortController().signal)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    await expect(generatePreview(request(), new AbortController().signal)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('resolves a pre-reservation cancellation tombstone even though it has no image metadata', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(json(response({ status: 'cancelled', clientRevision: null,
      source: { width: 0, height: 0 }, document: null, documentHash: null })));
    await expect(recoverPreview(request(), new AbortController().signal)).rejects.toMatchObject({ code: 'CANCELLED' });
  });

  it('rejects malformed, over-limit and falsely successful payloads', () => {
    expect(() => parsePreviewResponse({})).toThrow(PreviewApiError);
    expect(() => parsePreviewResponse(response({ documentHash: null }))).toThrow(PreviewApiError);
    expect(() => parsePreviewResponse(response({ status: 'unrecognized' }))).toThrow(PreviewApiError);
    expect(() => parsePreviewResponse(response({ expiresAt: 'not-a-date' }))).toThrow(PreviewApiError);
    expect(() => parsePreviewResponse({ ...response(), refinementAvailable: 'true' })).toThrow(PreviewApiError);
    const large = response();
    large.document!.pages[0].nodes = Array.from({ length: 51 }, (_, index) => ({ id: `node-${index}` }));
    expect(() => parsePreviewResponse(large)).toThrow(PreviewApiError);
  });

  it('keeps old server previews readable but never assumes they support paid refinement', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(json(response({ refinementAvailable: undefined })));
    const result = await generatePreview(request(), new AbortController().signal);
    expect(result.document).not.toBeNull();
    expect(result.refinementAvailable).toBe(false);
  });

  it('accepts bounded mixed shape, vector and source-image previews', () => {
    const mixed = response();
    const shape = mixed.document!.pages[0].nodes[0];
    const vector = { id: 'vector-1', type: 'VectorPathNode', position: { x: 0, y: 0 }, data: {
      label: 'Arrow', vector: { version: 1, commands: [{ op: 'M', values: [0, 500] }, { op: 'L', values: [1000, 500] }],
        stroke: '#123456', fill: 'none', strokeWidth: 2, dash: 'solid', startArrow: false, endArrow: true },
    } };
    const crop = { id: 'crop-1', type: 'SourceImageNode', position: { x: 0, y: 0 }, data: {
      label: 'Source detail', image: { version: 1, width: 1, height: 1, reason: 'Preserved sketch detail',
        dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6LVsAAAAASUVORK5CYII=' },
    } };
    mixed.document!.pages[0].nodes = [
      ...Array.from({ length: 50 }, (_, index) => ({ ...shape, id: `shape-${index}` })),
      ...Array.from({ length: 64 }, (_, index) => ({ ...vector, id: `vector-${index}` })),
      ...Array.from({ length: 4 }, (_, index) => ({ ...crop, id: `crop-${index}` })),
    ];
    expect(parsePreviewResponse(mixed).document!.pages[0].nodes).toHaveLength(118);
    for (const extra of [shape, vector, crop]) {
      const over = structuredClone(mixed);
      over.document!.pages[0].nodes.push({ ...extra, id: 'one-too-many' });
      expect(() => parsePreviewResponse(over)).toThrow(PreviewApiError);
    }
    const invalid = response();
    invalid.document!.pages[0].nodes = [{ ...vector, data: { ...vector.data, vector: { ...vector.data.vector,
      commands: [{ op: 'M', values: [-1, 500] }] } } }];
    expect(() => parsePreviewResponse(invalid)).toThrow(PreviewApiError);
    invalid.document!.pages[0].nodes = [{ ...crop, data: { ...crop.data, image: { ...crop.data.image, dataUrl: 'https://example.invalid/a.png' } } }];
    expect(() => parsePreviewResponse(invalid)).toThrow(PreviewApiError);
  });

  it('keeps the transport cap at 1 MiB even for vector and crop responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('x'.repeat(1024 * 1024 + 1)));
    await expect(generatePreview(request(), new AbortController().signal)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('limits the combined vector command budget, not just each individual object', () => {
    const result = response();
    const geometry = { version: 1, commands: [
      { op: 'M', values: [0, 0] }, ...Array.from({ length: 63 }, (_, index) => ({ op: 'L', values: [index * 10, 500] })),
    ], stroke: '#123456', fill: 'none', strokeWidth: 2, dash: 'solid', startArrow: false, endArrow: false };
    result.document!.pages[0].nodes = Array.from({ length: 8 }, (_, index) => ({
      id: `vector-${index}`, type: 'VectorPathNode', position: { x: 0, y: 0 }, data: { vector: geometry },
    }));
    expect(parsePreviewResponse(result).document!.pages[0].nodes).toHaveLength(8);
    result.document!.pages[0].nodes.push({ id: 'vector-overflow', type: 'VectorPathNode',
      position: { x: 0, y: 0 }, data: { vector: geometry } });
    expect(() => parsePreviewResponse(result)).toThrow(PreviewApiError);
  });
});
