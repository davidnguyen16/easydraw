import { afterEach, describe, expect, it, vi } from 'vitest';
import fixture from '@easydraw/diagram-schema/fixtures/flowchart.json';
import unrecognized from '@easydraw/diagram-schema/fixtures/unrecognized.json';
import { generateMockPreview, mockDraftToDocument, type MockPreviewRequest, type MockPreviewResult } from './mock-preview';
import { initialPreviewState, previewReducer } from './preview-state';

const request = (id = 'first'): MockPreviewRequest => ({
  id, source: { width: 1280, height: 800, image: 'data:image/png;base64,AA==', revision: 5 }, hint: 'Login', sample: 'flowchart',
});
async function mockResult(id = 'first'): Promise<MockPreviewResult> {
  const promise = generateMockPreview(request(id), new AbortController().signal);
  await vi.advanceTimersByTimeAsync(650);
  return promise;
}
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('offline whiteboard preview', () => {
  it('adapts fixtures deterministically without changing input or creating a stored document', () => {
    const before = JSON.stringify(fixture);
    const source = { width: 1280, height: 800 };
    const document = mockDraftToDocument(fixture, source)!;
    expect(document).toEqual(mockDraftToDocument(fixture, source));
    expect(document.pages[0].nodes).toHaveLength(5);
    expect(document.pages[0].edges).toHaveLength(5);
    expect(document.pages[0].nodes[0].data?.label).toBe('Bắt đầu');
    document.pages[0].nodes[0].data!.label = 'Changed locally';
    expect(JSON.stringify(fixture)).toBe(before);
    expect(mockDraftToDocument(unrecognized, source)).toBeNull();
    expect(() => mockDraftToDocument({ ...fixture, version: 2 }, source)).toThrow();
    expect(() => mockDraftToDocument(fixture, { width: Infinity, height: 800 })).toThrow();
  });

  it('caps diagram dimensions and maps each edge direction without dropping relationships', () => {
    const draft = structuredClone(fixture);
    draft.edges[0].direction = 'none'; draft.edges[1].direction = 'both';
    const page = mockDraftToDocument(draft, { width: 8192, height: 4096 })!.pages[0];
    expect(page.nodes.every((node) => node.position!.x <= 1600 && node.position!.y <= 800)).toBe(true);
    expect(page.edges[0].data).toMatchObject({ markerStart: 'none', markerEnd: 'none' });
    expect(page.edges[1].data).toMatchObject({ markerStart: 'triangle', markerEnd: 'triangle' });
    expect(page.edges[2].data).toMatchObject({ markerStart: 'none', markerEnd: 'triangle' });
    const ids = new Set(page.nodes.map((node) => node.id));
    expect(page.edges.every((edge) => ids.has(edge.source) && ids.has(edge.target))).toBe(true);
  });

  it('captures request data before the delay, uses sample data and never calls fetch', async () => {
    vi.useFakeTimers();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Unexpected network'));
    const input = request();
    const promise = generateMockPreview(input, new AbortController().signal);
    input.source.revision = 99; input.hint = 'changed'; input.sample = 'error';
    await vi.advanceTimersByTimeAsync(650);
    const result = await promise;
    expect(result.source.revision).toBe(5);
    expect(result.hint).toBe('Login');
    expect(result.draft).toEqual(fixture);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('cancels and rejects late resolutions after cancellation or a newer request', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const promise = generateMockPreview(request(), controller.signal);
    const check = expect(promise).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    await check;
    expect(vi.getTimerCount()).toBe(0);
    const result = await mockResult();
    const loading = previewReducer(initialPreviewState, { type: 'start', id: 'first' });
    const cancelled = previewReducer(loading, { type: 'cancel' });
    expect(previewReducer(cancelled, { type: 'resolve', id: 'first', result, now: Date.now() })).toBe(cancelled);
    const newer = previewReducer(loading, { type: 'start', id: 'newer' });
    expect(previewReducer(newer, { type: 'reject', id: 'first', error: 'Old error' })).toBe(newer);
    expect(previewReducer(newer, { type: 'resolve', id: 'first', result, now: Date.now() })).toBe(newer);
  });

  it('preserves a previous success through errors until the user explicitly selects it', async () => {
    vi.useFakeTimers();
    const result = await mockResult();
    let state = previewReducer(initialPreviewState, { type: 'start', id: result.id });
    state = previewReducer(state, { type: 'resolve', id: result.id, result, now: Date.now() });
    expect(state.status).toBe('ready');
    state = previewReducer(state, { type: 'start', id: 'second' });
    expect(state.result).toBeNull();
    expect(state.previous).toBe(result);
    state = previewReducer(state, { type: 'reject', id: 'second', error: 'Simulated failure' });
    expect(state.status).toBe('error');
    state = previewReducer(state, { type: 'previous', now: Date.now() });
    expect(state.status).toBe('ready'); expect(state.result).toBe(result);
    expect(initialPreviewState.result).toBeNull();
  });

  it('expired and unrecognized samples stay non-committable and previous expiry is respected', async () => {
    vi.useFakeTimers();
    for (const sample of ['expired', 'unrecognized'] as const) {
      const promise = generateMockPreview({ ...request(), sample }, new AbortController().signal);
      await vi.advanceTimersByTimeAsync(650);
      const result = await promise;
      const state = previewReducer(previewReducer(initialPreviewState, { type: 'start', id: result.id }),
        { type: 'resolve', id: result.id, result, now: Date.now() });
      expect(state.status).toBe(sample);
      if (sample === 'unrecognized') expect(result.document).toBeNull();
    }
    const result = await mockResult();
    const state = { ...initialPreviewState, previous: result };
    expect(previewReducer(state, { type: 'previous', now: result.expiresAt }).status).toBe('expired');
    expect(previewReducer({ ...state, result, status: 'ready' }, { type: 'expire', now: result.expiresAt }).status).toBe('expired');
  });

  it('keeps the last successful preview after refinement and allows an explicit reversible comparison', async () => {
    vi.useFakeTimers();
    const first = await mockResult('first');
    const second = await mockResult('refined');
    const before = JSON.stringify([first, second]);
    let state = previewReducer(initialPreviewState, { type: 'start', id: first.id });
    state = previewReducer(state, { type: 'resolve', id: first.id, result: first, now: Date.now() });
    state = previewReducer(state, { type: 'start', id: second.id });
    state = previewReducer(state, { type: 'resolve', id: second.id, result: second, now: Date.now() });
    expect(state.result).toBe(second);
    expect(state.previous).toBe(first);
    state = previewReducer(state, { type: 'previous', now: Date.now() });
    expect(state.result).toBe(first);
    expect(state.previous).toBe(second);
    state = previewReducer(state, { type: 'previous', now: Date.now() });
    expect(state.result).toBe(second);
    expect(state.previous).toBe(first);
    expect(JSON.stringify([first, second])).toBe(before);
  });

  it('keeps the baseline through cancellation and ignores a late refinement completion', async () => {
    vi.useFakeTimers();
    const first = await mockResult('first');
    const second = await mockResult('refined');
    let state = previewReducer(initialPreviewState, { type: 'start', id: first.id });
    state = previewReducer(state, { type: 'resolve', id: first.id, result: first, now: Date.now() });
    state = previewReducer(state, { type: 'start', id: second.id });
    const cancelled = previewReducer(state, { type: 'cancel' });
    expect(cancelled.previous).toBe(first);
    expect(previewReducer(cancelled, { type: 'resolve', id: second.id, result: second, now: Date.now() })).toBe(cancelled);
    expect(previewReducer(cancelled, { type: 'previous', now: Date.now() }).result).toBe(first);
  });

  it('simulated errors reject without altering source data', async () => {
    vi.useFakeTimers();
    const input = { ...request(), sample: 'error' as const };
    const before = JSON.stringify(input);
    const promise = generateMockPreview(input, new AbortController().signal);
    const check = expect(promise).rejects.toThrow('Simulated generation error');
    await vi.advanceTimersByTimeAsync(650);
    await check;
    expect(JSON.stringify(input)).toBe(before);
  });
});
