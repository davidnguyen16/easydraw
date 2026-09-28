import { describe, expect, it } from 'vitest';
import type { PreviewResult } from './preview-api';
import { canRefinePreview, capturePreviewRequest, feedbackAfterSuccess } from './preview-intent';

const base = (): PreviewResult => ({
  id: 'base-preview', source: { width: 800, height: 600, image: 'frozen-first-image', revision: 3 },
  hint: 'A room layout', createdAt: 100, expiresAt: 1000,
  document: { schemaVersion: 1, activePageId: 'page', pages: [{ id: 'page', name: 'Preview', nodes: [], edges: [] }] },
  documentHash: 'hash', warnings: [], model: 'configured-model', refinementAvailable: true,
});
const input = () => ({
  id: 'request', whiteboardId: 'board', hint: 'Keep room proportions and add measurements.',
  source: { width: 800, height: 600, image: 'frozen-current-image', revision: 4 },
});

describe('sketch + intent + refinement input', () => {
  it('captures fresh input without a previous graph, image, or refinement history', () => {
    const source = input();
    const request = capturePreviewRequest(source, 200);
    source.hint = 'Edited while pending';
    source.source.image = 'later image';
    expect(request.hint).toBe('Keep room proportions and add measurements.');
    expect(request.source.image).toBe('frozen-current-image');
    expect(request).not.toHaveProperty('basePreviewId');
    expect(request).not.toHaveProperty('feedback');
    expect(request).not.toHaveProperty('document');
  });

  it('refines only the selected server-owned preview ID using current drawing + intent + feedback', () => {
    const previous = base();
    const before = structuredClone(previous);
    const request = capturePreviewRequest({ ...input(), refinement: { base: previous, feedback: 'Move the desk to the right.' } }, 200);
    expect(request).toEqual({ ...input(), basePreviewId: 'base-preview', feedback: 'Move the desk to the right.' });
    expect(previous).toEqual(before);
    expect(request.source.revision).toBe(4);
    expect(request).not.toHaveProperty('document');
    expect(request).not.toHaveProperty('history');
  });

  it('allows optional descriptions and pasted code across different domains', () => {
    for (const hint of ['', 'UML activity diagram: if (attempts >= 3) lockAccount();', 'Architecture', 'Physics trajectory', 'Room layout', 'Travel route']) {
      expect(capturePreviewRequest({ ...input(), hint }, 200).hint).toBe(hint);
    }
    expect(capturePreviewRequest({ ...input(), hint: 'x'.repeat(4000) }, 200).hint).toHaveLength(4000);
    expect(() => capturePreviewRequest({ ...input(), hint: 'x'.repeat(4001) }, 200)).toThrow('4000');
  });

  it('rejects missing, unrecognized or expired bases, including expiry at click time', () => {
    for (const invalid of [null, { ...base(), document: null }, { ...base(), documentHash: null }, { ...base(), expiresAt: 200 },
      { ...base(), refinementAvailable: undefined }, { ...base(), refinementAvailable: false }]) {
      expect(canRefinePreview(invalid, 200)).toBe(false);
      expect(() => capturePreviewRequest({ ...input(), refinement: { base: invalid, feedback: 'Fix the label.' } }, 200)).toThrow('no longer be refined');
    }
    expect(canRefinePreview(base(), 999)).toBe(true);
    expect(canRefinePreview(base(), 1000)).toBe(false);
  });

  it('requires bounded nonblank feedback before a refinement can send a request', () => {
    for (const feedback of ['', ' \n\t ', 'x'.repeat(2001)]) {
      expect(() => capturePreviewRequest({ ...input(), refinement: { base: base(), feedback } }, 200)).toThrow('2000');
    }
    expect(capturePreviewRequest({ ...input(), refinement: { base: base(), feedback: 'x'.repeat(2000) } }, 200).feedback).toHaveLength(2000);
  });

  it('only clears submitted feedback after success and never erases new typing or fresh-generation feedback', () => {
    const request = capturePreviewRequest({ ...input(), refinement: { base: base(), feedback: 'Keep the labels.' } }, 200);
    expect(feedbackAfterSuccess('Keep the labels.', request, base())).toBe('');
    expect(feedbackAfterSuccess('Keep the labels and colors.', request, base())).toBe('Keep the labels and colors.');
    expect(feedbackAfterSuccess('Keep the labels.', request, { ...base(), document: null })).toBe('Keep the labels.');
    expect(feedbackAfterSuccess('Not submitted', capturePreviewRequest(input(), 200), base())).toBe('Not submitted');
  });
});
