import { createHash } from 'node:crypto';
import {
  isWhiteboardDiagramDraft,
  isWhiteboardDiagramDraftV2,
  isDiagramData,
  isSourceImageData,
  VECTOR_PATH_NODE_TYPE,
  SOURCE_IMAGE_NODE_TYPE,
  type PagedDiagramData,
  type WhiteboardDiagramDraft,
  type DraftBounds,
  type DraftNode,
  type DraftNodeV2,
  type DraftEdge,
  type DraftEdgeV2,
  type SourceImageData,
  type DraftWarning,
} from '@easydraw/diagram-schema';
import { PreviewPipelineError } from './preview-provider.service';

export const CONVERTER_VERSION = 'whiteboard-diagram-v2';
const NODE_TYPES = {
  rectangle: 'RectangleNode',
  'rounded-rectangle': 'RoundedRectangleNode',
  ellipse: 'EllipseNode',
  diamond: 'DiamondNode',
  database: 'DatabaseNode',
  text: 'TextNode',
} as const;

/** Reserve headroom for metadata below the client's 1 MiB response limit. */
export function assertPreviewPayloadSize(
  document: PagedDiagramData | null,
  warnings: readonly DraftWarning[],
): void {
  if (
    Buffer.byteLength(JSON.stringify({ document, warnings }), 'utf8') >
    900 * 1024
  ) {
    throw new PreviewPipelineError('preview_too_complex');
  }
}

/** Server-owned conversion: no timestamps, random IDs, arbitrary styling, URLs,
 * or client-provided graph data. The validated input is never mutated. */
export function convertPreviewDraft(
  draft: WhiteboardDiagramDraft,
  dimensions: { width: number; height: number },
  crops: ReadonlyMap<string, SourceImageData> = new Map(),
): PagedDiagramData | null {
  if (!isWhiteboardDiagramDraft(draft) && !isWhiteboardDiagramDraftV2(draft))
    throw new PreviewPipelineError('invalid_draft');
  if (
    ![dimensions.width, dimensions.height].every(
      (value) => Number.isInteger(value) && value > 0 && value <= 8192,
    ) ||
    dimensions.width * dimensions.height > 16_000_000
  ) {
    throw new PreviewPipelineError('invalid_dimensions');
  }
  if (draft.outcome === 'unrecognized') return null;
  const scale = Math.min(
    1,
    1600 / Math.max(dimensions.width, dimensions.height),
  );
  const sx = (dimensions.width * scale) / 1000;
  const sy = (dimensions.height * scale) / 1000;
  const placement = (bounds: DraftBounds) => {
    const width = Math.max(1, bounds.width * sx);
    const height = Math.max(1, bounds.height * sy);
    return {
      position: { x: bounds.x * sx, y: bounds.y * sy },
      width,
      height,
      style: { width, height },
    };
  };
  const nodes = draft.nodes.map((node: DraftNode | DraftNodeV2) => {
    let width = Math.max(
      node.shape === 'text' ? 80 : 40,
      Math.round(node.bounds.width * sx),
    );
    let height = Math.max(24, Math.round(node.bounds.height * sy));
    const nodeStyle = 'style' in node ? node.style : null;
    if (nodeStyle) {
      // V2 geometry preserves small symbols, text extents and original alignment.
      width = Math.max(1, node.bounds.width * sx);
      height = Math.max(1, node.bounds.height * sy);
    }
    return {
      id: node.id,
      type: NODE_TYPES[node.shape],
      position: {
        x: nodeStyle
          ? node.bounds.x * sx
          : Math.round(
              (node.bounds.x + node.bounds.width / 2) * sx - width / 2,
            ),
        y: nodeStyle
          ? node.bounds.y * sy
          : Math.round(
              (node.bounds.y + node.bounds.height / 2) * sy - height / 2,
            ),
      },
      width,
      height,
      style: { width, height },
      data: {
        label: node.label,
        ...(nodeStyle ? { preserveBounds: true } : {}),
        fontSize: nodeStyle?.fontSize ?? 14,
        fillColor:
          node.shape === 'text' || nodeStyle?.fill === 'none'
            ? 'transparent'
            : (nodeStyle?.fill ?? '#ffffff'),
        borderColor: nodeStyle?.stroke ?? '#526375',
        borderWidth: nodeStyle?.strokeWidth ?? 1.5,
        textColor: nodeStyle?.textColor ?? '#253349',
      },
    };
  });
  const vectorNodes =
    draft.version === 2
      ? draft.paths.map((path) => ({
          id: path.id,
          type: VECTOR_PATH_NODE_TYPE,
          ...placement(path.bounds),
          data: {
            label: path.label,
            // Clone nested commands; editor changes must never alter recognition data.
            vector: {
              ...path.geometry,
              commands: path.geometry.commands.map((command) => ({
                ...command,
                values: [...command.values],
              })),
            },
          },
        }))
      : [];
  const cropNodes =
    draft.version === 2
      ? draft.crops.map((crop) => {
          const image = crops.get(crop.id);
          if (!isSourceImageData(image))
            throw new PreviewPipelineError('invalid_document');
          return {
            id: crop.id,
            type: SOURCE_IMAGE_NODE_TYPE,
            ...placement(crop.bounds),
            data: { label: crop.label, image: { ...image } },
          };
        })
      : [];
  // Source pixels sit behind vectors and separately editable labels.
  const allNodes = [...cropNodes, ...vectorNodes, ...nodes];
  const byId = new Map(allNodes.map((node) => [node.id, node]));
  const edges = draft.edges.map((edge: DraftEdge | DraftEdgeV2) => {
    const edgeStyle = 'style' in edge ? edge.style : null;
    const from = byId.get(edge.sourceId)!;
    const to = byId.get(edge.targetId)!;
    const dx = to.position.x + to.width / 2 - from.position.x - from.width / 2;
    const dy =
      to.position.y + to.height / 2 - from.position.y - from.height / 2;
    const horizontal = Math.abs(dx) >= Math.abs(dy);
    return {
      id: edge.id,
      type: 'connection',
      source: edge.sourceId,
      target: edge.targetId,
      sourceHandle: horizontal
        ? dx >= 0
          ? 'right'
          : 'left'
        : dy >= 0
          ? 'bottom'
          : 'top',
      targetHandle:
        from.id === to.id
          ? 'top'
          : horizontal
            ? dx >= 0
              ? 'left'
              : 'right'
            : dy >= 0
              ? 'top'
              : 'bottom',
      data: {
        routing: edgeStyle?.routing ?? 'orthogonal',
        strokeColor: edgeStyle?.stroke ?? '#657a90',
        strokeWidth: edgeStyle?.strokeWidth ?? 1.5,
        ...(edgeStyle ? { lineStyle: edgeStyle.dash } : {}),
        markerStart: edge.direction === 'both' ? 'triangle' : 'none',
        markerEnd: edge.direction === 'none' ? 'none' : 'triangle',
        labels: edge.label
          ? [{ id: `${edge.id}-label`, text: edge.label, t: 0.5 }]
          : [],
      },
    };
  });
  return {
    schemaVersion: 1,
    activePageId: 'preview-page',
    pages: [{ id: 'preview-page', name: 'Preview', nodes: allNodes, edges }],
  };
}

/** Canonical JSON: lexicographically sorted object keys, unchanged array order,
 * finite numbers only. Reject non-JSON values instead of silently omitting them. */
function canonicalJson(value: unknown, ancestors = new Set<object>()): string {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return JSON.stringify(value);
  }
  if (typeof value === 'number' && Number.isFinite(value))
    return JSON.stringify(value);
  if (typeof value !== 'object' || value === null || ancestors.has(value)) {
    throw new PreviewPipelineError('invalid_document');
  }
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      if (
        Object.getPrototypeOf(value) !== Array.prototype ||
        Reflect.ownKeys(value).length !== value.length + 1
      )
        throw new PreviewPipelineError('invalid_document');
      const items: string[] = [];
      for (let index = 0; index < value.length; index++) {
        const descriptor = Object.getOwnPropertyDescriptor(
          value,
          String(index),
        );
        if (!descriptor?.enumerable || !('value' in descriptor))
          throw new PreviewPipelineError('invalid_document');
        items.push(canonicalJson(descriptor.value, ancestors));
      }
      return `[${items.join(',')}]`;
    }
    if (
      Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null
    ) {
      throw new PreviewPipelineError('invalid_document');
    }
    const keys = Reflect.ownKeys(value);
    if (keys.some((key) => typeof key !== 'string'))
      throw new PreviewPipelineError('invalid_document');
    return `{${(keys as string[])
      .sort()
      .map((key) => {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor?.enumerable || !('value' in descriptor))
          throw new PreviewPipelineError('invalid_document');
        return `${JSON.stringify(key)}:${canonicalJson(descriptor.value, ancestors)}`;
      })
      .join(',')}}`;
  } finally {
    ancestors.delete(value);
  }
}

export function hashPreviewDocument(document: PagedDiagramData): string {
  try {
    if (!isDiagramData(document))
      throw new PreviewPipelineError('invalid_document');
    return createHash('sha256').update(canonicalJson(document)).digest('hex');
  } catch {
    throw new PreviewPipelineError('invalid_document');
  }
}
