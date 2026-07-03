/**
 * Line-ending (endpoint marker) catalog.
 *
 * Single source of truth for every marker the editor offers. The Start/End
 * dropdowns in ConnectionStylePanel list the SUBSET the user has enabled in
 * the "Line endings" dialog (see markers.store.svelte.ts); the dialog's
 * category sidebar shows the per-category lists below.
 *
 * Categories are explicit ORDERED id lists (not tags on the defs) because the
 * reference design orders each section differently — e.g. ERD leads with the
 * crow's-foot combos and ends with the lone bar.
 *
 * To add a marker: extend MarkerKind in ./types.ts, add its geometry to
 * ./marker-glyphs.ts, add a def here, then list it in the categories it
 * belongs to. Rendering everywhere else follows automatically.
 */
import type { MarkerKind } from './types';

export type MarkerId = Exclude<MarkerKind, 'none'>;

export type MarkerCategory =
	| 'standard'
	| 'uml'
	| 'bpmn'
	| 'erd'
	| 'arrow'
	| 'circle'
	| 'square'
	| 'diamond';

export interface MarkerDef {
	id: MarkerId;
	label: string;
}

/** Every marker, in the order the "All" tab (and the dropdowns) show them. */
export const MARKER_DEFS: MarkerDef[] = [
	{ id: 'triangle', label: 'Arrow' },
	{ id: 'triangle-open', label: 'Open arrow' },
	{ id: 'arrow', label: 'Thin arrow' },
	{ id: 'half-arrow-up', label: 'Half arrow up' },
	{ id: 'half-arrow-down', label: 'Half arrow down' },
	{ id: 'diamond-open', label: 'Open diamond' },
	{ id: 'diamond', label: 'Diamond' },
	{ id: 'square-open', label: 'Open square' },
	{ id: 'square', label: 'Square' },
	{ id: 'circle-open', label: 'Open circle' },
	{ id: 'circle', label: 'Circle' },
	{ id: 'circle-cross', label: 'Crossed circle' },
	{ id: 'slash', label: 'Slash' },
	{ id: 'bar', label: 'Bar' },
	{ id: 'bar-double', label: 'Double bar' },
	{ id: 'crowfoot', label: 'Many (crow’s foot)' },
	{ id: 'circle-crowfoot', label: 'Zero or many' },
	{ id: 'bar-crowfoot', label: 'One or many' },
	{ id: 'circle-bar', label: 'Zero or one' }
];

/** Sidebar entries of the Line endings dialog, in display order. */
export const MARKER_CATEGORIES: { id: 'all' | MarkerCategory; label: string }[] = [
	{ id: 'all', label: 'All' },
	{ id: 'standard', label: 'Standard' },
	{ id: 'uml', label: 'UML' },
	{ id: 'bpmn', label: 'BPMN' },
	{ id: 'erd', label: 'ERD' },
	{ id: 'arrow', label: 'Arrow' },
	{ id: 'circle', label: 'Circle' },
	{ id: 'square', label: 'Square' },
	{ id: 'diamond', label: 'Diamond' }
];

/** Per-category row lists, each in its reference display order. */
export const MARKER_CATEGORY_IDS: Record<MarkerCategory, MarkerId[]> = {
	standard: ['triangle', 'triangle-open', 'arrow', 'bar'],
	uml: [
		'triangle-open',
		'half-arrow-up',
		'half-arrow-down',
		'diamond-open',
		'diamond',
		'square-open',
		'square',
		'circle-open',
		'circle',
		'circle-cross'
	],
	bpmn: ['diamond-open', 'slash'],
	erd: ['circle-crowfoot', 'bar-crowfoot', 'crowfoot', 'bar-double', 'circle-bar', 'bar'],
	arrow: ['triangle', 'triangle-open', 'arrow', 'half-arrow-up', 'half-arrow-down'],
	circle: ['circle', 'circle-open', 'circle-cross', 'circle-crowfoot', 'circle-bar'],
	square: ['square', 'square-open'],
	diamond: ['diamond', 'diamond-open']
};

const DEF_BY_ID = new Map(MARKER_DEFS.map((d) => [d.id, d]));

/** Defs of one category, in that category's display order. */
export function getMarkersByCategory(category: 'all' | MarkerCategory): MarkerDef[] {
	if (category === 'all') return MARKER_DEFS;
	return MARKER_CATEGORY_IDS[category]
		.map((id) => DEF_BY_ID.get(id))
		.filter((d): d is MarkerDef => d !== undefined);
}
