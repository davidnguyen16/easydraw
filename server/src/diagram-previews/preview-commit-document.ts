import {
  isSourceImageData,
  isVectorGeometry,
  SOURCE_IMAGE_NODE_TYPE,
  VECTOR_PATH_NODE_TYPE,
  type PagedDiagramData,
} from '@easydraw/diagram-schema';
import {
  assertPreviewPayloadSize,
  hashPreviewDocument,
} from './preview-converter';
import { readStoredPreview } from './preview-refinement';
import { PreviewPipelineError } from './preview-provider.service';

const SHAPES = new Set([
  'RectangleNode',
  'RoundedRectangleNode',
  'EllipseNode',
  'DiamondNode',
  'DatabaseNode',
  'TextNode',
]);
const finite = (n: unknown): n is number =>
  typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 1_000_000;

/** Validate the frozen converter output without converting, laying out, or
 * renaming anything. Both historical V1 graphs and V2 artwork are supported. */
export function readCommitDocument(
  stored: unknown,
  expectedHash: string,
): PagedDiagramData {
  const document = readStoredPreview(stored).document;
  assertPreviewPayloadSize(document, []);
  if (
    hashPreviewDocument(document) !== expectedHash ||
    document.pages.length !== 1
  )
    throw new PreviewPipelineError('invalid_document');
  const page = document.pages[0];
  if (!page.nodes.length || page.nodes.length > 118 || page.edges.length > 100)
    throw new PreviewPipelineError('invalid_document');
  const nodes = new Set<string>(),
    edges = new Set<string>();
  let shapes = 0,
    vectors = 0,
    crops = 0,
    commands = 0;
  for (const node of page.nodes) {
    if (
      nodes.has(node.id) ||
      !node.position ||
      !finite(node.position.x) ||
      !finite(node.position.y) ||
      !finite(node.width) ||
      node.width <= 0 ||
      !finite(node.height) ||
      node.height <= 0 ||
      !node.data ||
      typeof node.data.label !== 'string' ||
      node.data.label.length > 10_000
    )
      throw new PreviewPipelineError('invalid_document');
    nodes.add(node.id);
    if (node.type === VECTOR_PATH_NODE_TYPE) {
      if (++vectors > 64 || !isVectorGeometry(node.data.vector))
        throw new PreviewPipelineError('invalid_document');
      commands += node.data.vector.commands.length;
      if (commands > 512) throw new PreviewPipelineError('invalid_document');
    } else if (node.type === SOURCE_IMAGE_NODE_TYPE) {
      if (++crops > 4 || !isSourceImageData(node.data.image))
        throw new PreviewPipelineError('invalid_document');
    } else if (!SHAPES.has(node.type ?? '') || ++shapes > 50) {
      // AI previews cannot smuggle private custom-library asset references.
      throw new PreviewPipelineError('invalid_document');
    }
  }
  for (const edge of page.edges) {
    if (
      edges.has(edge.id) ||
      edge.type !== 'connection' ||
      !nodes.has(edge.source) ||
      !nodes.has(edge.target)
    )
      throw new PreviewPipelineError('invalid_document');
    edges.add(edge.id);
  }
  return document;
}
