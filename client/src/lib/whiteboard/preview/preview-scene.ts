import type { PagedDiagramData } from '@easydraw/diagram-schema';
import type { Edge, Node } from '@xyflow/react';
import { buildDiagramScene } from '@/lib/diagram3d/scene-model';
import { previewNodeType, UNSUPPORTED_PREVIEW_NODE, type PreviewCatalog } from './preview-catalog';

const finite = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value)
  ? value as Record<string, unknown> : {};

/** Project the existing reviewed graph; never regenerate, save, edit or attach
 * camera state to its document. This clone belongs only to the renderer. */
export function createPreviewScene(document: PagedDiagramData, catalog: PreviewCatalog = 'ai') {
  const page = structuredClone(document.pages.find((item) => item.id === document.activePageId) ?? document.pages[0]);
  if (!page) return buildDiagramScene([], []);
  const nodes: Node[] = page.nodes.map((node) => ({
    id: node.id,
    type: previewNodeType(node.type, catalog),
    position: { x: finite(node.position?.x, 0), y: finite(node.position?.y, 0) },
    width: Math.max(1, finite(node.width, 160)),
    height: Math.max(1, finite(node.height, node.type === 'TextNode' ? 40 : 80)),
    data: record(node.data),
    selected: false,
  }));
  const ids = new Set(nodes.map((node) => node.id));
  const edges: Edge[] = page.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target)).map((edge) => ({
    id: edge.id, type: 'connection', source: edge.source, target: edge.target,
    sourceHandle: typeof edge.sourceHandle === 'string' ? edge.sourceHandle : 'right',
    targetHandle: typeof edge.targetHandle === 'string' ? edge.targetHandle : 'left',
    data: record(edge.data), selected: false,
  }));
  const model = buildDiagramScene(nodes, edges, { origin: page.view3d?.origin });
  for (const node of nodes) {
    if (node.type === UNSUPPORTED_PREVIEW_NODE) model.warnings.push(`Unsupported preview object ${node.id}: shown as a placeholder, not an inferred 3D shape.`);
  }
  return model;
}
