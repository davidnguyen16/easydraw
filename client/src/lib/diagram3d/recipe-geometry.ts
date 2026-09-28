import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Visual3DMaterial, Visual3DPart, Visual3DRecipe } from '@easydraw/diagram-schema';

/** The scene's named paints. `body` follows the node's fill colour; `custom` uses the part's own. */
export const MATERIAL_COLORS: Record<Visual3DMaterial, string> = {
  body: '#263341', frame: '#1b2733', silver: '#c2cdd5', dark: '#0d1823',
  teal: '#47dab8', blue: '#3f91be', screen: '#18364b', amber: '#f4bc56',
  red: '#c63643', green: '#2e7153', leaf: '#68a26b', wood: '#bd9871',
  custom: '#8a8b83',
};
export const safeColor = (value: unknown, fallback: string) => typeof value === 'string' && /^(#[\da-f]{3,8}|[a-z]+|(?:rgb|hsl)a?\([\d\s.,%+-]+\))$/i.test(value) && !['none', 'transparent', 'currentcolor', 'inherit'].includes(value.toLowerCase()) ? value : fallback;

function geometryFor(part: Visual3DPart): THREE.BufferGeometry {
  const original = part.shape === 'cylinder' ? new THREE.CylinderGeometry(0.5, 0.5 * (part.taper ?? 1), 1, 32)
    : part.shape === 'sphere' ? new THREE.SphereGeometry(0.5, 12, 8)
      : part.shape === 'torus' ? new THREE.TorusGeometry(0.43, 0.065, 6, 20)
        : new THREE.BoxGeometry(1, 1, 1);
  const geometry = original.toNonIndexed();
  original.dispose();
  geometry.scale(...part.size);
  if (part.rotation) geometry.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...part.rotation)));
  geometry.translate(...part.position);
  return geometry;
}

/** Merge repeated blades, ports and LEDs: one draw call per material (per colour for custom parts), not per detail. */
export interface RecipeGeometry { material: Visual3DMaterial; color?: string; geometry: THREE.BufferGeometry }

export function buildRecipeGeometry(recipe: Visual3DRecipe): RecipeGeometry[] {
  const groups = new Map<string, { material: Visual3DMaterial; color?: string; pieces: THREE.BufferGeometry[] }>();
  for (const part of recipe.parts) {
    const key = part.material === 'custom' ? `custom:${part.color}` : part.material;
    const group = groups.get(key) ?? { material: part.material, ...(part.color ? { color: part.color } : {}), pieces: [] };
    group.pieces.push(geometryFor(part));
    groups.set(key, group);
  }
  return [...groups.values()].map(({ material, color: partColor, pieces }) => {
    const geometry = mergeGeometries(pieces, false);
    for (const piece of pieces) piece.dispose();
    if (!geometry) throw new Error('Could not build the object geometry.');
    geometry.computeBoundingSphere();
    return { material, ...(partColor ? { color: partColor } : {}), geometry };
  });
}

