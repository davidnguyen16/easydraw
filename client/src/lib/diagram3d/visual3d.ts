/**
 * How a node gets its 3D look. `data.visual3d` holds a Visual3D recipe
 * (schema in @easydraw/diagram-schema): a list of primitive parts inside
 * the node's box. Recipes come from the user — designed in the Object tab,
 * imported from JSON, or dropped from the account's private library — never
 * from a catalogue in the code.
 */
import { isVisual3DRecipe, type Visual3DRecipe } from '@easydraw/diagram-schema';

/** Node types whose 3D body is a flat plane; a recipe would hide their content. */
const NO_RECIPE_TYPES = new Set(['TextNode', 'VectorPathNode', 'SourceImageNode', 'group', 'connection-anchor', 'ConnectionAnchorNode']);

export function canCarryRecipe(type: string): boolean {
  return !NO_RECIPE_TYPES.has(type);
}

/** The recipe on a node, if it is valid; anything else keeps the node's own body. */
export function getVisual3DRecipe(type: string, data: Record<string, unknown>): Visual3DRecipe | null {
  if (!canCarryRecipe(type)) return null;
  return isVisual3DRecipe(data.visual3d) ? data.visual3d : null;
}

/** Stable identity for memoising built geometry. */
export function recipeKey(recipe: Visual3DRecipe): string {
  return JSON.stringify(recipe.parts);
}
