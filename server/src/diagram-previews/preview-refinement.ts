import {
  isDiagramData,
  isWhiteboardDiagramDraftV2,
  type PagedDiagramData,
  type WhiteboardDiagramDraftV2,
} from '@easydraw/diagram-schema';
import { PreviewPipelineError } from './preview-provider.service';

export const MAX_PREVIEW_REFINEMENTS = 10;
const MAX_STORED_PREVIEW_BYTES = 1024 * 1024;

/** Private server state. This is never part of the editor document or API graph. */
export interface PreviewRefinementContext {
  version: 1;
  hint: string;
  feedbackHistory: string[];
  draft: WhiteboardDiagramDraftV2;
  basePreviewId?: string;
}

export interface StoredPreviewEnvelope {
  kind: 'easydraw-preview';
  version: 1;
  document: PagedDiagramData;
  context: PreviewRefinementContext;
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// These values are validated JSON destined for JSONB. JSON cloning also keeps
// plain-object prototypes in this realm for the schema's strict JSON guards.
function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function pagedDocument(value: unknown): value is PagedDiagramData {
  return isDiagramData(value) && 'pages' in value;
}

function validContext(value: unknown): value is PreviewRefinementContext {
  return (
    record(value) &&
    value.version === 1 &&
    typeof value.hint === 'string' &&
    value.hint.length <= 4000 &&
    Array.isArray(value.feedbackHistory) &&
    value.feedbackHistory.length <= MAX_PREVIEW_REFINEMENTS &&
    value.feedbackHistory.every(
      (item) =>
        typeof item === 'string' &&
        item.trim().length > 0 &&
        item.length <= 2000,
    ) &&
    (value.basePreviewId === undefined ||
      (typeof value.basePreviewId === 'string' &&
        /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
          value.basePreviewId,
        ))) &&
    isWhiteboardDiagramDraftV2(value.draft) &&
    value.draft.outcome === 'diagram'
  );
}

/** Old READY rows remain readable, but cannot supply refinement context. */
export function readStoredPreview(value: unknown): {
  document: PagedDiagramData;
  context: PreviewRefinementContext | null;
} {
  if (record(value) && value.kind === 'easydraw-preview') {
    if (
      value.version !== 1 ||
      !pagedDocument(value.document) ||
      !validContext(value.context)
    ) {
      throw new PreviewPipelineError('invalid_document');
    }
    return cloneJson({ document: value.document, context: value.context });
  }
  if (!pagedDocument(value)) throw new PreviewPipelineError('invalid_document');
  return { document: cloneJson(value), context: null };
}

/** Snapshot both sides so neither later UI nor provider mutation changes history. */
export function storePreviewDocument(
  document: PagedDiagramData,
  context: PreviewRefinementContext,
): StoredPreviewEnvelope {
  if (!pagedDocument(document) || !validContext(context)) {
    throw new PreviewPipelineError('invalid_document');
  }
  const envelope: StoredPreviewEnvelope = {
    kind: 'easydraw-preview',
    version: 1,
    document,
    context,
  };
  if (
    Buffer.byteLength(JSON.stringify(envelope), 'utf8') >
    MAX_STORED_PREVIEW_BYTES
  ) {
    throw new PreviewPipelineError('preview_too_complex');
  }
  return cloneJson(envelope);
}
