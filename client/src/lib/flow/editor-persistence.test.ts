import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Rendering/export helpers need a DOM; saving never reaches them here.
vi.mock('@/lib/exporters', () => ({ getExporter: vi.fn() }));
vi.mock('@/lib/exporters/canvas-capture', () => ({ captureThumbnailCanvas: vi.fn() }));
vi.mock('@/lib/thumbnails', () => ({
  encodeThumbnail: vi.fn(), uploadThumbnail: vi.fn(async () => true), THUMBNAIL_MAX_WIDTH: 320, THUMBNAIL_MAX_HEIGHT: 200,
}));

import { useEditorDoc } from '@/lib/stores/editor-doc.store';
import {
  createMetaSignature,
  getSavedMetaSignature,
  handleCreatePage,
  handleDeleteAllPages,
  handleDeletePage,
  handleDuplicatePage,
  handleNewFile,
  hydrateCanvasFromStore,
  loadFileContent,
  startDiagramPersistence,
  stopDiagramPersistence,
} from './editor-persistence';

const DIAGRAM = 'diagram-under-test';

function savedPages(fetchMock: ReturnType<typeof vi.spyOn>) {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
  expect(url).toContain(`/diagrams/${DIAGRAM}`);
  expect(init.method).toBe('PATCH');
  return (JSON.parse(String(init.body)) as { data: { pages: { name: string }[] } }).data.pages.map((page) => page.name);
}

describe('diagram page operations autosave (audit R8)', () => {
  let fetchMock: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }));
    useEditorDoc.getState().resetEditorState();
    startDiagramPersistence(DIAGRAM);
    hydrateCanvasFromStore();
  });

  afterEach(() => {
    stopDiagramPersistence(DIAGRAM);
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('saves a page added with no other edit, and only then calls it saved', async () => {
    handleCreatePage();

    expect(useEditorDoc.getState().pages).toHaveLength(2);
    // Hydrating the new page must not pretend the server already has it.
    expect(getSavedMetaSignature()).not.toBe(createMetaSignature());

    await vi.advanceTimersByTimeAsync(1_000);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(savedPages(fetchMock)).toEqual(['Page 1', 'Page 2']);
    expect(getSavedMetaSignature()).toBe(createMetaSignature());
  });

  it('keeps the page unsaved when the save fails', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 503 }));
    handleCreatePage();
    await vi.advanceTimersByTimeAsync(1_000);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(getSavedMetaSignature()).not.toBe(createMetaSignature());
  });

  it.each([
    ['duplicating', () => handleDuplicatePage(useEditorDoc.getState().pages[0]!.id), 3],
    ['deleting the active page', () => handleDeletePage(useEditorDoc.getState().activePageId), 1],
    ['deleting another page', () => handleDeletePage(useEditorDoc.getState().pages[0]!.id), 1],
  ])('saves after %s', async (_, operation, pageCount) => {
    handleCreatePage();
    await vi.advanceTimersByTimeAsync(1_000);
    fetchMock.mockClear();

    operation();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(savedPages(fetchMock)).toEqual(useEditorDoc.getState().pages.map((page) => page.name));
    expect(useEditorDoc.getState().pages).toHaveLength(pageCount);
  });

  it('saves after deleting every page', async () => {
    handleCreatePage();
    await vi.advanceTimersByTimeAsync(1_000);
    fetchMock.mockClear();

    handleDeleteAllPages();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(savedPages(fetchMock)).toHaveLength(1);
  });

  it('saves a file opened into the diagram', async () => {
    const opened = {
      schemaVersion: 1, activePageId: 'imported', fileName: 'Imported', status: 'draft',
      pages: [{ id: 'imported', name: 'Imported page', nodes: [], edges: [] }],
    };
    expect(loadFileContent(JSON.stringify(opened))).toBe(true);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(savedPages(fetchMock)).toEqual(['Imported page']);
  });

  it('does not overwrite the stored diagram just because File › New was chosen', async () => {
    vi.stubGlobal('window', { confirm: () => true });
    handleNewFile();
    vi.unstubAllGlobals();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
