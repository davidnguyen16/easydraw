/**
 * 3D object recipes — how a CubeNode looks in the 3D editor.
 *
 * A recipe is data, never code: a list of primitive parts (box, cylinder,
 * sphere, torus) placed inside the node's own box, which the 3D scene scales
 * to the node's size. The node stays an ordinary node for the 2D canvas,
 * persistence and the API; only the 3D renderer reads `data.visual3d`.
 * There is no built-in catalogue: every object is designed in the editor,
 * imported from a JSON file, or dropped from the account's private library.
 *
 * Validation is deliberately strict and bounded (part count, sizes, finite
 * numbers, colour format) because the JSON is user-supplied and rendered
 * without further checks.
 */
import { createValidationResult, type ValidationIssue, type ValidationResult } from '@easydraw/shared-types';

export const VISUAL3D_SHAPES = ['box', 'cylinder', 'sphere', 'torus'] as const;
export type Visual3DShape = (typeof VISUAL3D_SHAPES)[number];

/** Named materials map to the scene's palette; `custom` uses `color`. */
export const VISUAL3D_MATERIALS = [
  'body', 'frame', 'silver', 'dark', 'teal', 'blue', 'screen', 'amber', 'red', 'green', 'leaf', 'wood', 'custom',
] as const;
export type Visual3DMaterial = (typeof VISUAL3D_MATERIALS)[number];

export type Visual3DVector = [number, number, number];

export interface Visual3DPart {
  shape: Visual3DShape;
  material: Visual3DMaterial;
  /** `#rrggbb`, required when material is `custom`. */
  color?: string;
  /** Extent per axis, as a fraction of the node's box (1 = the whole box). */
  size: Visual3DVector;
  /** Centre offset from the node's centre, in fractions of the box (−0.5..0.5 keeps it inside). */
  position: Visual3DVector;
  /** Euler rotation in radians. */
  rotation?: Visual3DVector;
  /** Cylinders only: bottom radius relative to the top (1 = straight). */
  taper?: number;
}

/** Default footprint when the object is dropped from a library: 2D pixels and world depth. */
export interface Visual3DSize {
  width: number;
  height: number;
  depth: number;
}

export interface Visual3DRecipe {
  version: 2;
  parts: Visual3DPart[];
  size?: Visual3DSize;
  /** Default node fill colour (what `body` parts paint) when dropped from a library. */
  fill?: string;
}

// The richest shipped preset (a storage array) is 98 parts; merged per material they are still a handful of draw calls.
export const MAX_VISUAL3D_PARTS = 128;
/** A part may overhang its box a little (rims, antennas) but not run away. */
export const MAX_VISUAL3D_EXTENT = 2;
export const MAX_VISUAL3D_OFFSET = 1;
/** Drop sizes: 2D pixels for the footprint, world units (1 = 100 px) for depth. */
export const MAX_VISUAL3D_SIZE_PX = 4096;
export const MAX_VISUAL3D_DEPTH = 100;
const COLOR = /^#[0-9a-f]{6}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isVector(value: unknown, min: number, max: number): value is Visual3DVector {
  return Array.isArray(value) && value.length === 3 &&
    value.every((n) => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max);
}

export function validateVisual3DPart(value: unknown, path = '$'): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const issue = (code: string, message: string, at = path) => issues.push({ code, message, path: at, severity: 'error' });
  if (!isRecord(value)) {
    issue('visual3d.part', 'Each part must be an object.');
    return issues;
  }
  if (!(VISUAL3D_SHAPES as readonly unknown[]).includes(value.shape)) issue('visual3d.shape', `shape must be one of ${VISUAL3D_SHAPES.join(', ')}.`, `${path}.shape`);
  if (!(VISUAL3D_MATERIALS as readonly unknown[]).includes(value.material)) issue('visual3d.material', `material must be one of ${VISUAL3D_MATERIALS.join(', ')}.`, `${path}.material`);
  if (value.material === 'custom' && !(typeof value.color === 'string' && COLOR.test(value.color))) issue('visual3d.color', 'custom parts need a #rrggbb color.', `${path}.color`);
  if (value.color !== undefined && !(typeof value.color === 'string' && COLOR.test(value.color))) issue('visual3d.color', 'color must be #rrggbb.', `${path}.color`);
  if (!isVector(value.size, 0, MAX_VISUAL3D_EXTENT) || (value.size as number[]).some((n) => n <= 0)) issue('visual3d.size', `size must be three numbers in (0, ${MAX_VISUAL3D_EXTENT}].`, `${path}.size`);
  if (!isVector(value.position, -MAX_VISUAL3D_OFFSET, MAX_VISUAL3D_OFFSET)) issue('visual3d.position', `position must be three numbers within ±${MAX_VISUAL3D_OFFSET}.`, `${path}.position`);
  // Angles are periodic, so any finite value is drawable; only NaN/Infinity would break the matrix.
  if (value.rotation !== undefined && !isVector(value.rotation, -Infinity, Infinity)) issue('visual3d.rotation', 'rotation must be three finite angles in radians.', `${path}.rotation`);
  if (value.taper !== undefined && !(typeof value.taper === 'number' && Number.isFinite(value.taper) && value.taper > 0 && value.taper <= 4)) issue('visual3d.taper', 'taper must be in (0, 4].', `${path}.taper`);
  return issues;
}

export function validateVisual3DRecipe(value: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];
  const issue = (code: string, message: string, path = '$') => issues.push({ code, message, path, severity: 'error' });
  if (!isRecord(value)) {
    issue('visual3d.not_object', 'A 3D recipe must be an object.');
    return createValidationResult(issues);
  }
  if (value.version !== 2) {
    issue('visual3d.version', 'Unsupported 3D recipe version.', '$.version');
    return createValidationResult(issues);
  }
  if (!Array.isArray(value.parts) || value.parts.length === 0) issue('visual3d.parts', 'A recipe needs at least one part.', '$.parts');
  else if (value.parts.length > MAX_VISUAL3D_PARTS) issue('visual3d.parts', `A recipe may have at most ${MAX_VISUAL3D_PARTS} parts.`, '$.parts');
  else value.parts.forEach((part, index) => issues.push(...validateVisual3DPart(part, `$.parts[${index}]`)));
  if (value.size !== undefined) {
    const size = value.size as Record<string, unknown>;
    const px = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n > 0 && n <= MAX_VISUAL3D_SIZE_PX;
    const depth = typeof size?.depth === 'number' && Number.isFinite(size.depth) && size.depth > 0 && size.depth <= MAX_VISUAL3D_DEPTH;
    if (!isRecord(size) || !px(size.width) || !px(size.height) || !depth) issue('visual3d.size', `size needs width and height in pixels (≤ ${MAX_VISUAL3D_SIZE_PX}) and a depth in world units (≤ ${MAX_VISUAL3D_DEPTH}).`, '$.size');
  }
  if (value.fill !== undefined && !(typeof value.fill === 'string' && COLOR.test(value.fill))) issue('visual3d.fill', 'fill must be #rrggbb.', '$.fill');
  return createValidationResult(issues);
}

export function isVisual3DRecipe(value: unknown): value is Visual3DRecipe {
  return validateVisual3DRecipe(value).valid;
}

/** Deep-copies a recipe with only the fields the schema knows. */
export function cloneVisual3DRecipe(recipe: Visual3DRecipe): Visual3DRecipe {
  return {
    version: 2,
    parts: recipe.parts.map(cloneVisual3DPart),
    ...(recipe.size ? { size: { width: recipe.size.width, height: recipe.size.height, depth: recipe.size.depth } } : {}),
    ...(recipe.fill !== undefined ? { fill: recipe.fill } : {}),
  };
}

/** Deep-copies a part with only the fields the schema knows. */
export function cloneVisual3DPart(part: Visual3DPart): Visual3DPart {
  return {
    shape: part.shape,
    material: part.material,
    ...(part.color !== undefined ? { color: part.color } : {}),
    size: [...part.size] as Visual3DVector,
    position: [...part.position] as Visual3DVector,
    ...(part.rotation ? { rotation: [...part.rotation] as Visual3DVector } : {}),
    ...(part.taper !== undefined ? { taper: part.taper } : {}),
  };
}
