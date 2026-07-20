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
	{ id: 'triangle-sharp', label: 'Sharp arrow' },
	{ id: 'half-arrow-up', label: 'Half arrow up' },
	{ id: 'half-arrow-down', label: 'Half arrow down' },
	{ id: 'arrow-cross', label: 'Crossed arrow' },
	{ id: 'triangle-open-double', label: 'Double open arrow' },
	{ id: 'triangle-double', label: 'Double arrow' },
	{ id: 'arrow-double', label: 'Double thin arrow' },
	{ id: 'arrow-cross-double', label: 'Crossed double arrow' },
	{ id: 'diamond-open', label: 'Open diamond' },
	{ id: 'diamond', label: 'Diamond' },
	{ id: 'diamond-open-small', label: 'Small open diamond' },
	{ id: 'diamond-open-wide', label: 'Wide open diamond' },
	{ id: 'square-open', label: 'Open square' },
	{ id: 'square', label: 'Square' },
	{ id: 'square-open-small', label: 'Small open square' },
	{ id: 'square-small', label: 'Small square' },
	{ id: 'circle-open', label: 'Open circle' },
	{ id: 'circle', label: 'Circle' },
	{ id: 'circle-cross', label: 'Crossed circle' },
	{ id: 'circle-open-small', label: 'Small open circle' },
	{ id: 'circle-small', label: 'Small circle' },
	{ id: 'bar-circle-open', label: 'Bar open circle' },
	{ id: 'bar-circle', label: 'Bar circle' },
	{ id: 'bar-double-circle-open', label: 'Double bar open circle' },
	{ id: 'bar-double-circle', label: 'Double bar circle' },
	{ id: 'bar-triple-circle-open', label: 'Triple bar open circle' },
	{ id: 'bar-triple-circle', label: 'Triple bar circle' },
	{ id: 'diamond-circle-open', label: 'Diamond open circle' },
	{ id: 'diamond-circle', label: 'Diamond circle' },
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
	// Ordered per the reference design: single heads first (image 1), then the
	// crossed / double variants (image 2).
	arrow: [
		'triangle',
		'triangle-open',
		'arrow',
		'half-arrow-up',
		'half-arrow-down',
		'triangle-sharp',
		'arrow-cross',
		'triangle-open-double',
		'triangle-double',
		'arrow-double',
		'arrow-cross-double'
	],
	// Ordered per the reference design: the plain circles first, then the
	// tick + circle and diamond + circle combos.
	circle: [
		'circle-open',
		'circle',
		'circle-cross',
		'circle-crowfoot',
		'circle-bar',
		'circle-open-small',
		'circle-small',
		'bar-circle-open',
		'bar-circle',
		'bar-double-circle-open',
		'bar-double-circle',
		'bar-triple-circle-open',
		'bar-triple-circle',
		'diamond-circle-open',
		'diamond-circle'
	],
	// Both ordered per the reference design: open first, then filled, then the
	// small / wide / combo variants.
	square: ['square-open', 'square', 'square-open-small', 'square-small'],
	diamond: [
		'diamond-open',
		'diamond',
		'diamond-open-small',
		'diamond-open-wide',
		'diamond-circle-open',
		'diamond-circle'
	]
};

const DEF_BY_ID = new Map(MARKER_DEFS.map((d) => [d.id, d]));

/** Defs of one category, in that category's display order. */
export function getMarkersByCategory(category: 'all' | MarkerCategory): MarkerDef[] {
	if (category === 'all') return MARKER_DEFS;
	return MARKER_CATEGORY_IDS[category]
		.map((id) => DEF_BY_ID.get(id))
		.filter((d): d is MarkerDef => d !== undefined);
}
