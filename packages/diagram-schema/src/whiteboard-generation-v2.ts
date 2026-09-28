import { createValidationResult, type ValidationIssue, type ValidationResult } from '@easydraw/shared-types';
import { finiteRange, hexColor, jsonArray, jsonRecord } from './safe-json.js';
import {
  WHITEBOARD_DIAGRAM_DRAFT_DIRECTIONS,
  WHITEBOARD_DIAGRAM_DRAFT_LIMITS,
  WHITEBOARD_DIAGRAM_DRAFT_OUTCOMES,
  WHITEBOARD_DIAGRAM_DRAFT_SCHEMA_V1,
  WHITEBOARD_DIAGRAM_DRAFT_SHAPES,
  WHITEBOARD_DIAGRAM_DRAFT_WARNING_CODES,
  type DraftBounds,
  type DraftEdge,
  type DraftNode,
  type DraftOutcome,
  type DraftWarning,
  type WhiteboardDiagramDraftV1,
} from './whiteboard-generation.js';
import {
  isVectorGeometry,
  VECTOR_GEOMETRY_LIMITS,
  VECTOR_GEOMETRY_SCHEMA,
  type VectorDash,
  type VectorGeometry,
} from './vector.js';

export const WHITEBOARD_DIAGRAM_DRAFT_LIMITS_V2 = Object.freeze({
  ...WHITEBOARD_DIAGRAM_DRAFT_LIMITS,
  maxPaths: 64,
  maxCrops: 4,
  maxTotalCommands: 512,
  maxReasonLength: 500,
} as const);

export interface DraftNodeStyleV2 {
  stroke: string;
  fill: string;
  textColor: string;
  strokeWidth: number;
  fontSize: number;
}

export interface DraftEdgeStyleV2 {
  stroke: string;
  strokeWidth: number;
  dash: VectorDash;
  routing: 'straight' | 'orthogonal' | 'curved';
}

export interface DraftNodeV2 extends DraftNode {
  style: DraftNodeStyleV2;
}

export interface DraftEdgeV2 extends DraftEdge {
  style: DraftEdgeStyleV2;
}

export interface DraftPathV2 {
  id: string;
  label: string;
  /** Full-image normalized bounds; geometry coordinates are local to these bounds. */
  bounds: DraftBounds;
  geometry: VectorGeometry;
}

export interface DraftCropV2 {
  id: string;
  label: string;
  bounds: DraftBounds;
  /** Explains why the server should preserve these source pixels. No image URL or bytes. */
  reason: string;
}

/** Provider-neutral freeform recognition, separate from the persisted Diagram.data. */
export interface WhiteboardDiagramDraftV2 {
  version: 2;
  outcome: DraftOutcome;
  nodes: DraftNodeV2[];
  edges: DraftEdgeV2[];
  paths: DraftPathV2[];
  crops: DraftCropV2[];
  warnings: DraftWarning[];
}

export type WhiteboardDiagramDraft = WhiteboardDiagramDraftV1 | WhiteboardDiagramDraftV2;

const ROOT_KEYS = ['version', 'outcome', 'nodes', 'edges', 'paths', 'crops', 'warnings'] as const;
const NODE_STYLE_KEYS = ['stroke', 'fill', 'textColor', 'strokeWidth', 'fontSize'] as const;
const EDGE_STYLE_KEYS = ['stroke', 'strokeWidth', 'dash', 'routing'] as const;
const BOUNDS_KEYS = ['x', 'y', 'width', 'height'] as const;
const idSchema = WHITEBOARD_DIAGRAM_DRAFT_SCHEMA_V1.properties.nodes.items.properties.id;
const labelSchema = WHITEBOARD_DIAGRAM_DRAFT_SCHEMA_V1.properties.nodes.items.properties.label;
const boundsSchema = WHITEBOARD_DIAGRAM_DRAFT_SCHEMA_V1.properties.nodes.items.properties.bounds;
const colorSchema = { type: 'string', pattern: '^#[A-Fa-f0-9]{6}$' } as const;
const strokeWidthSchema = { type: 'number', minimum: 0, maximum: VECTOR_GEOMETRY_LIMITS.maxStrokeWidth } as const;

/**
 * Every object is closed and every property required for provider strict output.
 * The validator also checks command ordering, contained bounds, total commands,
 * globally unique IDs, references and outcome rules. All label text stays plain.
 */
export const WHITEBOARD_DIAGRAM_DRAFT_SCHEMA_V2 = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'WhiteboardDiagramDraftV2',
  type: 'object',
  additionalProperties: false,
  required: ROOT_KEYS,
  properties: {
    version: { type: 'integer', const: 2 },
    outcome: { type: 'string', enum: WHITEBOARD_DIAGRAM_DRAFT_OUTCOMES },
    nodes: {
      type: 'array', maxItems: WHITEBOARD_DIAGRAM_DRAFT_LIMITS_V2.maxNodes,
      items: {
        type: 'object', additionalProperties: false,
        required: ['id', 'shape', 'label', 'bounds', 'style'],
        properties: {
          ...WHITEBOARD_DIAGRAM_DRAFT_SCHEMA_V1.properties.nodes.items.properties,
          style: {
            type: 'object', additionalProperties: false, required: NODE_STYLE_KEYS,
            properties: {
              stroke: colorSchema,
              fill: { anyOf: [colorSchema, { type: 'string', const: 'none' }] },
              textColor: colorSchema,
              strokeWidth: strokeWidthSchema,
              fontSize: { type: 'number', minimum: 8, maximum: 72 },
            },
          },
        },
      },
    },
    edges: {
      type: 'array', maxItems: WHITEBOARD_DIAGRAM_DRAFT_LIMITS_V2.maxEdges,
      items: {
        type: 'object', additionalProperties: false,
        required: ['id', 'sourceId', 'targetId', 'label', 'direction', 'style'],
        properties: {
          ...WHITEBOARD_DIAGRAM_DRAFT_SCHEMA_V1.properties.edges.items.properties,
          style: {
            type: 'object', additionalProperties: false, required: EDGE_STYLE_KEYS,
            properties: {
              stroke: colorSchema,
              strokeWidth: strokeWidthSchema,
              dash: { type: 'string', enum: ['solid', 'dashed', 'dotted'] },
              routing: { type: 'string', enum: ['straight', 'orthogonal', 'curved'] },
            },
          },
        },
      },
    },
    paths: {
      type: 'array', maxItems: WHITEBOARD_DIAGRAM_DRAFT_LIMITS_V2.maxPaths,
      items: {
        type: 'object', additionalProperties: false,
        required: ['id', 'label', 'bounds', 'geometry'],
        properties: { id: idSchema, label: labelSchema, bounds: boundsSchema, geometry: VECTOR_GEOMETRY_SCHEMA },
      },
    },
    crops: {
      type: 'array', maxItems: WHITEBOARD_DIAGRAM_DRAFT_LIMITS_V2.maxCrops,
      items: {
        type: 'object', additionalProperties: false,
        required: ['id', 'label', 'bounds', 'reason'],
        properties: {
          id: idSchema, label: labelSchema, bounds: boundsSchema,
          reason: { type: 'string', maxLength: WHITEBOARD_DIAGRAM_DRAFT_LIMITS_V2.maxReasonLength },
        },
      },
    },
    warnings: WHITEBOARD_DIAGRAM_DRAFT_SCHEMA_V1.properties.warnings,
  },
} as const;

/** Bounded, immutable validation of plain JSON and relationships. V1 is unchanged. */
export function validateWhiteboardDiagramDraftV2(value: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];
  const issue = (code: string, path: string, message: string) => {
    if (issues.length < 32) issues.push({ code: `whiteboard_draft.${code}`, path, message, severity: 'error' });
  };
  const record = (input: unknown, keys: readonly string[], path: string) => {
    const result = jsonRecord(input, keys);
    if (!result) issue('invalid_object', path, 'Expected a plain JSON object with exactly the required data fields.');
    return result;
  };
  const array = (input: unknown, maximum: number, path: string) => {
    const result = jsonArray(input, maximum);
    if (!result) issue('invalid_array', path, `Expected a dense plain JSON array of at most ${maximum} items.`);
    return result;
  };
  const id = (input: unknown, path: string): input is string => {
    if (typeof input === 'string' && input.length <= 64 && /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(input)) return true;
    issue('invalid_id', path, 'IDs must start with an ASCII letter and contain only letters, digits, underscores or hyphens, up to 64 characters.');
    return false;
  };
  const text = (input: unknown, path: string) => {
    if (typeof input !== 'string' || input.length > 500) issue('invalid_text', path, 'Expected a string of at most 500 UTF-16 code units.');
  };
  const choice = (input: unknown, choices: readonly string[], path: string) => {
    if (typeof input !== 'string' || !choices.includes(input)) issue('invalid_enum', path, 'The value is not supported by this draft version.');
  };
  const color = (input: unknown, path: string, allowNone = false) => {
    if (!hexColor(input) && !(allowNone && input === 'none')) issue('invalid_color', path, 'Expected a six-digit hexadecimal color' + (allowNone ? ' or none.' : '.'));
  };
  const range = (input: unknown, minimum: number, maximum: number, path: string) => {
    if (!finiteRange(input, minimum, maximum)) issue('invalid_number', path, `Expected a finite number from ${minimum} to ${maximum}.`);
  };
  const bounds = (input: unknown, path: string) => {
    const object = record(input, BOUNDS_KEYS, path);
    if (!object) return;
    let valid = true;
    for (const key of BOUNDS_KEYS) {
      if (!finiteRange(object[key], key === 'x' || key === 'y' ? 0 : 1, 1000) || !Number.isInteger(object[key])) {
        valid = false;
        issue('invalid_bounds', `${path}.${key}`, 'Expected an integer within the full-image normalized 1000 by 1000 canvas, with positive dimensions.');
      }
    }
    if (valid && ((object.x as number) + (object.width as number) > 1000 || (object.y as number) + (object.height as number) > 1000)) {
      issue('invalid_bounds', path, 'The full rectangle must fit inside the source image.');
    }
  };

  try {
    const draft = record(value, ROOT_KEYS, '$');
    if (!draft) return createValidationResult(issues);
    if (draft.version !== 2) issue('invalid_version', '$.version', 'Only whiteboard diagram draft version 2 is supported.');
    choice(draft.outcome, WHITEBOARD_DIAGRAM_DRAFT_OUTCOMES, '$.outcome');
    const nodes = array(draft.nodes, WHITEBOARD_DIAGRAM_DRAFT_LIMITS_V2.maxNodes, '$.nodes');
    const paths = array(draft.paths, WHITEBOARD_DIAGRAM_DRAFT_LIMITS_V2.maxPaths, '$.paths');
    const crops = array(draft.crops, WHITEBOARD_DIAGRAM_DRAFT_LIMITS_V2.maxCrops, '$.crops');
    const edges = array(draft.edges, WHITEBOARD_DIAGRAM_DRAFT_LIMITS_V2.maxEdges, '$.edges');
    const warnings = array(draft.warnings, WHITEBOARD_DIAGRAM_DRAFT_LIMITS_V2.maxWarnings, '$.warnings');
    const elementIds = new Set<string>();
    const endpointIds = new Set<string>();
    const registerId = (input: unknown, path: string, endpoint: boolean) => {
      if (!id(input, path)) return;
      if (elementIds.has(input)) issue('duplicate_id', path, 'All node, path, crop and edge IDs must be globally unique.');
      elementIds.add(input);
      if (endpoint) endpointIds.add(input);
    };

    for (const [index, input] of (nodes ?? []).entries()) {
      const path = `$.nodes[${index}]`;
      const node = record(input, ['id', 'shape', 'label', 'bounds', 'style'], path);
      if (!node) continue;
      registerId(node.id, `${path}.id`, true);
      choice(node.shape, WHITEBOARD_DIAGRAM_DRAFT_SHAPES, `${path}.shape`);
      text(node.label, `${path}.label`);
      bounds(node.bounds, `${path}.bounds`);
      const style = record(node.style, NODE_STYLE_KEYS, `${path}.style`);
      if (style) {
        color(style.stroke, `${path}.style.stroke`);
        color(style.fill, `${path}.style.fill`, true);
        color(style.textColor, `${path}.style.textColor`);
        range(style.strokeWidth, 0, 12, `${path}.style.strokeWidth`);
        range(style.fontSize, 8, 72, `${path}.style.fontSize`);
      }
    }

    let totalCommands = 0;
    for (const [index, input] of (paths ?? []).entries()) {
      const path = `$.paths[${index}]`;
      const vector = record(input, ['id', 'label', 'bounds', 'geometry'], path);
      if (!vector) continue;
      registerId(vector.id, `${path}.id`, true);
      text(vector.label, `${path}.label`);
      bounds(vector.bounds, `${path}.bounds`);
      const geometry = jsonRecord(vector.geometry, VECTOR_GEOMETRY_SCHEMA.required);
      const commands = geometry ? jsonArray(geometry.commands, VECTOR_GEOMETRY_LIMITS.maxCommands) : null;
      totalCommands += commands?.length ?? 0;
      if (totalCommands > WHITEBOARD_DIAGRAM_DRAFT_LIMITS_V2.maxTotalCommands) {
        issue('limit_exceeded', '$.paths', 'A draft must contain at most 512 vector commands in total.');
        break;
      }
      if (!isVectorGeometry(vector.geometry)) issue('invalid_geometry', `${path}.geometry`, 'Expected bounded local numeric vector geometry with valid commands and safe colors.');
    }

    for (const [index, input] of (crops ?? []).entries()) {
      const path = `$.crops[${index}]`;
      const crop = record(input, ['id', 'label', 'bounds', 'reason'], path);
      if (!crop) continue;
      registerId(crop.id, `${path}.id`, true);
      text(crop.label, `${path}.label`);
      text(crop.reason, `${path}.reason`);
      bounds(crop.bounds, `${path}.bounds`);
    }

    for (const [index, input] of (edges ?? []).entries()) {
      const path = `$.edges[${index}]`;
      const edge = record(input, ['id', 'sourceId', 'targetId', 'label', 'direction', 'style'], path);
      if (!edge) continue;
      registerId(edge.id, `${path}.id`, false);
      for (const key of ['sourceId', 'targetId'] as const) {
        if (id(edge[key], `${path}.${key}`) && !endpointIds.has(edge[key])) issue('unknown_reference', `${path}.${key}`, 'Connections must reference an existing node, path or crop.');
      }
      text(edge.label, `${path}.label`);
      choice(edge.direction, WHITEBOARD_DIAGRAM_DRAFT_DIRECTIONS, `${path}.direction`);
      const style = record(edge.style, EDGE_STYLE_KEYS, `${path}.style`);
      if (style) {
        color(style.stroke, `${path}.style.stroke`);
        range(style.strokeWidth, 0, 12, `${path}.style.strokeWidth`);
        choice(style.dash, ['solid', 'dashed', 'dotted'], `${path}.style.dash`);
        choice(style.routing, ['straight', 'orthogonal', 'curved'], `${path}.style.routing`);
      }
    }

    for (const [index, input] of (warnings ?? []).entries()) {
      const path = `$.warnings[${index}]`;
      const warning = record(input, ['code', 'message', 'elementId'], path);
      if (!warning) continue;
      choice(warning.code, WHITEBOARD_DIAGRAM_DRAFT_WARNING_CODES, `${path}.code`);
      if (typeof warning.message !== 'string' || warning.message.length > 500 || !warning.message.trim()) {
        issue('invalid_text', `${path}.message`, 'Warning messages must be nonblank strings of at most 500 UTF-16 code units.');
      }
      if (warning.elementId !== null && id(warning.elementId, `${path}.elementId`) && !elementIds.has(warning.elementId)) {
        issue('unknown_reference', `${path}.elementId`, 'Warnings must reference an existing element, or null for the entire drawing.');
      }
    }

    if (draft.outcome === 'diagram' && nodes?.length === 0 && paths?.length === 0 && crops?.length === 0) {
      issue('invalid_outcome', '$.outcome', 'A diagram outcome must contain at least one node, path or crop.');
    }
    if (draft.outcome === 'unrecognized') {
      for (const [key, items] of [['nodes', nodes], ['edges', edges], ['paths', paths], ['crops', crops]] as const) {
        if (items && items.length !== 0) issue('invalid_outcome', `$.${key}`, 'An unrecognized outcome must contain no diagram elements.');
      }
      if (warnings?.length === 0) issue('invalid_outcome', '$.warnings', 'An unrecognized outcome must explain the result with at least one warning.');
    }
  } catch {
    issue('invalid_object', '$', 'The draft must contain readable plain JSON values only.');
  }
  return createValidationResult(issues);
}

export function isWhiteboardDiagramDraftV2(value: unknown): value is WhiteboardDiagramDraftV2 {
  return validateWhiteboardDiagramDraftV2(value).valid;
}
