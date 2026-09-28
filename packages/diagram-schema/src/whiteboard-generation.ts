import {
  createValidationResult,
  type ValidationIssue,
  type ValidationResult,
} from '@easydraw/shared-types';

export const WHITEBOARD_DIAGRAM_DRAFT_LIMITS = Object.freeze({
  maxNodes: 50,
  maxEdges: 100,
  maxWarnings: 30,
  maxLabelLength: 500,
  maxWarningMessageLength: 500,
  maxIdLength: 64,
  coordinateMax: 1000,
} as const);

export const WHITEBOARD_DIAGRAM_DRAFT_SHAPES = Object.freeze([
  'rectangle', 'rounded-rectangle', 'ellipse', 'diamond', 'database', 'text',
] as const);
export const WHITEBOARD_DIAGRAM_DRAFT_DIRECTIONS = Object.freeze(['none', 'forward', 'both'] as const);
export const WHITEBOARD_DIAGRAM_DRAFT_OUTCOMES = Object.freeze(['diagram', 'unrecognized'] as const);
export const WHITEBOARD_DIAGRAM_DRAFT_WARNING_CODES = Object.freeze([
  'unreadable-text', 'ambiguous-shape', 'ambiguous-connection', 'unsupported-content',
] as const);

export type DraftShape = typeof WHITEBOARD_DIAGRAM_DRAFT_SHAPES[number];
export type DraftDirection = typeof WHITEBOARD_DIAGRAM_DRAFT_DIRECTIONS[number];
export type DraftOutcome = typeof WHITEBOARD_DIAGRAM_DRAFT_OUTCOMES[number];
export type DraftWarningCode = typeof WHITEBOARD_DIAGRAM_DRAFT_WARNING_CODES[number];

/** Integer coordinates on a normalized 1000 × 1000 input canvas. */
export interface DraftBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DraftNode {
  id: string;
  shape: DraftShape;
  label: string;
  bounds: DraftBounds;
}

export interface DraftEdge {
  id: string;
  sourceId: string;
  targetId: string;
  label: string;
  direction: DraftDirection;
}

export interface DraftWarning {
  code: DraftWarningCode;
  message: string;
  elementId: string | null;
}

/**
 * Provider-neutral recognition result, not the persisted Diagram.data document.
 * An `unrecognized` result is valid but cannot be converted into a diagram.
 * Validation establishes a bounded data contract, not whether an AI correctly
 * understood the drawing. Semantic relationships must also pass the server
 * validator; successful JSON Schema validation alone is insufficient.
 */
export interface WhiteboardDiagramDraftV1 {
  version: 1;
  outcome: DraftOutcome;
  nodes: DraftNode[];
  edges: DraftEdge[];
  warnings: DraftWarning[];
}

const ID_PATTERN = '^[A-Za-z][A-Za-z0-9_-]{0,63}$';
const ID_REGEX = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const idSchema = {
  type: 'string', minLength: 1, maxLength: WHITEBOARD_DIAGRAM_DRAFT_LIMITS.maxIdLength, pattern: ID_PATTERN,
} as const;
const labelSchema = { type: 'string', maxLength: WHITEBOARD_DIAGRAM_DRAFT_LIMITS.maxLabelLength } as const;

/**
 * Standard JSON Schema, without any AI-provider-specific request envelope.
 * All fields are required and objects are closed. The server validator below
 * additionally enforces global ID uniqueness, references, contained bounds and
 * outcome rules. JSON Schema string lengths count Unicode code points, whereas
 * this contract's server limit counts UTF-16 code units (`string.length`).
 * Neither kind of validation proves the recognition is semantically correct.
 */
export const WHITEBOARD_DIAGRAM_DRAFT_SCHEMA_V1 = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'WhiteboardDiagramDraftV1',
  type: 'object',
  additionalProperties: false,
  required: ['version', 'outcome', 'nodes', 'edges', 'warnings'],
  properties: {
    version: { type: 'integer', const: 1 },
    outcome: { type: 'string', enum: WHITEBOARD_DIAGRAM_DRAFT_OUTCOMES },
    nodes: {
      type: 'array',
      maxItems: WHITEBOARD_DIAGRAM_DRAFT_LIMITS.maxNodes,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'shape', 'label', 'bounds'],
        properties: {
          id: idSchema,
          shape: { type: 'string', enum: WHITEBOARD_DIAGRAM_DRAFT_SHAPES },
          label: labelSchema,
          bounds: {
            type: 'object',
            additionalProperties: false,
            required: ['x', 'y', 'width', 'height'],
            properties: {
              x: { type: 'integer', minimum: 0, maximum: WHITEBOARD_DIAGRAM_DRAFT_LIMITS.coordinateMax },
              y: { type: 'integer', minimum: 0, maximum: WHITEBOARD_DIAGRAM_DRAFT_LIMITS.coordinateMax },
              width: { type: 'integer', minimum: 1, maximum: WHITEBOARD_DIAGRAM_DRAFT_LIMITS.coordinateMax },
              height: { type: 'integer', minimum: 1, maximum: WHITEBOARD_DIAGRAM_DRAFT_LIMITS.coordinateMax },
            },
          },
        },
      },
    },
    edges: {
      type: 'array',
      maxItems: WHITEBOARD_DIAGRAM_DRAFT_LIMITS.maxEdges,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'sourceId', 'targetId', 'label', 'direction'],
        properties: {
          id: idSchema,
          sourceId: idSchema,
          targetId: idSchema,
          label: labelSchema,
          direction: { type: 'string', enum: WHITEBOARD_DIAGRAM_DRAFT_DIRECTIONS },
        },
      },
    },
    warnings: {
      type: 'array',
      maxItems: WHITEBOARD_DIAGRAM_DRAFT_LIMITS.maxWarnings,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['code', 'message', 'elementId'],
        properties: {
          code: { type: 'string', enum: WHITEBOARD_DIAGRAM_DRAFT_WARNING_CODES },
          message: { type: 'string', minLength: 1, maxLength: WHITEBOARD_DIAGRAM_DRAFT_LIMITS.maxWarningMessageLength, pattern: '\\S' },
          elementId: { anyOf: [idSchema, { type: 'null' }] },
        },
      },
    },
  },
} as const;

const ROOT_KEYS = ['version', 'outcome', 'nodes', 'edges', 'warnings'] as const;
const NODE_KEYS = ['id', 'shape', 'label', 'bounds'] as const;
const EDGE_KEYS = ['id', 'sourceId', 'targetId', 'label', 'direction'] as const;
const WARNING_KEYS = ['code', 'message', 'elementId'] as const;
const BOUNDS_KEYS = ['x', 'y', 'width', 'height'] as const;
const MAX_VALIDATION_ISSUES = 32;

/**
 * Validates structure and cross-field constraints without mutating the input.
 * Work over arrays is bounded by the contract limits; errors are capped. Plain
 * JSON records (including null-prototype records) are accepted, but additional
 * properties, symbols, accessors and custom prototypes are not. Even malformed
 * proxies return an invalid result rather than throwing out of this boundary.
 */
export function validateWhiteboardDiagramDraft(value: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];
  const issue = (code: string, path: string, message: string) => {
    if (issues.length < MAX_VALIDATION_ISSUES) issues.push({ code: `whiteboard_draft.${code}`, path, message, severity: 'error' });
  };

  function record(input: unknown, keys: readonly string[], path: string): Record<string, unknown> | null {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      issue('invalid_object', path, 'Expected a JSON object with exactly the required fields.');
      return null;
    }
    const prototype: unknown = Object.getPrototypeOf(input);
    if (prototype !== Object.prototype && prototype !== null) {
      issue('invalid_object', path, 'Custom object prototypes are not allowed.');
      return null;
    }
    const ownKeys = Reflect.ownKeys(input);
    if (ownKeys.length !== keys.length || ownKeys.some((key) => typeof key !== 'string' || !keys.includes(key))) {
      issue('invalid_object', path, 'All required fields must be present; additional fields are not allowed.');
      return null;
    }
    const result = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(input, key);
      if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) {
        issue('invalid_object', `${path}.${key}`, 'Expected an own, enumerable JSON value, not an accessor.');
        return null;
      }
      result[key] = descriptor.value as unknown;
    }
    return result;
  }

  function array(input: unknown, maximum: number, path: string): unknown[] | null {
    if (!Array.isArray(input) || Object.getPrototypeOf(input) !== Array.prototype) {
      issue('invalid_array', path, 'Expected a JSON array.');
      return null;
    }
    const length: unknown = Object.getOwnPropertyDescriptor(input, 'length')?.value;
    if (typeof length !== 'number' || !Number.isInteger(length) || length < 0 || length > maximum) {
      issue('limit_exceeded', path, `Expected at most ${maximum} items.`);
      return null;
    }
    // Check the length before inspecting keys or items of an oversized array.
    if (Reflect.ownKeys(input).length !== length + 1) {
      issue('invalid_array', path, 'Sparse arrays and additional array properties are not allowed.');
      return null;
    }
    const result: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(input, String(index));
      if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) {
        issue('invalid_array', `${path}[${index}]`, 'Expected an own JSON array item, not a missing item or accessor.');
        return null;
      }
      result.push(descriptor.value as unknown);
    }
    return result;
  }

  function id(input: unknown, path: string): input is string {
    if (typeof input === 'string' && input.length <= WHITEBOARD_DIAGRAM_DRAFT_LIMITS.maxIdLength && ID_REGEX.test(input)) return true;
    issue('invalid_id', path, 'IDs must start with an ASCII letter and contain only letters, digits, underscores or hyphens, up to 64 characters.');
    return false;
  }

  function label(input: unknown, path: string): void {
    if (typeof input !== 'string' || input.length > WHITEBOARD_DIAGRAM_DRAFT_LIMITS.maxLabelLength) {
      issue('invalid_text', path, 'Labels must be strings of at most 500 UTF-16 code units; an empty label is allowed.');
    }
  }

  function choice(input: unknown, choices: readonly string[], path: string): void {
    if (typeof input !== 'string' || !choices.includes(input)) issue('invalid_enum', path, 'The value is not supported by this draft version.');
  }

  function bounds(input: unknown, path: string): void {
    const object = record(input, BOUNDS_KEYS, path);
    if (!object) return;
    let valid = true;
    for (const key of BOUNDS_KEYS) {
      const coordinate = object[key];
      const minimum = key === 'x' || key === 'y' ? 0 : 1;
      if (typeof coordinate !== 'number' || !Number.isInteger(coordinate) || coordinate < minimum || coordinate > WHITEBOARD_DIAGRAM_DRAFT_LIMITS.coordinateMax) {
        valid = false;
        issue('invalid_bounds', `${path}.${key}`, `Expected an integer from ${minimum} to 1000.`);
      }
    }
    if (valid && ((object.x as number) + (object.width as number) > WHITEBOARD_DIAGRAM_DRAFT_LIMITS.coordinateMax || (object.y as number) + (object.height as number) > WHITEBOARD_DIAGRAM_DRAFT_LIMITS.coordinateMax)) {
      issue('invalid_bounds', path, 'The entire node rectangle must fit inside the normalized 1000 × 1000 canvas.');
    }
  }

  try {
    const draft = record(value, ROOT_KEYS, '$');
    if (!draft) return createValidationResult(issues);
    if (draft.version !== 1) issue('invalid_version', '$.version', 'Only whiteboard diagram draft version 1 is supported.');
    choice(draft.outcome, WHITEBOARD_DIAGRAM_DRAFT_OUTCOMES, '$.outcome');

    const nodes = array(draft.nodes, WHITEBOARD_DIAGRAM_DRAFT_LIMITS.maxNodes, '$.nodes');
    const edges = array(draft.edges, WHITEBOARD_DIAGRAM_DRAFT_LIMITS.maxEdges, '$.edges');
    const warnings = array(draft.warnings, WHITEBOARD_DIAGRAM_DRAFT_LIMITS.maxWarnings, '$.warnings');
    const nodeIds = new Set<string>();
    const elementIds = new Set<string>();

    const registerId = (input: unknown, path: string, node: boolean) => {
      if (!id(input, path)) return;
      if (elementIds.has(input)) issue('duplicate_id', path, 'Node and edge IDs must be globally unique within the draft.');
      elementIds.add(input);
      if (node) nodeIds.add(input);
    };

    for (const [index, input] of (nodes ?? []).entries()) {
      const path = `$.nodes[${index}]`;
      const node = record(input, NODE_KEYS, path);
      if (!node) continue;
      registerId(node.id, `${path}.id`, true);
      choice(node.shape, WHITEBOARD_DIAGRAM_DRAFT_SHAPES, `${path}.shape`);
      label(node.label, `${path}.label`);
      bounds(node.bounds, `${path}.bounds`);
    }

    for (const [index, input] of (edges ?? []).entries()) {
      const path = `$.edges[${index}]`;
      const edge = record(input, EDGE_KEYS, path);
      if (!edge) continue;
      registerId(edge.id, `${path}.id`, false);
      for (const endpoint of ['sourceId', 'targetId'] as const) {
        const reference = edge[endpoint];
        if (id(reference, `${path}.${endpoint}`) && !nodeIds.has(reference)) {
          issue('unknown_reference', `${path}.${endpoint}`, 'Connection endpoints must reference a node in this draft.');
        }
      }
      label(edge.label, `${path}.label`);
      choice(edge.direction, WHITEBOARD_DIAGRAM_DRAFT_DIRECTIONS, `${path}.direction`);
    }

    for (const [index, input] of (warnings ?? []).entries()) {
      const path = `$.warnings[${index}]`;
      const warning = record(input, WARNING_KEYS, path);
      if (!warning) continue;
      choice(warning.code, WHITEBOARD_DIAGRAM_DRAFT_WARNING_CODES, `${path}.code`);
      if (typeof warning.message !== 'string' || warning.message.length > WHITEBOARD_DIAGRAM_DRAFT_LIMITS.maxWarningMessageLength || !warning.message.trim()) {
        issue('invalid_text', `${path}.message`, 'Warning messages must be nonblank strings of at most 500 UTF-16 code units.');
      }
      if (warning.elementId !== null && id(warning.elementId, `${path}.elementId`) && !elementIds.has(warning.elementId)) {
        issue('unknown_reference', `${path}.elementId`, 'A warning must reference a known node or edge, or use null for the entire drawing.');
      }
    }

    if (draft.outcome === 'diagram' && nodes?.length === 0) {
      issue('invalid_outcome', '$.nodes', 'A diagram outcome must contain at least one node.');
    }
    if (draft.outcome === 'unrecognized') {
      if (nodes && nodes.length !== 0) issue('invalid_outcome', '$.nodes', 'An unrecognized outcome must not contain nodes.');
      if (edges && edges.length !== 0) issue('invalid_outcome', '$.edges', 'An unrecognized outcome must not contain edges.');
      if (warnings?.length === 0) issue('invalid_outcome', '$.warnings', 'An unrecognized outcome must explain the result with at least one warning.');
    }
  } catch {
    issue('invalid_object', '$', 'The draft must contain readable plain JSON values only.');
  }

  return createValidationResult(issues);
}

/** Structural/relational validity does not assert that recognition was correct. */
export function isWhiteboardDiagramDraft(value: unknown): value is WhiteboardDiagramDraftV1 {
  return validateWhiteboardDiagramDraft(value).valid;
}
