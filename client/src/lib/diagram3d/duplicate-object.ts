import type { Visual3DPart, Visual3DRecipe } from '@easydraw/diagram-schema';
import type { Object3DTemplate } from './object-library';

/**
 * What an imported object has in common with one already in the account.
 *
 * Two objects can legitimately share a shape under different names — a copy
 * kept for a different project, a starting point for a variant — so only an
 * exact match on both is treated as "already uploaded" and stops to ask.
 * The weaker overlaps are worth saying out loud but never worth blocking.
 */
export interface DuplicateMatch {
  template: Object3DTemplate;
  sameName: boolean;
  sameShape: boolean;
  /** Same name and same shape: importing again just makes a second copy. */
  identical: boolean;
}

const normalise = (name: string) => name.trim().toLocaleLowerCase();
/** Tolerate the last bit of float noise a round-trip through JSON can leave. */
const num = (value: number) => (Math.round(value * 1e6) / 1e6).toString();
const vec = (values: readonly number[] | undefined) => values?.map(num).join(',') ?? '';

function partSignature(part: Visual3DPart): string {
  return [
    part.shape,
    part.material,
    part.color?.toLowerCase() ?? '',
    vec(part.size),
    vec(part.position),
    vec(part.rotation),
    part.taper === undefined ? '' : num(part.taper),
  ].join('|');
}

/**
 * A comparable form of a recipe. Field order is fixed here on purpose: the
 * stored copy comes back through Postgres `jsonb`, which does not preserve
 * key order, so `JSON.stringify` would never match the file it came from.
 */
export function recipeSignature(recipe: Visual3DRecipe): string {
  const size = recipe.size ? [recipe.size.width, recipe.size.height, recipe.size.depth].map(num).join(',') : '';
  return `${recipe.fill?.toLowerCase() ?? ''}#${size}#${recipe.parts.map(partSignature).join(';')}`;
}

/**
 * The most relevant object the account already holds, or null. An exact match
 * wins over a shape-only match, which wins over a name-only match.
 */
export function findDuplicate(
  templates: readonly Object3DTemplate[] | null,
  name: string,
  recipe: Visual3DRecipe,
): DuplicateMatch | null {
  if (!templates?.length) return null;
  const wanted = normalise(name);
  const shape = recipeSignature(recipe);
  let best: DuplicateMatch | null = null;
  for (const template of templates) {
    const sameName = normalise(template.name) === wanted;
    const sameShape = recipeSignature(template.recipe) === shape;
    if (!sameName && !sameShape) continue;
    const match: DuplicateMatch = { template, sameName, sameShape, identical: sameName && sameShape };
    if (match.identical) return match;
    // A shape match is the more useful thing to report: the name is just a label.
    if (!best || (match.sameShape && !best.sameShape)) best = match;
  }
  return best;
}

/** One line for the notice shown after an import that overlapped something. */
export function duplicateNotice(match: DuplicateMatch, library: string, importedName: string): string {
  if (match.sameShape) {
    return `Added "${importedName}". It has the same shape as "${match.template.name}" in ${library}.`;
  }
  return `Added "${importedName}". ${library} already has a different object with that name.`;
}
