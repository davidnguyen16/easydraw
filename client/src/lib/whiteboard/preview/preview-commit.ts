import {
  commitPreview, isPreviewHash, isPreviewIdentifier, PreviewApiError,
  type PreviewCommitReceipt, type PreviewCommitTarget, type PreviewResult,
} from './preview-api';

export function canCreateFromPreview(result: PreviewResult | null): result is PreviewResult {
  return Boolean(result?.document && result.creationAvailable === true && isPreviewIdentifier(result.id) && isPreviewHash(result.documentHash));
}

export function captureCommitTarget(result: PreviewResult | null, whiteboardId: string, now: number): PreviewCommitTarget {
  if (!canCreateFromPreview(result)) throw new PreviewApiError('COMMIT_NOT_AVAILABLE');
  if (now >= result.expiresAt) throw new PreviewApiError('preview_expired');
  if (!isPreviewIdentifier(whiteboardId)) throw new PreviewApiError('invalid_commit');
  return { previewId: result.id, whiteboardId, documentHash: result.documentHash! };
}

export function needsPreviewAcknowledgment(result: PreviewResult | null, revision: number, hint: string, feedback: string): boolean {
  return Boolean(result && (result.source.revision !== revision || result.hint !== hint || feedback.trim()));
}

export function previewApprovalKey(result: PreviewResult | null, revision: number, hint: string, feedback: string): string {
  return JSON.stringify([result?.id ?? null, result?.documentHash ?? null, revision, hint, feedback]);
}

export class WhiteboardSaveError extends Error {
  constructor() { super('Your whiteboard could not be saved. It is still open; retry when saving is available.'); }
}

/** Both saves are deliberate: the user may continue drawing while the server
 * commits. A created receipt survives a later save failure so retry only saves
 * and opens the same diagram, never creates another one. */
export async function createReviewedDiagram(input: {
  target: PreviewCommitTarget;
  acknowledgeStale: boolean;
  existingReceipt?: PreviewCommitReceipt | null;
  signal: AbortSignal;
  isCurrent: () => boolean;
  saveSource: () => Promise<boolean>;
  onPhase: (phase: 'saving' | 'creating' | 'opening') => void;
  onReceipt: (receipt: PreviewCommitReceipt) => void;
  sendCommit?: typeof commitPreview;
}): Promise<PreviewCommitReceipt> {
  const target = { ...input.target };
  const ensureCurrent = () => {
    if (input.signal.aborted || !input.isCurrent()) throw new DOMException('Document changed', 'AbortError');
  };
  const save = async () => {
    ensureCurrent();
    const saved = await input.saveSource();
    ensureCurrent();
    if (!saved) throw new WhiteboardSaveError();
  };
  ensureCurrent();
  input.onPhase('saving');
  await save();
  let receipt = input.existingReceipt;
  if (!receipt) {
    input.onPhase('creating');
    receipt = await (input.sendCommit ?? commitPreview)(target, input.acknowledgeStale, input.signal);
    ensureCurrent();
    input.onReceipt(receipt);
    input.onPhase('opening');
    await save();
  }
  ensureCurrent();
  return receipt;
}
