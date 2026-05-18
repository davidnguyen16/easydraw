/**
 * Node shape registry — single source of truth for the editor's node catalog.
 *
 * Order in the SHAPES array drives the order shapes appear within each
 * sidebar category. To add a new shape:
 *
 *   1. Create a folder src/lib/flow/nodes/<name>/
 *   2. Add component.svelte, icon.svelte, and shape.ts (and optionally
 *      types.ts and a panel component).
 *   3. Import the shape here and append to SHAPES.
 *
 * Everything else (xyflow nodeTypes map, sidebar palette grouping, drop
 * defaults, StylePanel custom tabs) is derived from this array.
 */
import { entityShape } from './entity/shape';
import { rectangleShape } from './rectangle/shape';
import type { NodeCategory, NodeShape } from './types';

export const SHAPES: readonly NodeShape[] = [
    rectangleShape,
    entityShape
] as const;

export function getShape(id: string): NodeShape | undefined {
    return SHAPES.find((s) => s.id === id);
}

export function getShapesByCategory(category: NodeCategory): NodeShape[] {
    return SHAPES.filter((s) => s.category === category);
}

/**
 * Distinct categories present in the registry, preserving the order in
 * which they first appear in SHAPES. Used by the sidebar to render
 * sections without hardcoding the category list.
 */
export function getCategories(): NodeCategory[] {
    const seen = new Set<NodeCategory>();
    const ordered: NodeCategory[] = [];
    for (const shape of SHAPES) {
        if (!seen.has(shape.category)) {
            seen.add(shape.category);
            ordered.push(shape.category);
        }
    }
    return ordered;
}

/** xyflow's `nodeTypes` map, built from the registry. */
export function buildNodeTypesMap(): Record<string, NodeShape['component']> {
    const map: Record<string, NodeShape['component']> = {};
    for (const shape of SHAPES) {
        map[shape.id] = shape.component;
    }
    return map;
}

export type { NodeShape, NodeCategory } from './types';
export type { NodePanel, NodePanelProps } from './types';
