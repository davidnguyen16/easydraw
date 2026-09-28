import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WhiteboardEngine } from './engine/engine';
import { useWhiteboard, warnBeforeWhiteboardUnload } from './whiteboard.store';

vi.mock('@/lib/thumbnails', () => ({
  encodeThumbnail: vi.fn(() => 'thumbnail'), shrinkCanvas: vi.fn((source) => source), uploadThumbnail: vi.fn(async () => true),
}));

function engine(image = 'first') {
  return { toDocument: vi.fn(() => ({ version: 1, image })), doc: {}, contentRevision: 1,
    width: 800, height: 600, previewBlockedReason: null } as unknown as WhiteboardEngine;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

beforeEach(() => { vi.useFakeTimers(); useWhiteboard.getState().attach(engine(), 'board-a', 'Board A'); });
afterEach(() => { useWhiteboard.getState().detach(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('confirmed whiteboard saves before creating a diagram', () => {
  it('joins an in-flight save and drains newer edits serially before flush resolves', async () => {
    const first = deferred<Response>(), second = deferred<Response>();
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    useWhiteboard.getState().markDirty();
    await vi.advanceTimersByTimeAsync(1500);
    const flush = useWhiteboard.getState().flush();
    let finished = false;
    void flush.then(() => { finished = true; });
    useWhiteboard.getState().setTitle('Latest name');
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(finished).toBe(false);
    first.resolve(new Response(null, { status: 200 }));
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({ title: 'Latest name' });
    expect(finished).toBe(false);
    second.resolve(new Response(null, { status: 200 }));
    expect(await flush).toBe(true);
    expect(useWhiteboard.getState().saveState).toBe('saved');
  });

  it('preserves failed title and drawing changes for explicit retry and returns false', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    useWhiteboard.getState().setTitle('Renamed source');
    useWhiteboard.getState().markDirty();
    expect(await useWhiteboard.getState().flush()).toBe(false);
    expect(useWhiteboard.getState().saveState).toBe('error');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await useWhiteboard.getState().flush()).toBe(true);
    expect(fetchMock.mock.calls.map(([, options]) => JSON.parse(String(options?.body))))
      .toEqual([{ title: 'Renamed source', data: { version: 1, image: 'first' } }, { title: 'Renamed source', data: { version: 1, image: 'first' } }]);
  });

  it.each([200, 500])('ignores a late old-document response (%i), including its pending fields', async (status) => {
    const old = deferred<Response>();
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockReturnValueOnce(old.promise).mockResolvedValueOnce(new Response(null, { status: 200 }));
    useWhiteboard.getState().setTitle('Old title');
    const flush = useWhiteboard.getState().flush();
    useWhiteboard.getState().detach();
    useWhiteboard.getState().attach(engine('new'), 'board-b', 'Board B');
    useWhiteboard.getState().setTitle('New title');
    old.resolve(new Response(null, { status }));
    expect(await flush).toBe(false);
    expect(useWhiteboard.getState().saveState).toBe('dirty');
    expect(await useWhiteboard.getState().flush()).toBe(true);
    expect(String(fetchMock.mock.calls[1][0])).toContain('/diagrams/board-b');
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({ title: 'New title' });
  });

  it('retains a newer title when an older pending rename fails', async () => {
    const first = deferred<Response>();
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockReturnValueOnce(first.promise).mockResolvedValueOnce(new Response(null, { status: 200 }));
    useWhiteboard.getState().setTitle('Old rename');
    const flush = useWhiteboard.getState().flush();
    useWhiteboard.getState().setTitle('New rename');
    first.resolve(new Response(null, { status: 500 }));
    expect(await flush).toBe(false);
    expect(await useWhiteboard.getState().flush()).toBe(true);
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({ title: 'New rename' });
  });

  it('returns false on encoding errors without discarding pending pixels', async () => {
    const active = engine();
    vi.mocked(active.toDocument).mockImplementationOnce(() => { throw new Error('Canvas export failed'); });
    useWhiteboard.getState().attach(active, 'board-a', 'A');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }));
    useWhiteboard.getState().markDirty();
    expect(await useWhiteboard.getState().flush()).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await useWhiteboard.getState().flush()).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('still saves a newer drawing when the editor is left while an older save is in flight (audit R7)', async () => {
    const first = deferred<Response>();
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    const active = engine('A');
    useWhiteboard.getState().attach(active, 'board-a', 'Board A');
    useWhiteboard.getState().markDirty();
    void useWhiteboard.getState().flush();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledOnce();

    // Edit B lands while A is still on the wire, then the route unmounts.
    vi.mocked(active.toDocument).mockReturnValue({ version: 1, image: 'B' } as never);
    useWhiteboard.getState().markDirty();
    const drained = useWhiteboard.getState().detach();
    first.resolve(new Response(null, { status: 200 }));

    expect(await drained).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toContain('/diagrams/board-a');
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({ data: { version: 1, image: 'B' } });
    // The cancelled debounce does not fire a stray save afterwards.
    await vi.advanceTimersByTimeAsync(5_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('asks before the tab closes with unsaved pixels, and not once they are saved', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }));
    const event = () => ({ preventDefault: vi.fn(), returnValue: undefined }) as unknown as BeforeUnloadEvent;

    useWhiteboard.getState().markDirty();
    const dirty = event();
    warnBeforeWhiteboardUnload(dirty);
    expect(dirty.preventDefault).toHaveBeenCalled();

    expect(await useWhiteboard.getState().flush()).toBe(true);
    const saved = event();
    warnBeforeWhiteboardUnload(saved);
    expect(saved.preventDefault).not.toHaveBeenCalled();
  });

  it('bounds a stalled save and retains unsaved data for a later explicit retry', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementationOnce((_url, options) => new Promise((_resolve, reject) => {
      options?.signal?.addEventListener('abort', () => reject(new DOMException('Timed out', 'AbortError')), { once: true });
    })).mockResolvedValueOnce(new Response(null, { status: 200 }));
    useWhiteboard.getState().markDirty();
    const flush = useWhiteboard.getState().flush();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(await flush).toBe(false);
    expect(useWhiteboard.getState().saveState).toBe('error');
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
    expect(await useWhiteboard.getState().flush()).toBe(true);
    expect(fetchMock.mock.calls.map(([, options]) => options?.body)[1]).toEqual(fetchMock.mock.calls[0][1]?.body);
  });
});
