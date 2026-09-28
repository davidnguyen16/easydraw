import {
  isWhiteboardDiagramDraft,
  type WhiteboardDiagramDraftV1,
  type PagedDiagramData,
} from '@easydraw/diagram-schema';
import flowchart from '@easydraw/diagram-schema/fixtures/flowchart.json';
import warnings from '@easydraw/diagram-schema/fixtures/warnings.json';
import unrecognized from '@easydraw/diagram-schema/fixtures/unrecognized.json';
import type { PreviewResult, PreviewSource } from './preview-api';

export type { PreviewSource } from './preview-api';

export type PreviewSample = 'flowchart' | 'warnings' | 'unrecognized' | 'error' | 'expired';
export interface MockPreviewResult extends PreviewResult {
  sample: PreviewSample;
  draft: WhiteboardDiagramDraftV1;
}
export interface MockPreviewRequest {
  id: string;
  source: PreviewSource;
  hint: string;
  sample: PreviewSample;
}

const NODE_TYPES = {
  rectangle: 'RectangleNode', 'rounded-rectangle': 'RoundedRectangleNode',
  ellipse: 'EllipseNode', diamond: 'DiamondNode', database: 'DatabaseNode', text: 'TextNode',
} as const;

/** Fixture adapter for the UI prototype only. Production conversion belongs to
 * the future server pipeline; no client result is authorized for persistence.
 */
export function mockDraftToDocument(draft: unknown, source: Pick<PreviewSource, 'width' | 'height'>): PagedDiagramData | null {
  if (!isWhiteboardDiagramDraft(draft)) throw new Error('The demo draft failed validation.');
  if (![source.width, source.height].every((n) => Number.isInteger(n) && n > 0 && n <= 8192)) {
    throw new Error('Invalid source dimensions.');
  }
  if (draft.outcome === 'unrecognized') return null;
  const scale = Math.min(1, 1600 / Math.max(source.width, source.height));
  const sx = source.width * scale / 1000, sy = source.height * scale / 1000;
  const nodes = draft.nodes.map((node) => {
    const width = Math.max(node.shape === 'text' ? 80 : 40, Math.round(node.bounds.width * sx));
    const height = Math.max(24, Math.round(node.bounds.height * sy));
    return {
      id: node.id, type: NODE_TYPES[node.shape],
      position: {
        x: Math.round((node.bounds.x + node.bounds.width / 2) * sx - width / 2),
        y: Math.round((node.bounds.y + node.bounds.height / 2) * sy - height / 2),
      }, width, height, style: { width, height },
      data: { label: node.label, fontSize: 14, fillColor: node.shape === 'text' ? 'transparent' : '#ffffff',
        borderColor: '#526375', borderWidth: 1.5, textColor: '#253349' },
    };
  });
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const edges = draft.edges.map((edge) => {
    const from = byId.get(edge.sourceId)!;
    const to = byId.get(edge.targetId)!;
    const dx = to.position.x + to.width / 2 - from.position.x - from.width / 2;
    const dy = to.position.y + to.height / 2 - from.position.y - from.height / 2;
    const horizontal = Math.abs(dx) >= Math.abs(dy);
    return {
      id: edge.id, type: 'connection', source: edge.sourceId, target: edge.targetId,
      sourceHandle: horizontal ? dx >= 0 ? 'right' : 'left' : dy >= 0 ? 'bottom' : 'top',
      targetHandle: from.id === to.id ? 'top' : horizontal ? dx >= 0 ? 'left' : 'right' : dy >= 0 ? 'top' : 'bottom',
      data: { routing: 'orthogonal', strokeColor: '#657a90', strokeWidth: 1.5,
        markerStart: edge.direction === 'both' ? 'triangle' : 'none',
        markerEnd: edge.direction === 'none' ? 'none' : 'triangle',
        labels: edge.label ? [{ id: `${edge.id}-label`, text: edge.label, t: 0.5 }] : [] },
    };
  });
  return { schemaVersion: 1, activePageId: 'preview-page',
    pages: [{ id: 'preview-page', name: 'Preview', nodes, edges }] };
}

/** Deliberately offline: the image/hint are captured for UX review but are NOT
 * interpreted. No fetch, API key, provider SDK, storage or diagram creation.
 */
export function generateMockPreview(request: MockPreviewRequest, signal: AbortSignal): Promise<MockPreviewResult> {
  const captured = structuredClone(request);
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException('Cancelled', 'AbortError')); return; }
    const abort = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      reject(new DOMException('Cancelled', 'AbortError'));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      if (captured.sample === 'error') { reject(new Error('Simulated generation error. Your whiteboard is unchanged.')); return; }
      try {
        const draft: unknown = structuredClone(captured.sample === 'warnings' ? warnings : captured.sample === 'unrecognized' ? unrecognized : flowchart);
        if (!isWhiteboardDiagramDraft(draft)) throw new Error('Invalid demo fixture.');
        const now = Date.now();
        resolve({ ...captured, draft, document: mockDraftToDocument(draft, captured.source),
          warnings: draft.warnings, documentHash: null, model: 'offline-test-fixture',
          createdAt: now, expiresAt: captured.sample === 'expired' ? now - 1 : now + 24 * 60 * 60 * 1000 });
      } catch (error) { reject(error); }
    }, 650);
    signal.addEventListener('abort', abort, { once: true });
  });
}
