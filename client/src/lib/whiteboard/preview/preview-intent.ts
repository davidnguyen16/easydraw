import type { PreviewRequest, PreviewResult, PreviewSource } from './preview-api';

export const IDEA_MAX_LENGTH = 4000;
export const FEEDBACK_MAX_LENGTH = 2000;

/** Expiry is checked again at click time, even if the browser suspended a timer. */
export function canRefinePreview(result: PreviewResult | null, now: number): result is PreviewResult {
  return Boolean(result?.document && result.documentHash && result.refinementAvailable === true && result.expiresAt > now);
}

export function capturePreviewRequest(input: {
  id: string;
  whiteboardId: string;
  source: PreviewSource;
  hint: string;
  refinement?: { base: PreviewResult | null; feedback: string };
}, now: number): PreviewRequest {
  if (input.hint.length > IDEA_MAX_LENGTH) throw new Error('Your idea description must not exceed 4000 characters.');
  const request: PreviewRequest = {
    id: input.id, whiteboardId: input.whiteboardId, source: structuredClone(input.source), hint: input.hint,
  };
  if (input.refinement) {
    if (!canRefinePreview(input.refinement.base, now)) {
      throw new Error('This preview can no longer be refined. Generate from the drawing to start a new preview.');
    }
    if (!input.refinement.feedback.trim() || input.refinement.feedback.length > FEEDBACK_MAX_LENGTH) {
      throw new Error('Describe what should change, using no more than 2000 characters.');
    }
    request.basePreviewId = input.refinement.base.id;
    request.feedback = input.refinement.feedback;
  }
  return request;
}

/** An in-flight result must never erase newer feedback typed by the user. */
export function feedbackAfterSuccess(current: string, request: PreviewRequest, result: PreviewResult): string {
  return result.document && request.basePreviewId && current === request.feedback ? '' : current;
}
