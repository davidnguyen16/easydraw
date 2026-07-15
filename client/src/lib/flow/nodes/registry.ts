/**
 * Node shape registry — single source of truth for the editor's node catalog.
 *
 * Shape folders are grouped BY SECTION (sidebar category):
 * nodes/<section>/<shape>/. A geometry can be reused across sections by
 * adding a second shape.ts entry with its own id/label/category (e.g. a
 * future flowchart/process could reuse the rectangle look under a
 * different name).
 *
 * Order in the SHAPES array drives the order shapes appear within each
 * sidebar category. To add a new shape:
 *
 *   1. Create a folder src/lib/flow/nodes/<section>/<name>/
 *   2. Add shape.ts + icon.svelte (and component.svelte / types.ts / a
 *      panel component when the shape needs its own renderer).
 *   3. Import the shape here and append to SHAPES.
 *
 * Everything else (xyflow nodeTypes map, sidebar palette grouping, drop
 * defaults, StylePanel custom tabs) is derived from this array.
 */
// ── basic ────────────────────────────────────────────────────────────
import { chevronShape } from './basic/chevron/shape';
import { circleShape } from './basic/circle/shape';
import { cubeShape } from './basic/cube/shape';
import { diamondShape } from './basic/diamond/shape';
import { donutShape } from './basic/donut/shape';
import { dropShape } from './basic/drop/shape';
import { ellipseShape } from './basic/ellipse/shape';
import { halfCircleShape } from './basic/half-circle/shape';
import { octagonShape } from './basic/octagon/shape';
import { orthogonalTriangleShape } from './basic/orthogonal-triangle/shape';
import { parallelogramShape } from './basic/parallelogram/shape';
import { pentagonShape } from './basic/pentagon/shape';
import { pillShape } from './basic/pill/shape';
import { polygonShape } from './basic/polygon/shape';
import { rectangleShape } from './basic/rectangle/shape';
import { roundedRectangleShape } from './basic/rounded-rectangle/shape';
import { squareShape } from './basic/square/shape';
import { starShape } from './basic/star/shape';
import { textShape } from './basic/text/shape';
import { trapezoidShape } from './basic/trapezoid/shape';
import { triangleShape } from './basic/triangle/shape';
// ── arrows ───────────────────────────────────────────────────────────
import { arrowDownShape } from './arrows/arrow-down/shape';
import { arrowLeftShape } from './arrows/arrow-left/shape';
import { arrowRightShape } from './arrows/arrow-right/shape';
import { arrowUpShape } from './arrows/arrow-up/shape';
import { bendArrowShape } from './arrows/bend-arrow/shape';
import { bendDoubleArrowShape } from './arrows/bend-double-arrow/shape';
import { notchedArrowShape } from './arrows/notched-arrow/shape';
import { quadArrowShape } from './arrows/quad-arrow/shape';
import { twoWayArrowShape } from './arrows/two-way-arrow/shape';
import { uTurnArrowShape } from './arrows/u-turn-arrow/shape';
// ── flowchart ────────────────────────────────────────────────────────
import { dataShape } from './flowchart/data/shape';
import { decisionShape } from './flowchart/decision/shape';
import { processShape } from './flowchart/process/shape';
import { terminatorShape } from './flowchart/terminator/shape';
import { databaseShape } from './flowchart/database/shape';
// ── entity relation ──────────────────────────────────────────────────
import { entityShape } from './entity-relation/entity/shape';
import { weakEntityShape } from './entity-relation/weak-entity/shape';
import { zeroToManyShape } from './entity-relation/zero-to-many/shape';
import { oneToManyShape } from './entity-relation/one-to-many/shape';
import { oneMandatoryShape } from './entity-relation/one-mandatory/shape';
import { oneToOneShape } from './entity-relation/one-to-one/shape';
// ── uml ──────────────────────────────────────────────────────────────
import { actorShape } from './uml/actor/shape';
import { documentShape } from './uml/document/shape';
import type { NodeCategory, NodeShape } from './types';

// Order drives left-to-right, top-to-bottom layout within each sidebar
// category tile grid: rectangle / rounded / ellipse / circle, then
// diamond / parallelogram / triangle / pill, then document / cube / text.
// (Actor lives in the UML category; Entity shapes in ENTITY RELATION.)
export const SHAPES: readonly NodeShape[] = [
	rectangleShape,
	roundedRectangleShape,
	squareShape,
	ellipseShape,
	circleShape,
	diamondShape,
	parallelogramShape,
	trapezoidShape,
	triangleShape,
	polygonShape,
	octagonShape,
	orthogonalTriangleShape,
	pentagonShape,
	halfCircleShape,
	starShape,
	chevronShape,
	dropShape,
	donutShape,
	pillShape,
	documentShape,
	actorShape,
	cubeShape,
	textShape,
	entityShape,
	weakEntityShape,
	zeroToManyShape,
	oneToManyShape,
	oneMandatoryShape,
	oneToOneShape,
	arrowRightShape,
	arrowLeftShape,
	arrowUpShape,
	arrowDownShape,
	notchedArrowShape,
	twoWayArrowShape,
	quadArrowShape,
	uTurnArrowShape,
	bendArrowShape,
	bendDoubleArrowShape,
	terminatorShape,
	processShape,
	decisionShape,
	dataShape,
	databaseShape
] as const;

export function getShape(id: string): NodeShape | undefined {
	return SHAPES.find((s) => s.id === id);
}

export function getShapesByCategory(category: NodeCategory): NodeShape[] {
	// `hidden` shapes stay registered (nodeTypes still renders them in old
	// diagrams) but no longer appear in the palette.
	return SHAPES.filter((s) => s.category === category && !s.hidden);
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

/** xyflow's `nodeTypes` map, built from the registry. Connection-preset
 *  tiles (edgePreset, no component) never render a node, so they're skipped. */
export function buildNodeTypesMap(): Record<string, NonNullable<NodeShape['component']>> {
	const map: Record<string, NonNullable<NodeShape['component']>> = {};
	for (const shape of SHAPES) {
		if (shape.component) map[shape.id] = shape.component;
	}
	return map;
}

export type { NodeShape, NodeCategory } from './types';
export type { NodePanel, NodePanelProps } from './types';
