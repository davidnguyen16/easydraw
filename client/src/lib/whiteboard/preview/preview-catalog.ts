import { SOURCE_IMAGE_NODE_TYPE, VECTOR_PATH_NODE_TYPE } from '@easydraw/diagram-schema';

/** Which node types a preview may render, shared by the 2D and 3D viewers.
 * An AI result stays on the bounded catalog: a preview must never resolve
 * arbitrary account-library assets while switching views. A built-in sample
 * is asset-free code shipped with the client, so it may also use the editor's
 * CubeNode and the 3D recipes those nodes carry. */
export type PreviewCatalog = 'ai' | 'built-in';

const AI_NODE_TYPES: ReadonlySet<string> = new Set([
  'RectangleNode', 'RoundedRectangleNode', 'EllipseNode', 'DiamondNode', 'DatabaseNode', 'TextNode',
  VECTOR_PATH_NODE_TYPE, SOURCE_IMAGE_NODE_TYPE,
]);
const BUILT_IN_NODE_TYPES: ReadonlySet<string> = new Set([...AI_NODE_TYPES, 'CubeNode']);

/** Every type some catalog can render; a renderer registers these once. */
export const PREVIEW_NODE_TYPES: readonly string[] = [...BUILT_IN_NODE_TYPES];
export const UNSUPPORTED_PREVIEW_NODE = 'UnsupportedPreviewNode';

export function previewNodeType(type: string | undefined, catalog: PreviewCatalog): string {
  const allowed = catalog === 'built-in' ? BUILT_IN_NODE_TYPES : AI_NODE_TYPES;
  return type && allowed.has(type) ? type : UNSUPPORTED_PREVIEW_NODE;
}
