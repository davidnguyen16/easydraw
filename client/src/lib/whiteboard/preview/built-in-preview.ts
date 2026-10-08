import { isDiagramData, type PagedDiagramData } from '@easydraw/diagram-schema';
import { API_URL } from '../../api';
import {
  delay, isPreviewIdentifier, PreviewApiError,
  type PreviewCommitReceipt, type PreviewCommitTarget, type PreviewRequest, type PreviewResult,
} from './preview-api';

export const BUILT_IN_PREVIEW_MODEL = 'built-in sample';
const RESULT_TTL_MS = 24 * 60 * 60 * 1000;

/** A sample whiteboard's canned answer: Generate shows a document shipped with
 * the client and Create saves that same document through the ordinary
 * diagrams API. Nothing reaches the preview API, S3 or OpenAI. */
export interface BuiltInPreview {
  id: string;
  /** Settles after the sample's thinking time; cancelling the signal ends the wait. */
  generate(request: PreviewRequest, now: number, signal: AbortSignal): Promise<PreviewResult>;
  commit(target: PreviewCommitTarget, signal: AbortSignal): Promise<PreviewCommitReceipt>;
  /** Appended when opening the created diagram, e.g. its intended view. */
  openQuery: string;
  /** Optional opening dimension for this sample's reviewed preview. */
  initialView?: '2D' | '3D';
}

export interface BuiltInPreviewDefinition {
  id: string;
  /** Title and category of the diagram that Create saves. */
  title: string;
  category: string;
  /** Allocates a fresh copy of the shipped document on every call. */
  document: () => unknown;
  openQuery?: string;
  initialView?: '2D' | '3D';
  /** How long Generate keeps its loading state up before the shipped result
   * appears, so the sample paces like a real request. Cosmetic only: nothing
   * is waiting on a server. Defaults to no wait. */
  thinkMs?: number;
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function pagedDocument(value: unknown): PagedDiagramData {
  if (!isDiagramData(value) || !('pages' in value)) throw new Error('The built-in sample result is unavailable.');
  return value;
}

export function createBuiltInPreview(definition: BuiltInPreviewDefinition): BuiltInPreview {
  // Reviewed documents by hash: Create saves exactly what the user looked at.
  const reviewed = new Map<string, PagedDiagramData>();
  const prepare = async () => {
    const document = pagedDocument(definition.document());
    const hash = await sha256Hex(JSON.stringify(document));
    reviewed.set(hash, document);
    return { document, hash };
  };
  return {
    id: definition.id,
    openQuery: definition.openQuery ?? '',
    initialView: definition.initialView,
    async generate(request, now, signal) {
      // Building and hashing the document overlaps the wait instead of adding to it.
      const [{ document, hash }] = await Promise.all([
        prepare(), definition.thinkMs ? delay(definition.thinkMs, signal) : undefined,
      ]);
      return {
        id: crypto.randomUUID(), source: structuredClone(request.source), hint: request.hint,
        refinementAvailable: false, creationAvailable: true,
        createdAt: now, expiresAt: now + RESULT_TTL_MS,
        document, documentHash: hash, warnings: [], model: BUILT_IN_PREVIEW_MODEL,
      };
    },
    async commit(target, signal) {
      let document = reviewed.get(target.documentHash);
      if (!document) {
        // After a reload the map is empty; the shipped document is
        // deterministic, so the reviewed hash must still match it.
        const prepared = await prepare();
        if (prepared.hash !== target.documentHash) throw new PreviewApiError('preview_hash_mismatch');
        document = prepared.document;
      }
      const response = await fetch(`${API_URL}/diagrams`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: definition.title, type: 'diagram', data: document, category: definition.category }),
        signal,
      });
      if (!response.ok) throw new Error('Could not create the diagram. Your preview and whiteboard are still here.');
      const created: unknown = await response.json();
      const diagramId = typeof created === 'object' && created !== null && 'id' in created ? created.id : null;
      if (!isPreviewIdentifier(diagramId)) throw new PreviewApiError('COMMIT_UNCONFIRMED');
      return {
        previewId: target.previewId, diagramId, visualDocumentId: null, sourceWhiteboardId: target.whiteboardId,
        documentHash: target.documentHash, created: true,
      };
    },
  };
}
