/**
 * Marker glyph geometry — the single source of truth for HOW each line-ending
 * kind is drawn. Consumed by:
 *
 *   - ConnectionEdge.svelte     (inside the SVG <marker> defs on real edges)
 *   - MarkerGlyph.svelte        (shared shape renderer)
 *   - MarkerPreview.svelte      (dropdown / dialog previews)
 *
 * Every glyph is authored in a `w`×10 box, pointing RIGHT, with the line
 * arriving from the left at y=5. `refX` is the x that lands on the line's
 * endpoint (the glyph tip for pointed markers, the outer edge for tick-style
 * ones). Keep all geometry ≥0.6 units inside the box — SVG markers clip to
 * their viewport, so strokes on the boundary get shaved.
 */
import type { MarkerKind } from './types';

/** One SVG primitive of a glyph. Colours are resolved at render time:
 *  fill 'color' → the edge's stroke colour, 'white' → opaque line mask. */
export type GlyphShape =
	| { el: 'path'; d: string; fill: 'color' | 'white' | 'none'; stroke?: boolean; strokeWidth?: number }
	| { el: 'circle'; cx: number; cy: number; r: number; fill: 'color' | 'white' | 'none'; stroke?: boolean; strokeWidth?: number }
	| { el: 'rect'; x: number; y: number; width: number; height: number; fill: 'color' | 'white' | 'none'; stroke?: boolean; strokeWidth?: number };

export interface MarkerGlyphDef {
	/** Box width in glyph units (height is always 10). Wide combo endings
	 *  (ERD cardinality pairs) need more room than a lone arrow head. */
	w: number;
	/** The x coordinate that lands ON the line endpoint. */
	refX: number;
	/**
	 * Tick-style glyphs (bars, slash) lie ACROSS the line just before the
	 * node; burying them under the node body would hide them, so their ends
	 * stay flush at the border instead (see ConnectionEdge.insetForEnd).
	 */
	flush?: boolean;
	shapes: GlyphShape[];
}

export const MARKER_GLYPHS: Record<Exclude<MarkerKind, 'none'>, MarkerGlyphDef> = {
	// ─── Arrows ──────────────────────────────────────────────────────────
	triangle: {
		w: 10,
		refX: 9,
		shapes: [{ el: 'path', d: 'M1,1 L9,5 L1,9 Z', fill: 'color' }]
	},
	'triangle-open': {
		w: 10,
		refX: 9,
		shapes: [{ el: 'path', d: 'M1,1 L9,5 L1,9 Z', fill: 'white', stroke: true }]
	},
	arrow: {
		w: 10,
		refX: 8,
		shapes: [{ el: 'path', d: 'M1,1 L8,5 L1,9', fill: 'none', stroke: true, strokeWidth: 1.4 }]
	},
	'triangle-sharp': {
		w: 10,
		refX: 9,
		shapes: [{ el: 'path', d: 'M1,1 L9,5 L1,9 L3.4,5 Z', fill: 'color' }]
	},
	'half-arrow-up': {
		w: 10,
		refX: 9,
		shapes: [{ el: 'path', d: 'M9,5 L2,1.5', fill: 'none', stroke: true, strokeWidth: 1.4 }]
	},
	'half-arrow-down': {
		w: 10,
		refX: 9,
		shapes: [{ el: 'path', d: 'M9,5 L2,8.5', fill: 'none', stroke: true, strokeWidth: 1.4 }]
	},
	'triangle-double': {
		w: 14,
		refX: 13.4,
		shapes: [
			{ el: 'path', d: 'M1,1.6 L6.8,5 L1,8.4 Z', fill: 'color' },
			{ el: 'path', d: 'M7.6,1.6 L13.4,5 L7.6,8.4 Z', fill: 'color' }
		]
	},
	'triangle-open-double': {
		w: 14,
		refX: 13.4,
		shapes: [
			{ el: 'path', d: 'M1,1.6 L6.8,5 L1,8.4 Z', fill: 'white', stroke: true },
			{ el: 'path', d: 'M7.6,1.6 L13.4,5 L7.6,8.4 Z', fill: 'white', stroke: true }
		]
	},
	'arrow-double': {
		w: 14,
		refX: 13.4,
		shapes: [
			{ el: 'path', d: 'M2,1.5 L7.4,5 L2,8.5', fill: 'none', stroke: true, strokeWidth: 1.4 },
			{ el: 'path', d: 'M8,1.5 L13.4,5 L8,8.5', fill: 'none', stroke: true, strokeWidth: 1.4 }
		]
	},
	// A tick crossing the line just before the head (the line itself forms the
	// horizontal stroke of the "+").
	'arrow-cross': {
		w: 14,
		refX: 13.4,
		shapes: [
			{ el: 'path', d: 'M7,2.5 L7,7.5', fill: 'none', stroke: true, strokeWidth: 1.4 },
			{ el: 'path', d: 'M9,1.5 L13.4,5 L9,8.5', fill: 'none', stroke: true, strokeWidth: 1.4 }
		]
	},
	'arrow-cross-double': {
		w: 17,
		refX: 16.4,
		shapes: [
			{ el: 'path', d: 'M4,2.5 L4,7.5', fill: 'none', stroke: true, strokeWidth: 1.4 },
			{ el: 'path', d: 'M6,1.5 L11.4,5 L6,8.5', fill: 'none', stroke: true, strokeWidth: 1.4 },
			{ el: 'path', d: 'M11,1.5 L16.4,5 L11,8.5', fill: 'none', stroke: true, strokeWidth: 1.4 }
		]
	},
	// ─── Basic shapes ────────────────────────────────────────────────────
	circle: {
		w: 10,
		refX: 8.6,
		shapes: [{ el: 'circle', cx: 5, cy: 5, r: 3.6, fill: 'color' }]
	},
	'circle-open': {
		w: 10,
		refX: 8.9,
		shapes: [{ el: 'circle', cx: 5, cy: 5, r: 3.3, fill: 'white', stroke: true }]
	},
	'circle-cross': {
		w: 10,
		refX: 8.9,
		shapes: [
			{ el: 'circle', cx: 5, cy: 5, r: 3.3, fill: 'white', stroke: true },
			{ el: 'path', d: 'M5,1.7 L5,8.3 M1.7,5 L8.3,5', fill: 'none', stroke: true }
		]
	},
	'circle-small': {
		w: 10,
		refX: 9.4,
		shapes: [{ el: 'circle', cx: 7.2, cy: 5, r: 2.2, fill: 'color' }]
	},
	'circle-open-small': {
		w: 10,
		refX: 9.6,
		shapes: [{ el: 'circle', cx: 7, cy: 5, r: 2, fill: 'white', stroke: true }]
	},
	// ─── Tick + circle combos (genogram-style cardinality) ──────────────
	// The circle sits at the node end; the ticks ride the line before it.
	'bar-circle': {
		w: 14,
		refX: 13.4,
		shapes: [
			{ el: 'path', d: 'M6,1.5 L6,8.5', fill: 'none', stroke: true, strokeWidth: 1.4 },
			{ el: 'circle', cx: 10.6, cy: 5, r: 2.8, fill: 'color' }
		]
	},
	'bar-circle-open': {
		w: 14,
		refX: 13.6,
		shapes: [
			{ el: 'path', d: 'M6,1.5 L6,8.5', fill: 'none', stroke: true, strokeWidth: 1.4 },
			{ el: 'circle', cx: 10.4, cy: 5, r: 2.6, fill: 'white', stroke: true }
		]
	},
	'bar-double-circle': {
		w: 16,
		refX: 15.4,
		shapes: [
			{ el: 'path', d: 'M4.5,1.5 L4.5,8.5 M7.5,1.5 L7.5,8.5', fill: 'none', stroke: true, strokeWidth: 1.4 },
			{ el: 'circle', cx: 12.6, cy: 5, r: 2.8, fill: 'color' }
		]
	},
	'bar-double-circle-open': {
		w: 16,
		refX: 15.6,
		shapes: [
			{ el: 'path', d: 'M4.5,1.5 L4.5,8.5 M7.5,1.5 L7.5,8.5', fill: 'none', stroke: true, strokeWidth: 1.4 },
			{ el: 'circle', cx: 12.4, cy: 5, r: 2.6, fill: 'white', stroke: true }
		]
	},
	'bar-triple-circle': {
		w: 18,
		refX: 17,
		shapes: [
			{
				el: 'path',
				d: 'M4,1.5 L4,8.5 M6.6,1.5 L6.6,8.5 M9.2,1.5 L9.2,8.5',
				fill: 'none',
				stroke: true,
				strokeWidth: 1.4
			},
			{ el: 'circle', cx: 14.2, cy: 5, r: 2.8, fill: 'color' }
		]
	},
	'bar-triple-circle-open': {
		w: 18,
		refX: 17.2,
		shapes: [
			{
				el: 'path',
				d: 'M4,1.5 L4,8.5 M6.6,1.5 L6.6,8.5 M9.2,1.5 L9.2,8.5',
				fill: 'none',
				stroke: true,
				strokeWidth: 1.4
			},
			{ el: 'circle', cx: 14, cy: 5, r: 2.6, fill: 'white', stroke: true }
		]
	},
	'diamond-circle': {
		w: 17,
		refX: 16.4,
		shapes: [
			{ el: 'path', d: 'M1.6,5 L5.6,1.6 L9.6,5 L5.6,8.4 Z', fill: 'white', stroke: true },
			{ el: 'circle', cx: 13.6, cy: 5, r: 2.8, fill: 'color' }
		]
	},
	'diamond-circle-open': {
		w: 17,
		refX: 16.6,
		shapes: [
			{ el: 'path', d: 'M1.6,5 L5.6,1.6 L9.6,5 L5.6,8.4 Z', fill: 'white', stroke: true },
			{ el: 'circle', cx: 13.4, cy: 5, r: 2.6, fill: 'white', stroke: true }
		]
	},
	square: {
		w: 10,
		refX: 8.5,
		shapes: [{ el: 'rect', x: 2.5, y: 2, width: 6, height: 6, fill: 'color' }]
	},
	'square-open': {
		w: 10,
		refX: 8.6,
		shapes: [{ el: 'rect', x: 3, y: 2.5, width: 5, height: 5, fill: 'white', stroke: true }]
	},
	'square-small': {
		w: 10,
		refX: 9,
		shapes: [{ el: 'rect', x: 5, y: 3, width: 4, height: 4, fill: 'color' }]
	},
	'square-open-small': {
		w: 10,
		refX: 8.1,
		shapes: [{ el: 'rect', x: 4.5, y: 3.5, width: 3, height: 3, fill: 'white', stroke: true }]
	},
	diamond: {
		w: 10,
		refX: 9,
		shapes: [{ el: 'path', d: 'M1,5 L5,1 L9,5 L5,9 Z', fill: 'color' }]
	},
	'diamond-open': {
		w: 10,
		refX: 9,
		shapes: [{ el: 'path', d: 'M1.6,5 L5,1.6 L8.4,5 L5,8.4 Z', fill: 'white', stroke: true }]
	},
	'diamond-open-small': {
		w: 10,
		refX: 9,
		shapes: [{ el: 'path', d: 'M5,5 L7,3 L9,5 L7,7 Z', fill: 'white', stroke: true }]
	},
	// Elongated, flatter outline — reads as a "long" diamond lying on the line.
	'diamond-open-wide': {
		w: 14,
		refX: 12.4,
		shapes: [{ el: 'path', d: 'M1,5 L6.7,2 L12.4,5 L6.7,8 Z', fill: 'white', stroke: true }]
	},
	// ─── Ticks ───────────────────────────────────────────────────────────
	bar: {
		w: 10,
		refX: 6,
		flush: true,
		shapes: [{ el: 'path', d: 'M5,0.5 L5,9.5', fill: 'none', stroke: true, strokeWidth: 1.6 }]
	},
	'bar-double': {
		w: 10,
		refX: 8,
		flush: true,
		shapes: [
			{ el: 'path', d: 'M4,1 L4,9 M7,1 L7,9', fill: 'none', stroke: true, strokeWidth: 1.4 }
		]
	},
	slash: {
		w: 10,
		refX: 7,
		flush: true,
		shapes: [
			{ el: 'path', d: 'M6.5,1.2 L3.5,8.8', fill: 'none', stroke: true, strokeWidth: 1.4 }
		]
	},
	// ─── ERD cardinality ─────────────────────────────────────────────────
	crowfoot: {
		w: 10,
		refX: 9,
		shapes: [
			{
				el: 'path',
				d: 'M2,5 L9,1 M2,5 L9,5 M2,5 L9,9',
				fill: 'none',
				stroke: true
			}
		]
	},
	'circle-crowfoot': {
		w: 14,
		refX: 13.4,
		shapes: [
			{ el: 'circle', cx: 3.9, cy: 5, r: 2.6, fill: 'white', stroke: true },
			{
				el: 'path',
				d: 'M7,5 L13.4,1.2 M7,5 L13.4,5 M7,5 L13.4,8.8',
				fill: 'none',
				stroke: true
			}
		]
	},
	'bar-crowfoot': {
		w: 14,
		refX: 13.4,
		shapes: [
			{ el: 'path', d: 'M6,1.2 L6,8.8', fill: 'none', stroke: true, strokeWidth: 1.4 },
			{
				el: 'path',
				d: 'M7,5 L13.4,1.2 M7,5 L13.4,5 M7,5 L13.4,8.8',
				fill: 'none',
				stroke: true
			}
		]
	},
	'circle-bar': {
		w: 14,
		refX: 10.6,
		flush: true,
		shapes: [
			{ el: 'circle', cx: 5, cy: 5, r: 2.6, fill: 'white', stroke: true },
			{ el: 'path', d: 'M10,1.2 L10,8.8', fill: 'none', stroke: true, strokeWidth: 1.4 }
		]
	}
};
