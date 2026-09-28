import { finiteRange, hexColor, jsonArray, jsonRecord } from './safe-json.js';

export const VECTOR_PATH_NODE_TYPE = 'VectorPathNode' as const;
export const SOURCE_IMAGE_NODE_TYPE = 'SourceImageNode' as const;

export const VECTOR_GEOMETRY_LIMITS = Object.freeze({
  maxCommands: 64,
  coordinateMax: 1000,
  maxStrokeWidth: 12,
} as const);

export const SOURCE_IMAGE_LIMITS = Object.freeze({
  maxDataUrlLength: 180_000,
  maxDimension: 1024,
  maxReasonLength: 500,
} as const);

export type VectorDash = 'solid' | 'dashed' | 'dotted';
export interface VectorCommand {
  op: 'M' | 'L' | 'Q' | 'C' | 'Z';
  values: number[];
}

/**
 * Stored at node.data.vector. Every coordinate pair, including curve controls,
 * is local to that node's bounds on a normalized 0..1000 by 0..1000 canvas.
 * Bounds in a recognition draft use the full source image's coordinate space.
 */
export interface VectorGeometry {
  version: 1;
  commands: VectorCommand[];
  stroke: string;
  fill: string;
  strokeWidth: number;
  dash: VectorDash;
  startArrow: boolean;
  endArrow: boolean;
}

/** Server-created PNG crop, stored at node.data.image; never supplied by a model. */
export interface SourceImageData {
  version: 1;
  dataUrl: string;
  width: number;
  height: number;
  reason: string;
}

const COLOR_SCHEMA = { type: 'string', pattern: '^#[A-Fa-f0-9]{6}$' } as const;
const PAINT_SCHEMA = { anyOf: [COLOR_SCHEMA, { type: 'string', const: 'none' }] } as const;
const COMMAND_LENGTHS = { M: 2, L: 2, Q: 4, C: 6, Z: 0 } as const;
const GEOMETRY_KEYS = ['version', 'commands', 'stroke', 'fill', 'strokeWidth', 'dash', 'startArrow', 'endArrow'] as const;

function commandSchema(op: VectorCommand['op']) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['op', 'values'],
    properties: {
      op: { type: 'string', const: op },
      values: {
        type: 'array', minItems: COMMAND_LENGTHS[op], maxItems: COMMAND_LENGTHS[op],
        items: { type: 'number', minimum: 0, maximum: VECTOR_GEOMETRY_LIMITS.coordinateMax },
      },
    },
  } as const;
}

/** Closed JSON Schema. Command ordering and a drawn segment are checked by the guard. */
export const VECTOR_GEOMETRY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: GEOMETRY_KEYS,
  properties: {
    version: { type: 'integer', const: 1 },
    commands: {
      type: 'array', minItems: 2, maxItems: VECTOR_GEOMETRY_LIMITS.maxCommands,
      items: { anyOf: ['M', 'L', 'Q', 'C', 'Z'].map((op) => commandSchema(op as VectorCommand['op'])) },
    },
    stroke: PAINT_SCHEMA,
    fill: PAINT_SCHEMA,
    strokeWidth: { type: 'number', minimum: 0, maximum: VECTOR_GEOMETRY_LIMITS.maxStrokeWidth },
    dash: { type: 'string', enum: ['solid', 'dashed', 'dotted'] },
    startArrow: { type: 'boolean' },
    endArrow: { type: 'boolean' },
  },
} as const;

/** Returns a bounded copy so rendering never reads accessors after validation. */
function readVectorGeometry(value: unknown): VectorGeometry | null {
  const geometry = jsonRecord(value, GEOMETRY_KEYS);
  if (!geometry || geometry.version !== 1 ||
    !(hexColor(geometry.stroke) || geometry.stroke === 'none') ||
    !(hexColor(geometry.fill) || geometry.fill === 'none') ||
    !finiteRange(geometry.strokeWidth, 0, VECTOR_GEOMETRY_LIMITS.maxStrokeWidth) ||
    !['solid', 'dashed', 'dotted'].includes(geometry.dash as string) ||
    typeof geometry.startArrow !== 'boolean' || typeof geometry.endArrow !== 'boolean') return null;
  const items = jsonArray(geometry.commands, VECTOR_GEOMETRY_LIMITS.maxCommands);
  if (!items || items.length < 2) return null;
  const commands: VectorCommand[] = [];
  let requireMove = true;
  let drawn = false;
  for (const item of items) {
    const command = jsonRecord(item, ['op', 'values']);
    if (!command || typeof command.op !== 'string' || !Object.hasOwn(COMMAND_LENGTHS, command.op)) return null;
    const op = command.op as VectorCommand['op'];
    const values = jsonArray(command.values, COMMAND_LENGTHS[op]);
    if (!values || values.length !== COMMAND_LENGTHS[op] ||
      !values.every((coordinate) => finiteRange(coordinate, 0, VECTOR_GEOMETRY_LIMITS.coordinateMax))) return null;
    if (requireMove && op !== 'M') return null;
    if (op === 'L' || op === 'Q' || op === 'C') drawn = true;
    requireMove = op === 'Z';
    commands.push({ op, values: values as number[] });
  }
  if (!drawn) return null;
  return {
    version: 1, commands, stroke: geometry.stroke, fill: geometry.fill,
    strokeWidth: geometry.strokeWidth, dash: geometry.dash as VectorDash,
    startArrow: geometry.startArrow, endArrow: geometry.endArrow,
  };
}

export function isVectorGeometry(value: unknown): value is VectorGeometry {
  try { return readVectorGeometry(value) !== null; } catch { return false; }
}

/** Numeric SVG path data only. Invalid input produces no path, never raw markup. */
export function vectorPathData(value: unknown): string {
  try {
    const geometry = readVectorGeometry(value);
    return geometry ? geometry.commands.map(({ op, values }) =>
      `${op}${values.length ? ` ${values.join(' ')}` : ''}`).join(' ') : '';
  } catch { return ''; }
}

/** Read only the bounded PNG signature/IHDR prefix, without Buffer or browser APIs. */
function pngDimensions(payload: string): { width: number; height: number } | null {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes: number[] = [];
  for (let index = 0; index < 32; index += 4) {
    const values = [0, 1, 2, 3].map((offset) => alphabet.indexOf(payload[index + offset]!));
    if (values.some((value) => value < 0)) return null;
    const bits = values[0]! * 262144 + values[1]! * 4096 + values[2]! * 64 + values[3]!;
    bytes.push((bits >>> 16) & 255, (bits >>> 8) & 255, bits & 255);
  }
  const signature = [137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82];
  if (!signature.every((byte, index) => bytes[index] === byte)) return null;
  const uint32 = (offset: number) => bytes[offset]! * 16777216 + bytes[offset + 1]! * 65536 + bytes[offset + 2]! * 256 + bytes[offset + 3]!;
  return { width: uint32(16), height: uint32(20) };
}

/** Inspect chunk headers in-place; payload is bounded and is never decompressed. */
function isSingleFramePng(payload: string): boolean {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const byteLength = payload.length / 4 * 3 - (payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0);
  const byteAt = (offset: number) => {
    const quartet = Math.floor(offset / 3) * 4;
    const position = offset % 3;
    const first = alphabet.indexOf(payload[quartet + position]!);
    const second = alphabet.indexOf(payload[quartet + position + 1]!);
    return position === 0 ? (first << 2) | (second >>> 4) :
      position === 1 ? ((first & 15) << 4) | (second >>> 2) : ((first & 3) << 6) | second;
  };
  let offset = 8;
  let hasImageData = false;
  while (offset + 12 <= byteLength) {
    const size = byteAt(offset) * 16777216 + byteAt(offset + 1) * 65536 + byteAt(offset + 2) * 256 + byteAt(offset + 3);
    if (size > byteLength - offset - 12) return false;
    const type = String.fromCharCode(byteAt(offset + 4), byteAt(offset + 5), byteAt(offset + 6), byteAt(offset + 7));
    if (type === 'acTL' || type === 'fcTL' || type === 'fdAT' || (type === 'IHDR' && offset !== 8)) return false;
    if (type === 'IDAT') hasImageData = true;
    offset += size + 12;
    if (type === 'IEND') return size === 0 && hasImageData && offset === byteLength;
  }
  return false;
}

/** Defense in depth only: the server must still decode and verify all PNG bytes. */
export function isSourceImageData(value: unknown): value is SourceImageData {
  try {
    const image = jsonRecord(value, ['version', 'dataUrl', 'width', 'height', 'reason']);
    if (!image || image.version !== 1 || typeof image.dataUrl !== 'string' ||
      image.dataUrl.length > SOURCE_IMAGE_LIMITS.maxDataUrlLength ||
      !image.dataUrl.startsWith('data:image/png;base64,') ||
      !finiteRange(image.width, 1, SOURCE_IMAGE_LIMITS.maxDimension) || !Number.isInteger(image.width) ||
      !finiteRange(image.height, 1, SOURCE_IMAGE_LIMITS.maxDimension) || !Number.isInteger(image.height) ||
      typeof image.reason !== 'string' || image.reason.length > SOURCE_IMAGE_LIMITS.maxReasonLength) return false;
    const payload = image.dataUrl.slice('data:image/png;base64,'.length);
    if (payload.length < 44 || payload.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(payload)) return false;
    const dimensions = pngDimensions(payload);
    return dimensions !== null && dimensions.width === image.width && dimensions.height === image.height && isSingleFramePng(payload);
  } catch { return false; }
}
