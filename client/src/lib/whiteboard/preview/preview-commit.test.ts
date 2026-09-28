import { describe, expect, it, vi } from 'vitest';
import { canCreateFromPreview, captureCommitTarget, createReviewedDiagram, needsPreviewAcknowledgment, previewApprovalKey, WhiteboardSaveError } from './preview-commit';
import type { PreviewCommitReceipt, PreviewCommitTarget, PreviewResult } from './preview-api';

const PREVIEW = '11111111-1111-4111-8111-111111111111';
const BOARD = '22222222-2222-4222-8222-222222222222';
const DIAGRAM = '33333333-3333-4333-8333-333333333333';
const HASH = 'a'.repeat(64);
const result = (): PreviewResult => ({
  id: PREVIEW, documentHash: HASH, creationAvailable: true,
  source: { width: 800, height: 600, image: 'data:image/png;base64,AA==', revision: 4 },
  hint: 'Plan a route', model: 'test-model', createdAt: 100, expiresAt: 200,
  document: { schemaVersion: 1, activePageId: 'page', pages: [{ id: 'page', name: 'Preview', nodes: [], edges: [] }] }, warnings: [],
});
const target = (): PreviewCommitTarget => ({ previewId: PREVIEW, whiteboardId: BOARD, documentHash: HASH });
const receipt = (): PreviewCommitReceipt => ({ previewId: PREVIEW, sourceWhiteboardId: BOARD, diagramId: DIAGRAM, visualDocumentId: null, documentHash: HASH, created: true });
const workflow = () => ({ target: target(), acknowledgeStale: false, signal: new AbortController().signal,
  isCurrent: vi.fn(() => true), saveSource: vi.fn(async () => true), onPhase: vi.fn(), onReceipt: vi.fn(), sendCommit: vi.fn(async () => receipt()) });

describe('explicit creation from the selected preview', () => {
  it('captures only the reviewed ID/hash without mutating a preview graph', () => {
    const viewed = result();
    const before = structuredClone(viewed);
    const captured = captureCommitTarget(viewed, BOARD, 150);
    expect(captured).toEqual(target());
    expect(viewed).toEqual(before);
    viewed.documentHash = 'b'.repeat(64);
    expect(captured.documentHash).toBe(HASH);
  });

  it.each([undefined, false])('fails closed for creation capability %s', (available) => {
    const viewed = { ...result(), creationAvailable: available };
    expect(canCreateFromPreview(viewed)).toBe(false);
    expect(() => captureCommitTarget(viewed, BOARD, 150)).toThrow('not available');
  });

  it('rejects expired/unrecognized or invalid identity/hash previews before any request', () => {
    expect(() => captureCommitTarget(result(), BOARD, 200)).toThrow('expired');
    expect(() => captureCommitTarget({ ...result(), document: null }, BOARD, 150)).toThrow();
    expect(() => captureCommitTarget({ ...result(), id: '../unsafe' }, BOARD, 150)).toThrow();
    expect(() => captureCommitTarget({ ...result(), documentHash: 'wrong' }, BOARD, 150)).toThrow();
    expect(() => captureCommitTarget(result(), 'wrong', 150)).toThrow();
  });

  it('requires acknowledgment for newer drawing, description or unapplied feedback', () => {
    const viewed = result();
    expect(needsPreviewAcknowledgment(viewed, 4, viewed.hint, '  ')).toBe(false);
    expect(needsPreviewAcknowledgment(viewed, 5, viewed.hint, '')).toBe(true);
    expect(needsPreviewAcknowledgment(viewed, 4, 'Use different labels', '')).toBe(true);
    expect(needsPreviewAcknowledgment(viewed, 4, viewed.hint, 'Add a stop')).toBe(true);
    const key = previewApprovalKey(viewed, 4, viewed.hint, 'Add a stop');
    expect(previewApprovalKey(viewed, 5, viewed.hint, 'Add a stop')).not.toBe(key);
    expect(previewApprovalKey(viewed, 4, 'New description', 'Add a stop')).not.toBe(key);
    expect(previewApprovalKey(viewed, 4, viewed.hint, 'Different change')).not.toBe(key);
    expect(previewApprovalKey({ ...viewed, id: DIAGRAM }, 4, viewed.hint, 'Add a stop')).not.toBe(key);
  });

  it('waits for source save, sends one frozen target, then saves late edits before returning', async () => {
    const input = workflow();
    let release!: (saved: boolean) => void;
    input.saveSource.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    const pending = createReviewedDiagram(input);
    input.target.documentHash = 'b'.repeat(64);
    expect(input.sendCommit).not.toHaveBeenCalled();
    release(true);
    expect(await pending).toEqual(receipt());
    expect(input.sendCommit).toHaveBeenCalledExactlyOnceWith(target(), false, input.signal);
    expect(input.saveSource).toHaveBeenCalledTimes(2);
    expect(input.onPhase.mock.calls.map(([phase]) => phase)).toEqual(['saving', 'creating', 'opening']);
    expect(input.onReceipt).toHaveBeenCalledExactlyOnceWith(receipt());
  });

  it('does not create or navigate when the source cannot be saved', async () => {
    const input = workflow();
    input.saveSource.mockResolvedValue(false);
    await expect(createReviewedDiagram(input)).rejects.toBeInstanceOf(WhiteboardSaveError);
    expect(input.sendCommit).not.toHaveBeenCalled();
    expect(input.onReceipt).not.toHaveBeenCalled();
  });

  it('retains a receipt before final save failure and opens that receipt on retry without another commit', async () => {
    const input = workflow();
    input.saveSource.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await expect(createReviewedDiagram(input)).rejects.toBeInstanceOf(WhiteboardSaveError);
    expect(input.onReceipt).toHaveBeenCalledExactlyOnceWith(receipt());
    const retry = workflow();
    expect(await createReviewedDiagram({ ...retry, existingReceipt: receipt() })).toEqual(receipt());
    expect(retry.sendCommit).not.toHaveBeenCalled();
    expect(retry.saveSource).toHaveBeenCalledOnce();
  });

  it.each(['save', 'commit', 'final-save'])('suppresses late completion after document switch during %s', async (stage) => {
    const input = workflow();
    if (stage === 'save') input.saveSource.mockImplementationOnce(async () => { input.isCurrent.mockReturnValue(false); return true; });
    if (stage === 'commit') input.sendCommit.mockImplementationOnce(async () => { input.isCurrent.mockReturnValue(false); return receipt(); });
    if (stage === 'final-save') input.saveSource.mockResolvedValueOnce(true).mockImplementationOnce(async () => { input.isCurrent.mockReturnValue(false); return true; });
    await expect(createReviewedDiagram(input)).rejects.toMatchObject({ name: 'AbortError' });
    if (stage === 'save') expect(input.sendCommit).not.toHaveBeenCalled();
    if (stage !== 'final-save') expect(input.onReceipt).not.toHaveBeenCalled();
  });

  it('does not save or create an already aborted workspace', async () => {
    const input = workflow();
    const controller = new AbortController(); controller.abort();
    await expect(createReviewedDiagram({ ...input, signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(input.saveSource).not.toHaveBeenCalled();
    expect(input.sendCommit).not.toHaveBeenCalled();
  });
});
