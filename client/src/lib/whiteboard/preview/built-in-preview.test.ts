import { afterEach, describe, expect, it, vi } from 'vitest';
import { BUILT_IN_PREVIEW_MODEL, createBuiltInPreview } from './built-in-preview';
import { isPreviewHash, isPreviewIdentifier } from './preview-api';

const BOARD = '22222222-2222-4222-8222-222222222222';
const DIAGRAM = '33333333-3333-4333-8333-333333333333';
const request = () => ({ id: '11111111-1111-4111-8111-111111111111', whiteboardId: BOARD, hint: 'Sample prompt',
  source: { width: 800, height: 600, image: 'data:image/png;base64,AA==', revision: 4 } });
const definition = () => ({ id: 'sample', title: 'Sample diagram', category: 'Demo', openQuery: '?view=3d',
  document: () => ({ schemaVersion: 1, activePageId: 'page', pages: [{ id: 'page', name: 'Sample',
    nodes: [{ id: 'rack', type: 'CubeNode', position: { x: 0, y: 0 }, data: { label: 'Rack' } }], edges: [] }] }) });
const signal = () => new AbortController().signal;

afterEach(() => vi.unstubAllGlobals());

describe('built-in sample preview', () => {
  it('answers Generate locally with a reviewable copy of the shipped document', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const preview = createBuiltInPreview(definition());
    const result = await preview.generate(request(), 1_000, signal());
    expect(isPreviewIdentifier(result.id)).toBe(true);
    expect(isPreviewHash(result.documentHash)).toBe(true);
    expect(result).toMatchObject({ model: BUILT_IN_PREVIEW_MODEL, creationAvailable: true, refinementAvailable: false,
      createdAt: 1_000, hint: 'Sample prompt', warnings: [], source: request().source });
    expect(result.expiresAt).toBeGreaterThan(1_000);
    expect(result.document).toEqual(definition().document());
    expect(fetchSpy).not.toHaveBeenCalled();
    // Deterministic document, deterministic hash: a later result still matches.
    expect((await preview.generate(request(), 2_000, signal())).documentHash).toBe(result.documentHash);
  });

  it('keeps the loading state up for the thinking time, and stops waiting when cancelled', async () => {
    vi.useFakeTimers();
    try {
      const preview = createBuiltInPreview({ ...definition(), thinkMs: 2_000 });
      let settled = false;
      const pending = preview.generate(request(), 1_000, signal()).then((result) => { settled = true; return result; });
      await vi.advanceTimersByTimeAsync(1_999);
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect((await pending).model).toBe(BUILT_IN_PREVIEW_MODEL);

      const controller = new AbortController();
      const cancelled = expect(preview.generate(request(), 1_000, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
      await vi.advanceTimersByTimeAsync(500);
      controller.abort();
      await cancelled;
      expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
  });

  it('creates the reviewed document through the diagrams API and reports a receipt', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: DIAGRAM }), { status: 201 }));
    vi.stubGlobal('fetch', fetchSpy);
    const preview = createBuiltInPreview(definition());
    const result = await preview.generate(request(), 1_000, signal());
    const receipt = await preview.commit({ previewId: result.id, whiteboardId: BOARD, documentHash: result.documentHash! }, signal());
    expect(receipt).toEqual({ previewId: result.id, diagramId: DIAGRAM, visualDocumentId: null, sourceWhiteboardId: BOARD,
      documentHash: result.documentHash, created: true });
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit & { body: string }];
    expect(url).toMatch(/\/diagrams$/);
    expect(init).toMatchObject({ method: 'POST', credentials: 'include' });
    expect(JSON.parse(init.body)).toEqual({ title: 'Sample diagram', type: 'diagram', data: definition().document(), category: 'Demo' });
  });

  it('only creates from a reviewed hash and surfaces creation failures', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response('', { status: 500 }));
    vi.stubGlobal('fetch', fetchSpy);
    const preview = createBuiltInPreview(definition());
    await expect(preview.commit({ previewId: request().id, whiteboardId: BOARD, documentHash: 'f'.repeat(64) }, signal()))
      .rejects.toThrow(/no longer matches/);
    expect(fetchSpy).not.toHaveBeenCalled();
    const result = await preview.generate(request(), 1_000, signal());
    await expect(preview.commit({ previewId: result.id, whiteboardId: BOARD, documentHash: result.documentHash! }, signal()))
      .rejects.toThrow('Could not create the diagram');
  });

  it('rejects a shipped document that is not a paged diagram', async () => {
    const preview = createBuiltInPreview({ ...definition(), document: () => ({ nodes: [], edges: [] }) });
    await expect(preview.generate(request(), 1_000, signal())).rejects.toThrow('built-in sample result is unavailable');
  });
});
