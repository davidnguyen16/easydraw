import {
  isDiagramData, isSourceImageData, isVectorGeometry, SOURCE_IMAGE_NODE_TYPE, VECTOR_PATH_NODE_TYPE,
  type DraftWarning, type PagedDiagramData,
} from '@easydraw/diagram-schema';
import { API_URL } from '../../api';

export interface PreviewSource {
  width: number;
  height: number;
  image: string;
  revision: number;
}

export interface PreviewRequest {
  id: string;
  whiteboardId: string;
  source: PreviewSource;
  hint: string;
  /** Only the server-owned preview ID is sent, never a client graph/history. */
  basePreviewId?: string;
  feedback?: string;
}

export interface PreviewResponse {
  id: string;
  clientRequestId: string;
  clientRevision: number | null;
  status: 'processing' | 'ready' | 'unrecognized' | 'failed' | 'cancelled' | 'expired';
  document: PagedDiagramData | null;
  documentHash: string | null;
  warnings: DraftWarning[];
  errorCode: string | null;
  createdAt: string;
  expiresAt: string;
  source: { width: number; height: number };
  model: string;
  /** Absent on older deployments; refinement must fail closed there. */
  refinementAvailable?: boolean;
  creationAvailable?: boolean;
}

/** Review-only data. The server, not this object, owns the document to commit. */
export interface PreviewResult {
  id: string;
  source: PreviewSource;
  hint: string;
  /** Captured input for this result, not the current contents of the form. */
  basePreviewId?: string;
  feedback?: string;
  refinementAvailable?: boolean;
  creationAvailable?: boolean;
  createdAt: number;
  expiresAt: number;
  document: PagedDiagramData | null;
  documentHash: string | null;
  warnings: DraftWarning[];
  model: string;
}

export interface PreviewCommitTarget {
  previewId: string;
  whiteboardId: string;
  documentHash: string;
}

export interface PreviewCommitReceipt {
  previewId: string;
  diagramId: string;
  visualDocumentId: string | null;
  sourceWhiteboardId: string | null;
  documentHash: string;
  created: boolean;
}

export const isPreviewIdentifier = (value: unknown): value is string => typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export const isPreviewHash = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);

const ERROR_MESSAGES: Record<string, string> = {
  provider_not_configured: 'AI preview is not configured on the server yet. Ask the app administrator to configure OpenAI.',
  storage_not_configured: 'Private preview storage is not configured on the server yet.',
  storage_unavailable: 'The source snapshot could not be stored securely. Please try again later.',
  preview_storage_unavailable: 'The source snapshot could not be stored securely. Please try again later.',
  preview_not_enabled: 'AI preview is not enabled on this server yet.',
  preview_busy: 'Another preview is still running for your account. Wait for it to finish before trying again.',
  preview_rate_limit: 'Too many preview requests. Please wait a minute before trying again.',
  preview_daily_limit: 'Your daily preview limit has been reached. Please try again tomorrow (UTC).',
  provider_rate_limited: 'OpenAI could not accept this request. Ask the app administrator to check API quota or try again later.',
  provider_auth: 'OpenAI rejected access to the configured model. Ask the app administrator to check the API key, model and permissions.',
  provider_request_rejected: 'OpenAI could not accept this request. Ask the app administrator to check the model configuration.',
  provider_unavailable: 'The AI service is temporarily unavailable. Your whiteboard is unchanged.',
  provider_timeout: 'The AI request timed out. Your whiteboard is unchanged. A new attempt requires another click.',
  provider_refused: 'AI could not process this drawing. Try a different drawing or instructions.',
  provider_incomplete: 'AI returned an incomplete result. Your whiteboard is unchanged.',
  provider_invalid_output: 'AI returned a result that could not be safely converted into a diagram. Your whiteboard is unchanged.',
  preview_too_complex: 'The preview is too complex. Try a smaller region of the drawing.',
  invalid_draft: 'AI returned a diagram that failed validation. Your whiteboard is unchanged.',
  invalid_document: 'This result could not be safely converted into a diagram. Your whiteboard is unchanged.',
  invalid_image: 'Use a valid PNG snapshot of your whiteboard.',
  image_too_large: 'The source snapshot must not exceed 4 MiB. Reduce the whiteboard size and try again.',
  invalid_dimensions: 'The source snapshot has unsupported dimensions. Resize the whiteboard and try again.',
  invalid_hint: 'Your idea description must not exceed 4000 characters.',
  invalid_feedback: 'Describe what should change, using no more than 2000 characters.',
  invalid_refinement: 'Choose a valid preview and describe what should change before refining.',
  refinement_unavailable: 'This preview can no longer be refined. Generate from the drawing to start a new preview.',
  refinement_limit: 'This preview has reached the refinement limit. Generate from the drawing with your updated description to start again.',
  preview_expired: 'This preview has expired. Generate a new preview before creating a diagram.',
  preview_not_ready: 'Select a ready preview before creating a diagram.',
  preview_hash_mismatch: 'This preview no longer matches the reviewed version. Generate and review a new preview.',
  preview_stale: 'The saved whiteboard has changed. Confirm that you want to create from this reviewed preview, or update the preview first.',
  snapshot_unavailable: 'The source snapshot is unavailable. Your whiteboard is unchanged; generate a new preview.',
  diagram_deleted: 'The diagram previously created from this preview was deleted. Generate a new preview to create another diagram.',
  preview_commit_unavailable: 'Creating diagrams from previews is temporarily unavailable. You can retry this same preview safely.',
  preview_not_found: 'This preview is no longer available. Generate a new preview to continue.',
  invalid_commit: 'This preview could not be submitted for creation. Generate and review a new preview.',
  COMMIT_UNCONFIRMED: 'Creation may have finished, but its result could not be confirmed. Retry this same preview safely; it will not create a duplicate or run AI again.',
  COMMIT_NOT_AVAILABLE: 'Creating diagrams is not available for this preview. Check availability after the server has been updated.',
  COMMIT_CHECK_FAILED: 'Could not check creation availability. Your selected preview is unchanged; try checking again.',
  source_unavailable: 'The source whiteboard is no longer available.',
  generation_interrupted: 'This request was interrupted on the server. It was not automatically sent to AI again.',
  CANCELLED: 'This preview request was cancelled. Your whiteboard is unchanged.',
  EXPIRED: 'This preview has expired. Generate a new preview to continue.',
  INVALID_RESPONSE: 'The server returned an invalid preview response. No diagram has been created.',
  RECOVERY_REQUIRED: 'The request outcome is not confirmed yet. Check the existing request or cancel it before starting another. It will not be sent to AI again automatically.',
};

export class PreviewApiError extends Error {
  constructor(public readonly code: string, public readonly status = 0) {
    super(ERROR_MESSAGES[code] ?? fallbackMessage(status));
    this.name = 'PreviewApiError';
  }
}

function fallbackMessage(status: number): string {
  if (status === 401) return 'Your session has expired. Sign in again to generate a preview.';
  if (status === 403) return 'You do not have permission to generate a preview for this whiteboard.';
  if (status === 404) return 'This whiteboard or preview is no longer available.';
  if (status === 409) return 'This request conflicts with an existing preview. Check or cancel the existing request first.';
  if (status === 413) return 'This source image is too large. Reduce the whiteboard size and try again.';
  if (status === 429) return 'The preview request limit has been reached. Please try again later.';
  if (status === 400 || status === 422) return 'This drawing could not be submitted. Check the image size and instructions.';
  if (status === 503) return 'AI preview is temporarily unavailable. Check the server configuration and try again later.';
  return 'Could not generate a preview. Your whiteboard is unchanged.';
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Never display raw provider bodies/errors or trust an arbitrary graph payload. */
export function parsePreviewResponse(value: unknown): PreviewResponse {
  if (!record(value) || typeof value.id !== 'string' || !value.id ||
    typeof value.clientRequestId !== 'string' ||
    !(value.clientRevision === null || Number.isSafeInteger(value.clientRevision)) ||
    !['processing', 'ready', 'unrecognized', 'failed', 'cancelled', 'expired'].includes(String(value.status)) ||
    typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt)) ||
    typeof value.expiresAt !== 'string' || !Number.isFinite(Date.parse(value.expiresAt)) ||
    !record(value.source) || !Number.isSafeInteger(value.source.width) || !Number.isSafeInteger(value.source.height) ||
    Number(value.source.width) < (value.status === 'cancelled' ? 0 : 1) || Number(value.source.width) > 8192 ||
    Number(value.source.height) < (value.status === 'cancelled' ? 0 : 1) || Number(value.source.height) > 8192 ||
    !(value.documentHash === null || typeof value.documentHash === 'string') ||
    !(value.errorCode === null || typeof value.errorCode === 'string') ||
    typeof value.model !== 'string' ||
    !(value.refinementAvailable === undefined || typeof value.refinementAvailable === 'boolean') ||
    !(value.creationAvailable === undefined || typeof value.creationAvailable === 'boolean') ||
    !Array.isArray(value.warnings) || value.warnings.length > 30 ||
    !value.warnings.every((warning) => record(warning) && typeof warning.code === 'string' &&
      typeof warning.message === 'string' && warning.message.length <= 500 &&
      (warning.elementId === null || typeof warning.elementId === 'string'))) {
    throw new PreviewApiError('INVALID_RESPONSE');
  }
  if (value.document !== null && (!isDiagramData(value.document) || !('pages' in value.document) ||
    value.document.pages.length !== 1 || value.document.pages.some((page) => {
      if (page.nodes.length > 118 || page.edges.length > 100) return true;
      let shapes = 0;
      let vectors = 0;
      let crops = 0;
      let vectorCommands = 0;
      for (const node of page.nodes) {
        if (node.type === VECTOR_PATH_NODE_TYPE) {
          if (++vectors > 64 || !record(node.data) || !isVectorGeometry(node.data.vector)) return true;
          vectorCommands += node.data.vector.commands.length;
          if (vectorCommands > 512) return true;
        } else if (node.type === SOURCE_IMAGE_NODE_TYPE) {
          if (++crops > 4 || !record(node.data) || !isSourceImageData(node.data.image)) return true;
        } else if (++shapes > 50) return true;
      }
      return false;
    }))) {
    throw new PreviewApiError('INVALID_RESPONSE');
  }
  if (value.status === 'ready' && (value.document === null || !value.documentHash) ||
    value.status === 'unrecognized' && value.document !== null) throw new PreviewApiError('INVALID_RESPONSE');
  return value as unknown as PreviewResponse;
}

const requestPath = (request: Pick<PreviewRequest, 'id' | 'whiteboardId'>) =>
  `/diagrams/${encodeURIComponent(request.whiteboardId)}/previews/requests/${encodeURIComponent(request.id)}`;

function abortError(): DOMException { return new DOMException('Cancelled', 'AbortError'); }

/** Keep body consumption inside the request deadline. Cancelling the reader
 * also releases stalled mock/proxy streams, not only native fetch responses. */
async function readJsonBody(response: Response, signal: AbortSignal): Promise<unknown> {
  if (signal.aborted) throw abortError();
  if (!response.body) return null;
  const reader = response.body.getReader();
  const abort = () => { void reader.cancel().catch(() => {}); };
  const decoder = new TextDecoder();
  const parts: string[] = [];
  let size = 0;
  signal.addEventListener('abort', abort, { once: true });
  try {
    while (true) {
      if (signal.aborted) throw abortError();
      const { done, value } = await reader.read();
      if (signal.aborted) throw abortError();
      if (done) break;
      size += value.byteLength;
      if (size > 1024 * 1024) {
        void reader.cancel().catch(() => {});
        throw new PreviewApiError('INVALID_RESPONSE');
      }
      parts.push(decoder.decode(value, { stream: true }));
    }
    parts.push(decoder.decode());
    try { return JSON.parse(parts.join('')) as unknown; } catch { throw new PreviewApiError('INVALID_RESPONSE'); }
  } finally {
    signal.removeEventListener('abort', abort);
    reader.releaseLock();
  }
}

async function apiRequest(path: string, options: RequestInit, signal?: AbortSignal, timeoutMs = 75_000): Promise<unknown> {
  if (signal?.aborted) throw abortError();
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timeout = setTimeout(abort, timeoutMs);
  signal?.addEventListener('abort', abort, { once: true });
  try {
    const response = await fetch(`${API_URL}${path}`, { ...options, credentials: 'include', cache: 'no-store', signal: controller.signal });
    // Browsers may expose an empty stream for 204/205 instead of body=null.
    // Cancellation needs only the successful status, never a JSON receipt.
    if (response.status === 204 || response.status === 205 || response.ok && options.method === 'DELETE') {
      void response.body?.cancel().catch(() => {});
      return null;
    }
    const body = await readJsonBody(response, controller.signal).catch((error: unknown) => {
      if (!response.ok && error instanceof PreviewApiError && error.code === 'INVALID_RESPONSE') return null;
      throw error;
    });
    if (!response.ok) {
      const code = record(body) && typeof body.code === 'string' ? body.code : 'HTTP_ERROR';
      throw new PreviewApiError(code, response.status);
    }
    return body;
  } catch (error) {
    if (signal?.aborted) throw abortError();
    // A timeout/network failure cannot tell whether the server already sent AI a request.
    if (!(error instanceof PreviewApiError)) throw new PreviewApiError('TRANSPORT_ERROR');
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}

function readResponse(body: unknown, request: PreviewRequest): PreviewResponse {
  const result = parsePreviewResponse(body);
  if (result.clientRequestId !== request.id || result.status !== 'cancelled' &&
    (result.clientRevision !== request.source.revision || result.source.width !== request.source.width ||
      result.source.height !== request.source.height)) throw new PreviewApiError('INVALID_RESPONSE');
  return result;
}

export function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(abortError()); return; }
    const abort = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); reject(abortError()); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
    signal.addEventListener('abort', abort, { once: true });
  });
}

function toResult(response: PreviewResponse, request: PreviewRequest): PreviewResult {
  if (response.status === 'failed') throw new PreviewApiError(response.errorCode ?? 'GENERATION_FAILED');
  if (response.status === 'cancelled') throw new PreviewApiError('CANCELLED');
  if (response.status === 'expired') throw new PreviewApiError('EXPIRED');
  return {
    id: response.id, source: structuredClone(request.source), hint: request.hint,
    refinementAvailable: response.refinementAvailable === true,
    creationAvailable: response.creationAvailable === true,
    ...(request.basePreviewId ? { basePreviewId: request.basePreviewId, feedback: request.feedback } : {}),
    createdAt: Date.parse(response.createdAt), expiresAt: Date.parse(response.expiresAt),
    document: response.document, documentHash: response.documentHash, warnings: response.warnings, model: response.model,
  };
}

/** Recovery is read-only: even a lost POST response never triggers a second POST. */
export async function recoverPreview(request: PreviewRequest, signal: AbortSignal): Promise<PreviewResult> {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    try {
      const response = readResponse(await apiRequest(requestPath(request), { method: 'GET' }, signal, 10_000), request);
      if (response.status !== 'processing') return toResult(response, request);
    } catch (error) {
      if (!(error instanceof PreviewApiError) ||
        !(error.code === 'TRANSPORT_ERROR' || error.status === 404 || error.status >= 500)) throw error;
    }
    await delay(Math.min(1500, Math.max(0, deadline - Date.now())), signal);
  }
  throw new PreviewApiError('RECOVERY_REQUIRED');
}

export async function generatePreview(request: PreviewRequest, signal: AbortSignal): Promise<PreviewResult> {
  const captured = structuredClone(request);
  let response: PreviewResponse;
  try {
    response = readResponse(await apiRequest(`/diagrams/${encodeURIComponent(captured.whiteboardId)}/previews`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientRequestId: captured.id, clientRevision: captured.source.revision,
        width: captured.source.width, height: captured.source.height, image: captured.source.image, hint: captured.hint,
        ...(captured.basePreviewId ? { basePreviewId: captured.basePreviewId, feedback: captured.feedback } : {}) }),
    }, signal), captured);
  } catch (error) {
    if (error instanceof PreviewApiError && (error.code === 'TRANSPORT_ERROR' ||
      ['HTTP_ERROR', 'preview_unavailable'].includes(error.code) && error.status >= 500)) {
      return recoverPreview(captured, signal);
    }
    throw error;
  }
  return response.status === 'processing' ? recoverPreview(captured, signal) : toResult(response, captured);
}

/** Cancel uses a durable request ID, including before the create response arrives. */
export async function cancelPreview(request: Pick<PreviewRequest, 'id' | 'whiteboardId'>): Promise<void> {
  await apiRequest(requestPath(request), { method: 'DELETE' }, undefined, 10_000);
}

/** Re-check deployment capability without generating AI or replacing the exact
 * graph the user reviewed. A different hash must never unlock creation. */
export async function checkCreationAvailability(result: Pick<PreviewResult, 'id' | 'documentHash'>, signal: AbortSignal): Promise<boolean> {
  const captured = { id: result.id, documentHash: result.documentHash };
  if (!isPreviewIdentifier(captured.id) || !isPreviewHash(captured.documentHash)) throw new PreviewApiError('COMMIT_NOT_AVAILABLE');
  try {
    const response = parsePreviewResponse(await apiRequest(`/diagram-previews/${encodeURIComponent(captured.id)}`, { method: 'GET' }, signal, 10_000));
    if (response.id !== captured.id) throw new PreviewApiError('preview_hash_mismatch');
    if (response.status === 'expired' || Date.parse(response.expiresAt) <= Date.now()) throw new PreviewApiError('preview_expired');
    if (response.status !== 'ready') throw new PreviewApiError('preview_not_ready');
    if (response.documentHash !== captured.documentHash) throw new PreviewApiError('preview_hash_mismatch');
    return response.creationAvailable === true;
  } catch (error) {
    if (signal.aborted) throw abortError();
    if (error instanceof PreviewApiError && !['TRANSPORT_ERROR', 'INVALID_RESPONSE', 'HTTP_ERROR'].includes(error.code)) throw error;
    throw new PreviewApiError('COMMIT_CHECK_FAILED');
  }
}

/** A creation response is a receipt, never an instruction or navigation URL. */
export function parseCommitReceipt(value: unknown, target: PreviewCommitTarget): PreviewCommitReceipt {
  if (!record(value) || !isPreviewIdentifier(value.previewId) || value.previewId !== target.previewId ||
    !isPreviewIdentifier(value.diagramId) || !(value.visualDocumentId === null || isPreviewIdentifier(value.visualDocumentId)) ||
    !(value.sourceWhiteboardId === null || isPreviewIdentifier(value.sourceWhiteboardId) && value.sourceWhiteboardId === target.whiteboardId) ||
    !isPreviewHash(value.documentHash) || value.documentHash !== target.documentHash || typeof value.created !== 'boolean') {
    throw new PreviewApiError('COMMIT_UNCONFIRMED');
  }
  return value as unknown as PreviewCommitReceipt;
}

/** One explicit commit; retries reuse the same preview ID/hash, with no AI call. */
export async function commitPreview(target: PreviewCommitTarget, acknowledgeStale: boolean, signal: AbortSignal): Promise<PreviewCommitReceipt> {
  const captured = { ...target };
  if (!isPreviewIdentifier(captured.previewId) || !isPreviewIdentifier(captured.whiteboardId) || !isPreviewHash(captured.documentHash)) {
    throw new PreviewApiError('invalid_commit');
  }
  try {
    return parseCommitReceipt(await apiRequest(`/diagram-previews/${encodeURIComponent(captured.previewId)}/commit`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentHash: captured.documentHash, acknowledgeStale }),
    }, signal, 30_000), captured);
  } catch (error) {
    if (signal.aborted) throw abortError();
    if (error instanceof PreviewApiError && !['TRANSPORT_ERROR', 'INVALID_RESPONSE', 'HTTP_ERROR'].includes(error.code)) throw error;
    // A transport/receipt failure does not imply that the transaction rolled back.
    throw new PreviewApiError('COMMIT_UNCONFIRMED');
  }
}
