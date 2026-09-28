import type { Visual3DRecipe } from '@easydraw/diagram-schema';

// Shared drag source for palette → canvas drops (replaces the Svelte DnD
// context). NodeContainer parks the dragged shape id here on dragstart; the
// canvas onDrop reads it, looks it up in the registry, and creates the node.
export interface CustomNodeDragPayload {
  kind: 'custom-node';
  definitionId: string;
  assetId: string;
  label: string;
  intrinsicWidth: number;
  intrinsicHeight: number;
  defaultWidth: number;
  defaultHeight: number;
}

/** A 3D object from the account's private library: becomes a CubeNode carrying the recipe. */
export interface Object3DDragPayload {
  kind: 'object-3d';
  name: string;
  recipe: Visual3DRecipe;
}

export type PaletteDragPayload = string | CustomNodeDragPayload | Object3DDragPayload;

export const dndState: { current: PaletteDragPayload | null } = { current: null };
