import {
  createValidationResult,
  type EdgeId,
  type NodeId,
  type ValidationIssue,
  type ValidationResult,
} from '@easydraw/shared-types';

export const DIAGRAM_DATA_SCHEMA_VERSION = 1 as const;

/** One permanent renderer type for every user-uploaded image. */
export const CUSTOM_IMAGE_NODE_TYPE = 'CustomImageNode' as const;

export interface CustomImageNodeData extends Record<string, unknown> {
  /** Immutable, authorized asset reference; never a signed or blob URL. */
  assetId: string;
  definitionId?: string;
  label: string;
  intrinsicWidth: number;
  intrinsicHeight: number;
  fit: 'contain';
}

export function isCustomImageNodeData(value: unknown): value is CustomImageNodeData {
  if (!isRecord(value)) return false;
  return typeof value.assetId === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value.assetId) &&
    (value.definitionId === undefined || typeof value.definitionId === 'string' &&
      /^[a-zA-Z0-9_-]{1,128}$/.test(value.definitionId)) &&
    typeof value.label === 'string' && value.label.length <= 10_000 &&
    typeof value.intrinsicWidth === 'number' && Number.isFinite(value.intrinsicWidth) &&
    value.intrinsicWidth > 0 && value.intrinsicWidth <= 16_384 &&
    typeof value.intrinsicHeight === 'number' && Number.isFinite(value.intrinsicHeight) &&
    value.intrinsicHeight > 0 && value.intrinsicHeight <= 16_384 && value.fit === 'contain' &&
    !['url', 'src', 'signedUrl', 'objectUrl', 'thumbnailUrl'].some((key) => key in value);
}

export interface DiagramPoint {
  x: number;
  y: number;
}

/** Camera only: changing a 3D view never rewrites the 2D graph coordinates. */
export interface DiagramCamera3D {
  position: [number, number, number];
  target: [number, number, number];
}

export interface DiagramView3D {
  version: 1;
  camera?: DiagramCamera3D;
  /** Stable scene origin used by the camera while the shared graph is edited. */
  origin?: [number, number, number];
  /** Presentation only: never changes the shared 2D graph coordinates. */
  orientation?: 'floor' | 'upright';
  /** Optional 3D-only grid preference; absent on legacy documents. */
  showGrid?: boolean;
}

function isSpatialVector(vector: unknown): vector is [number, number, number] {
  return Array.isArray(vector) && vector.length === 3 &&
    [0, 1, 2].every((index) => typeof vector[index] === 'number' &&
      Number.isFinite(vector[index]) && Math.abs(vector[index]) <= 1_000_000);
}

export function isDiagramCamera3D(value: unknown): value is DiagramCamera3D {
  if (!isRecord(value)) return false;
  if (!isSpatialVector(value.position) || !isSpatialVector(value.target)) return false;
  const { position, target } = value;
  return Math.hypot(position[0] - target[0], position[1] - target[1], position[2] - target[2]) > 0.0001;
}

export function isDiagramView3D(value: unknown): value is DiagramView3D {
  return isRecord(value) && value.version === 1 &&
    (value.camera === undefined || isDiagramCamera3D(value.camera)) &&
    (value.origin === undefined || isSpatialVector(value.origin)) &&
    (value.orientation === undefined || value.orientation === 'floor' || value.orientation === 'upright') &&
    (value.showGrid === undefined || typeof value.showGrid === 'boolean');
}

/** Framework-neutral subset of a persisted canvas node. */
export interface DiagramNode<TData extends Record<string, unknown> = Record<string, unknown>> {
  id: NodeId;
  type?: string;
  position?: DiagramPoint;
  data?: TData;
  [key: string]: unknown;
}

/** Framework-neutral subset of a persisted canvas edge. */
export interface DiagramEdge<TData extends Record<string, unknown> = Record<string, unknown>> {
  id: EdgeId;
  source: NodeId;
  target: NodeId;
  type?: string;
  data?: TData;
  [key: string]: unknown;
}

export interface DiagramPage {
  id: string;
  name: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  /** Optional presentation state. Legacy documents do not need this field. */
  view3d?: DiagramView3D;
}

interface DiagramDataBase {
  /** Missing on legacy documents; new writes use version 1. */
  schemaVersion?: typeof DIAGRAM_DATA_SCHEMA_VERSION;
  fileName?: string;
  status?: string;
}

/** Current EasyDraw persistence shape: a document containing one or more pages. */
export interface PagedDiagramData extends DiagramDataBase {
  pages: DiagramPage[];
  activePageId: string;
}

/** Supported for pack fixtures and importers that expose a single canvas directly. */
export interface FlatDiagramData extends DiagramDataBase {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

/** JSON stored in Prisma's existing Diagram.data column. */
export type DiagramData = PagedDiagramData | FlatDiagramData;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNode(value: unknown): value is DiagramNode {
  return isRecord(value) && typeof value.id === 'string' && value.id.length > 0;
}

function isEdge(value: unknown): value is DiagramEdge {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.source === 'string' &&
    typeof value.target === 'string'
  );
}

function isPage(value: unknown): value is DiagramPage {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.name === 'string' &&
    Array.isArray(value.nodes) &&
    value.nodes.every(isNode) &&
    Array.isArray(value.edges) &&
    value.edges.every(isEdge)
  );
}

export function isDiagramData(value: unknown): value is DiagramData {
  if (!isRecord(value)) return false;
  if (
    value.schemaVersion !== undefined &&
    value.schemaVersion !== DIAGRAM_DATA_SCHEMA_VERSION
  ) {
    return false;
  }

  if (Array.isArray(value.pages)) {
    return (
      typeof value.activePageId === 'string' &&
      value.pages.length > 0 &&
      value.pages.every(isPage) &&
      value.pages.some((page) => page.id === value.activePageId)
    );
  }

  return (
    Array.isArray(value.nodes) &&
    value.nodes.every(isNode) &&
    Array.isArray(value.edges) &&
    value.edges.every(isEdge)
  );
}

export function validateDiagramData(value: unknown): ValidationResult {
  if (isDiagramData(value)) return createValidationResult([]);

  const issues: ValidationIssue[] = [
    {
      code: 'diagram.invalid_document',
      message:
        'Diagram data must contain either a valid pages/activePageId document or nodes/edges canvas.',
      path: '$',
      severity: 'error',
    },
  ];
  return createValidationResult(issues);
}

export function getDiagramNodes(diagram: DiagramData): readonly DiagramNode[] {
  return 'pages' in diagram ? diagram.pages.flatMap((page) => page.nodes) : diagram.nodes;
}

export function getDiagramEdges(diagram: DiagramData): readonly DiagramEdge[] {
  return 'pages' in diagram ? diagram.pages.flatMap((page) => page.edges) : diagram.edges;
}

export function getDiagramNodeIds(diagram: DiagramData): ReadonlySet<NodeId> {
  return new Set(getDiagramNodes(diagram).map((node) => node.id));
}

export {
  VISUAL3D_SHAPES,
  VISUAL3D_MATERIALS,
  MAX_VISUAL3D_PARTS,
  MAX_VISUAL3D_EXTENT,
  MAX_VISUAL3D_OFFSET,
  MAX_VISUAL3D_SIZE_PX,
  MAX_VISUAL3D_DEPTH,
  validateVisual3DPart,
  validateVisual3DRecipe,
  isVisual3DRecipe,
  cloneVisual3DPart,
  cloneVisual3DRecipe,
  type Visual3DShape,
  type Visual3DMaterial,
  type Visual3DVector,
  type Visual3DPart,
  type Visual3DSize,
  type Visual3DRecipe,
} from './visual3d.js';

// Provider-neutral AI draft contract; not a replacement for persisted DiagramData.
export {
  WHITEBOARD_DIAGRAM_DRAFT_SCHEMA_V1,
  WHITEBOARD_DIAGRAM_DRAFT_LIMITS,
  WHITEBOARD_DIAGRAM_DRAFT_SHAPES,
  WHITEBOARD_DIAGRAM_DRAFT_DIRECTIONS,
  WHITEBOARD_DIAGRAM_DRAFT_OUTCOMES,
  WHITEBOARD_DIAGRAM_DRAFT_WARNING_CODES,
  validateWhiteboardDiagramDraft,
  isWhiteboardDiagramDraft,
  type DraftShape,
  type DraftDirection,
  type DraftOutcome,
  type DraftWarningCode,
  type DraftBounds,
  type DraftNode,
  type DraftEdge,
  type DraftWarning,
  type WhiteboardDiagramDraftV1,
} from './whiteboard-generation.js';

export {
  VECTOR_PATH_NODE_TYPE,
  VECTOR_GEOMETRY_LIMITS,
  VECTOR_GEOMETRY_SCHEMA,
  SOURCE_IMAGE_NODE_TYPE,
  SOURCE_IMAGE_LIMITS,
  isVectorGeometry,
  vectorPathData,
  isSourceImageData,
  type VectorCommand,
  type VectorGeometry,
  type VectorDash,
  type SourceImageData,
} from './vector.js';

export {
  WHITEBOARD_DIAGRAM_DRAFT_SCHEMA_V2,
  WHITEBOARD_DIAGRAM_DRAFT_LIMITS_V2,
  isWhiteboardDiagramDraftV2,
  validateWhiteboardDiagramDraftV2,
  type DraftNodeStyleV2,
  type DraftEdgeStyleV2,
  type DraftNodeV2,
  type DraftEdgeV2,
  type DraftPathV2,
  type DraftCropV2,
  type WhiteboardDiagramDraftV2,
  type WhiteboardDiagramDraft,
} from './whiteboard-generation-v2.js';
