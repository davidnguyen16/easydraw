import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkCreationAvailability, commitPreview, generatePreview, parseCommitReceipt, parsePreviewResponse, type PreviewCommitReceipt, type PreviewCommitTarget, type PreviewResponse } from './preview-api';
import { initialPreviewState, previewReducer } from './preview-state';

const PREVIEW = '11111111-1111-4111-8111-111111111111';
const BOARD = '22222222-2222-4222-8222-222222222222';
const DIAGRAM = '33333333-3333-4333-8333-333333333333';
const HASH = 'a'.repeat(64);
const target = (): PreviewCommitTarget => ({ previewId: PREVIEW, whiteboardId: BOARD, documentHash: HASH });
const receipt = (): PreviewCommitReceipt => ({ previewId: PREVIEW, sourceWhiteboardId: BOARD, diagramId: DIAGRAM, visualDocumentId: null, documentHash: HASH, created: true });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const response = (): PreviewResponse => ({ id: PREVIEW, clientRequestId: 'request', clientRevision: 1, status: 'ready',
  document: { schemaVersion: 1, activePageId: 'page', pages: [{ id: 'page', name: 'Preview', nodes: [], edges: [] }] },
  documentHash: HASH, warnings: [], errorCode: null, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString(),
  source: { width: 800, height: 600 }, model: 'test-model', creationAvailable: true });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('preview commit transport (mocked network only)', () => {
  it('sends exactly the frozen reviewed hash/ack and uses validated IDs for its receipt', async () => {
    const mock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(receipt()));
    const input = target();
    const pending = commitPreview(input, true, new AbortController().signal);
    input.documentHash = 'b'.repeat(64);
    expect(await pending).toEqual(receipt());
    expect(mock).toHaveBeenCalledOnce();
    expect(mock.mock.calls[0][0]).toContain(`/diagram-previews/${PREVIEW}/commit`);
    const options = mock.mock.calls[0][1];
    expect(options).toMatchObject({ method: 'POST', credentials: 'include', cache: 'no-store' });
    expect(JSON.parse(String(options?.body))).toEqual({ documentHash: HASH, acknowledgeStale: true });
  });

  it.each([
    { previewId: DIAGRAM }, { diagramId: 'javascript:alert(1)' }, { visualDocumentId: 'bad' },
    { sourceWhiteboardId: DIAGRAM }, { documentHash: 'b'.repeat(64) }, { created: 'yes' },
  ])('rejects malformed/unrelated receipt %j without trusting navigation data', (invalid) => {
    expect(() => parseCommitReceipt({ ...receipt(), ...invalid }, target())).toThrow('could not be confirmed');
  });

  it('accepts a prior receipt even after its source/group was independently unlinked', () => {
    expect(parseCommitReceipt({ ...receipt(), sourceWhiteboardId: null, visualDocumentId: null, created: false }, target())).toMatchObject({ created: false, sourceWhiteboardId: null });
  });

  it('keeps a lost receipt uncertain; a manual same-target retry never generates AI', async () => {
    const mock = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Private network diagnostic'))
      .mockResolvedValueOnce(json({ ...receipt(), created: false }));
    await expect(commitPreview(target(), false, new AbortController().signal)).rejects.toMatchObject({ code: 'COMMIT_UNCONFIRMED' });
    expect(mock).toHaveBeenCalledOnce();
    expect(await commitPreview(target(), false, new AbortController().signal)).toMatchObject({ diagramId: DIAGRAM, created: false });
    expect(mock.mock.calls.every(([url]) => String(url).endsWith(`/diagram-previews/${PREVIEW}/commit`))).toBe(true);
    expect(mock.mock.calls.map(([, options]) => options?.body)).toEqual(Array(2).fill(JSON.stringify({ documentHash: HASH, acknowledgeStale: false })));
  });

  it.each(['preview_expired', 'preview_not_ready', 'preview_hash_mismatch', 'preview_stale', 'source_unavailable', 'snapshot_unavailable', 'diagram_deleted', 'preview_commit_unavailable', 'preview_not_found'])('keeps actionable %s errors safe and never retries automatically', async (code) => {
    const mock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ code, message: 'Private internal diagnostic' }, 409));
    const error = await commitPreview(target(), false, new AbortController().signal).catch((error: unknown) => error);
    expect(error).toMatchObject({ code });
    expect(String(error)).not.toContain('Private');
    expect(mock).toHaveBeenCalledOnce();
  });

  it('bounds a stalled receipt body and cancels its reader without an automatic retry', async () => {
    vi.useFakeTimers();
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new TextEncoder().encode('{')); }, cancel });
    const mock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(body));
    const pending = expect(commitPreview(target(), false, new AbortController().signal)).rejects.toMatchObject({ code: 'COMMIT_UNCONFIRMED' });
    await vi.advanceTimersByTimeAsync(30_000);
    await pending;
    expect(cancel).toHaveBeenCalledOnce();
    expect(mock).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rejects invalid targets before POST', async () => {
    const mock = vi.spyOn(globalThis, 'fetch');
    await expect(commitPreview({ ...target(), previewId: '../other' }, false, new AbortController().signal)).rejects.toMatchObject({ code: 'invalid_commit' });
    expect(mock).not.toHaveBeenCalled();
  });
});

describe('backward-compatible capability checks', () => {
  it('defaults absent creation capability to false and rejects a nonboolean capability', async () => {
    const body = response(); delete body.creationAvailable;
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(body));
    const result = await generatePreview({ id: 'request', whiteboardId: BOARD, hint: 'Idea', source: { width: 800, height: 600, revision: 1, image: 'data:image/png;base64,AA==' } }, new AbortController().signal);
    expect(result.creationAvailable).toBe(false);
    expect(() => parsePreviewResponse({ ...body, creationAvailable: 'true' })).toThrow();
  });

  it('checks only the exact existing preview and leaves the reviewed document/hint/source unchanged', async () => {
    const body = response();
    const mock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(body));
    const viewed = { id: PREVIEW, documentHash: HASH, document: body.document, hint: 'Original idea', source: { width: 800, height: 600, revision: 1, image: 'data:image/png;base64,AA==' }, createdAt: Date.now(), expiresAt: Date.now() + 60_000, warnings: [], model: 'test-model' };
    const state = { ...initialPreviewState, status: 'ready' as const, result: viewed };
    const available = await checkCreationAvailability(viewed, new AbortController().signal);
    const next = previewReducer(state, { type: 'creation-availability', id: PREVIEW, documentHash: HASH, available });
    expect(next.result).toEqual({ ...viewed, creationAvailable: true });
    expect(next.result?.document).toBe(viewed.document);
    expect(next.result?.source).toBe(viewed.source);
    expect(mock).toHaveBeenCalledOnce();
    expect(mock.mock.calls[0][0]).toContain(`/diagram-previews/${PREVIEW}`);
    expect(mock.mock.calls[0][1]?.method).toBe('GET');
    expect(previewReducer(state, { type: 'creation-availability', id: DIAGRAM, documentHash: HASH, available: true })).toBe(state);
    expect(previewReducer(state, { type: 'creation-availability', id: PREVIEW, documentHash: 'b'.repeat(64), available: true })).toBe(state);
  });

  it.each([{ id: DIAGRAM }, { documentHash: 'b'.repeat(64) }])('never unlocks a different reviewed version %j', async (mismatch) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ ...response(), ...mismatch }));
    await expect(checkCreationAvailability({ id: PREVIEW, documentHash: HASH }, new AbortController().signal)).rejects.toMatchObject({ code: 'preview_hash_mismatch' });
  });

  it('reports expiry before comparing a pruned expired document/hash', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ ...response(), status: 'expired', document: null, documentHash: null }));
    await expect(checkCreationAvailability({ id: PREVIEW, documentHash: HASH }, new AbortController().signal)).rejects.toMatchObject({ code: 'preview_expired' });
  });
});
