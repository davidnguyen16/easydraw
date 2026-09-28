import type { Visual3DPart, Visual3DRecipe } from '@easydraw/diagram-schema';
import { MATERIAL_COLORS, safeColor } from './recipe-geometry';

/**
 * The 2D canvas is the plan of the 3D scene (x → x, z → y), so a node that
 * carries a 3D object is drawn in 2D as that object seen from above: every
 * part becomes its footprint, painted bottom-up so higher parts sit on top,
 * and tinted lighter the higher it rises. Boxes and lying cylinders become
 * rectangles, standing cylinders and spheres ellipses, flat rings rings.
 */
export interface PlanShape {
  kind: 'rect' | 'ellipse' | 'ring';
  /** Centre and extent in the node's 0–100 viewBox. */
  cx: number;
  cy: number;
  w: number;
  h: number;
  /** Degrees, clockwise on screen. */
  rotate: number;
  fill: string;
  stroke: string;
}

const QUARTER = Math.PI / 2;
const near = (a: number, b: number) => Math.abs(((a - b + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI) < 0.35;

/** Fraction of a right angle: 0 upright, 1 lying on its side. */
function lying(angle: number): boolean {
  return near(angle, QUARTER) || near(angle, -QUARTER);
}

function mix(hex: string, towards: string, amount: number): string {
  const parse = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const a = parse(hex);
  const b = parse(towards);
  if (a.some(Number.isNaN) || b.some(Number.isNaN)) return hex;
  return '#' + a.map((v, i) => Math.round(v + (b[i]! - v) * amount).toString(16).padStart(2, '0')).join('');
}

function partColor(part: Visual3DPart, body: string): string {
  if (part.material === 'body') return body;
  if (part.material === 'custom') return safeColor(part.color, MATERIAL_COLORS.custom);
  return MATERIAL_COLORS[part.material];
}

export function planShapes(recipe: Visual3DRecipe, bodyFill: string): PlanShape[] {
  const body = safeColor(bodyFill, safeColor(recipe.fill, MATERIAL_COLORS.body));
  const tops = recipe.parts.map((p) => p.position[1] + p.size[1] / 2);
  const lowest = Math.min(...tops);
  const highest = Math.max(...tops);
  const range = Math.max(highest - lowest, 1e-6);

  return recipe.parts
    .map((part, index) => {
      const [rx, ry, rz] = part.rotation ?? [0, 0, 0];
      const [sx, sy, sz] = part.size;
      const onSideX = lying(rx);
      const onSideZ = lying(rz);
      // A part tipped over shows its height along the floor instead of its depth.
      const w = onSideZ ? sy : sx;
      const h = onSideX ? sy : sz;
      let kind: PlanShape['kind'] = 'rect';
      if (part.shape === 'sphere') kind = 'ellipse';
      else if (part.shape === 'cylinder') kind = onSideX || onSideZ ? 'rect' : 'ellipse';
      else if (part.shape === 'torus') kind = onSideX ? 'ring' : 'rect';
      const base = partColor(part, body);
      const height = (tops[index]! - lowest) / range;
      return {
        top: tops[index]!,
        shape: {
          kind,
          cx: 50 + part.position[0] * 100,
          cy: 50 + part.position[2] * 100,
          w: Math.max(0.5, w * 100),
          h: Math.max(0.5, h * 100),
          rotate: -(ry * 180) / Math.PI,
          fill: mix(base, '#ffffff', 0.08 + height * 0.22),
          stroke: mix(base, '#000000', 0.45),
        } satisfies PlanShape,
      };
    })
    .sort((a, b) => a.top - b.top)
    .map((entry) => entry.shape);
}
